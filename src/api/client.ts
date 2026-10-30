import { type TokenPair, type TokenStore, tokenPairFrom } from '../auth/tokenStore.ts'

export interface ApiRequest {
  method?: string
  /** Sent as the JSON body; serialised again for a repeated request, so the caller's value is never consumed. */
  json?: unknown
  signal?: AbortSignal
  /**
   * The request may outlive the session it was sent for: a `401` is repeated once, only with that session's own renewed
   * token, and never signs the device out.
   */
  once?: boolean
}

/** The session ended: the refresh token was refused, the tokens are cleared and the user is sent to sign in. */
export class SignedOutError extends Error {
  constructor() {
    super('signed out')
    this.name = 'SignedOutError'
  }
}

export interface ApiClientOptions {
  apiUrl: string
  /** The public uid of the OAuth web application, sent on every grant (contract `TokenRequest.client_id`). */
  clientId: string
  store: TokenStore
  /** Routes to sign-in after the tokens were cleared. */
  onSignedOut: () => void
  fetch?: typeof fetch
}

export interface ApiClient {
  request(path: string, request?: ApiRequest): Promise<Response>
}

/** The body of `POST /oauth/token` (contract `TokenRequest`) for each grant this app sends. */
export type TokenRequest =
  | { grant_type: 'password'; client_id: string; username: string; password: string }
  | { grant_type: 'refresh_token'; client_id: string; refresh_token: string }
  | { grant_type: 'google_id_token'; client_id: string; id_token: string }

/** POSTs a JSON body without a bearer token. */
export function postJson(url: string, json: unknown, fetch: typeof globalThis.fetch = globalThis.fetch) {
  return fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  })
}

/** Sends a grant to the token endpoint, which takes no bearer token (contract `createToken`). */
export function requestToken(apiUrl: string, body: TokenRequest, fetch: typeof globalThis.fetch = globalThis.fetch) {
  return postJson(`${apiUrl}/oauth/token`, body, fetch)
}

export function createApiClient({ apiUrl, clientId, store, onSignedOut, fetch = globalThis.fetch }: ApiClientOptions): ApiClient {
  // Refresh tokens rotate: every renewal of one refresh token, sign-out's included, shares one exchange, or the later
  // ones would present a revoked token and be refused. The answer is kept until another token is renewed, so a renewal
  // that comes after the exchange settled gets it too; only a failed exchange is forgotten, to be tried again.
  let lastRenewal: { refreshToken: string; next: Promise<TokenPair | null> } | null = null
  // Requests that expire together share one refresh, so a refused one signs the device out once.
  let refreshing: Promise<TokenPair> | null = null

  function signOut(): never {
    store.clear()
    onSignedOut()
    throw new SignedOutError()
  }

  // Exchanges this session's refresh token; `null` when the server refused it.
  async function exchange(pair: TokenPair): Promise<TokenPair | null> {
    const response = await requestToken(
      apiUrl,
      { grant_type: 'refresh_token', client_id: clientId, refresh_token: pair.refreshToken },
      fetch,
    )
    if (response.status === 400) return null
    if (!response.ok) throw new Error(`token refresh failed: ${response.status}`)
    const next = tokenPairFrom(await response.json())
    if (!next) throw new Error('token refresh answered without a token pair')
    // A sign-out (and maybe a new sign-in) while the refresh was in flight replaced this pair; saving would sign
    // this device back in or overwrite the new session.
    if (store.read()?.refreshToken === pair.refreshToken) store.save(next)
    return next
  }

  function renewalOf(pair: TokenPair): Promise<TokenPair | null> {
    if (lastRenewal?.refreshToken !== pair.refreshToken) {
      const next = exchange(pair)
      next.catch(() => {
        if (lastRenewal?.next === next) lastRenewal = null
      })
      lastRenewal = { refreshToken: pair.refreshToken, next }
    }
    return lastRenewal.next
  }

  async function refresh(pair: TokenPair): Promise<TokenPair> {
    const next = await renewalOf(pair)
    if (next) return next
    // Another tab may have spent this refresh token first; its new pair is then in the shared store.
    const current = store.read()
    if (current && current.refreshToken !== pair.refreshToken) return current
    return signOut()
  }

  // A request that expired after another one already refreshed repeats with the new token instead of refreshing.
  function renewed(expired: TokenPair): Promise<TokenPair> {
    const current = store.read()
    if (current && current.accessToken !== expired.accessToken) return Promise.resolve(current)
    refreshing ??= refresh(expired).finally(() => {
      refreshing = null
    })
    return refreshing
  }

  function send(path: string, { method = 'GET', json, signal }: ApiRequest, accessToken: string | undefined) {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (json !== undefined) headers['Content-Type'] = 'application/json'
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    return fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: json === undefined ? undefined : JSON.stringify(json),
      signal,
    })
  }

  // A request that may outlive its session repeats only with that session's own renewed token: never with a pair
  // the store holds by then, and never by signing the device out.
  async function repeatedOnce(path: string, request: ApiRequest, sentWith: TokenPair | null, response: Response) {
    const current = store.read()
    if (!sentWith || (current && current.refreshToken !== sentWith.refreshToken)) return response
    const next = await renewalOf(sentWith)
    return next ? send(path, request, next.accessToken) : response
  }

  return {
    async request(path, request = {}) {
      const sentWith = store.read()
      const response = await send(path, request, sentWith?.accessToken)
      if (response.status !== 401) return response
      if (request.once) return repeatedOnce(path, request, sentWith, response)
      if (!sentWith) signOut()

      const repeated = await send(path, request, (await renewed(sentWith)).accessToken)
      if (repeated.status === 401) signOut()
      return repeated
    },
  }
}
