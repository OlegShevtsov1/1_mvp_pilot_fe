import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import type { TokenPair, TokenStore } from '../auth/tokenStore.ts'
import { SignedOutError, type TokenRequest, createApiClient } from './client.ts'

const apiUrl = 'https://api.example.test'
const refreshed = { access_token: 'a2', refresh_token: 'r2', token_type: 'Bearer', expires_in: 3600, created_at: 1 }

function memoryStore(): TokenStore {
  let pair: TokenPair | null = { accessToken: 'a1', refreshToken: 'r1' }
  return {
    read: () => pair,
    save: (next) => {
      pair = next
    },
    clear: () => {
      pair = null
    },
  }
}

const answer = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })

function setup(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>()
  for (const response of responses) fetch.mockResolvedValueOnce(response)
  const store = memoryStore()
  const onSignedOut = vi.fn()
  const client = createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut, fetch })
  return { client, fetch, store, onSignedOut }
}

function sent(fetch: ReturnType<typeof setup>['fetch'], call: number) {
  const [url, init] = fetch.mock.calls[call]
  return { url, method: init?.method, body: init?.body, headers: new Headers(init?.headers) }
}

describe('createApiClient', () => {
  it('sends the stored access token as a bearer token', async () => {
    const { client, fetch } = setup(answer(200))
    await client.request('/api/v1/projects')
    expect(sent(fetch, 0).url).toBe('https://api.example.test/api/v1/projects')
    expect(sent(fetch, 0).headers.get('Authorization')).toBe('Bearer a1')
  })

  it("refreshes an expired access token once and repeats the request with the caller's input", async () => {
    const { client, fetch, store, onSignedOut } = setup(answer(401), answer(200, refreshed), answer(200))
    const json = { task: { status: 'completed' } }
    const original = structuredClone(json)

    const response = await client.request('/api/v1/projects/1/tasks/2', { method: 'PATCH', json })

    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(3)
    const refresh = sent(fetch, 1)
    expect(refresh.url).toBe('https://api.example.test/oauth/token')
    expect(refresh.method).toBe('POST')
    expect(JSON.parse(String(refresh.body))).toEqual({
      grant_type: 'refresh_token',
      client_id: 'web-client',
      refresh_token: 'r1',
    })
    const [first, repeated] = [sent(fetch, 0), sent(fetch, 2)]
    expect(repeated.url).toBe(first.url)
    expect(repeated.method).toBe('PATCH')
    expect(repeated.body).toBe(first.body)
    expect(JSON.parse(String(repeated.body))).toEqual(original)
    expect(repeated.headers.get('Authorization')).toBe('Bearer a2')
    expect(store.read()).toEqual({ accessToken: 'a2', refreshToken: 'r2' })
    expect(json).toEqual(original)
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('shares one refresh between requests that expire together', async () => {
    const { client, fetch } = setup()
    fetch.mockImplementation(async (url, init) => {
      if (url === `${apiUrl}/oauth/token`) return answer(200, refreshed)
      return new Headers(init?.headers).get('Authorization') === 'Bearer a2' ? answer(200) : answer(401)
    })

    const responses = await Promise.all([client.request('/api/v1/projects'), client.request('/api/v1/projects/1/tasks')])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const urls = fetch.mock.calls.map(([url]) => url)
    expect(urls.filter((url) => url === `${apiUrl}/oauth/token`)).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(5)
  })

  it('repeats a late-expiring request with the token an earlier request already refreshed', async () => {
    const { client, fetch, onSignedOut } = setup()
    let answerLate: (response: Response) => void = () => {}
    const late = new Promise<Response>((resolve) => {
      answerLate = resolve
    })
    fetch.mockImplementation(async (url, init) => {
      if (url === `${apiUrl}/oauth/token`) return answer(200, refreshed)
      if (new Headers(init?.headers).get('Authorization') === 'Bearer a2') return answer(200)
      return url === `${apiUrl}/api/v1/projects/1/tasks` ? late : answer(401)
    })

    const lateRequest = client.request('/api/v1/projects/1/tasks')
    expect((await client.request('/api/v1/projects')).status).toBe(200)
    answerLate(answer(401))

    expect((await lateRequest).status).toBe(200)
    const urls = fetch.mock.calls.map(([url]) => url)
    expect(urls.filter((url) => url === `${apiUrl}/oauth/token`)).toHaveLength(1)
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('returns an error other than 401 without refreshing', async () => {
    const { client, fetch, store, onSignedOut } = setup(answer(500))

    const response = await client.request('/api/v1/projects')

    expect(response.status).toBe(500)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(store.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('signs out on a 401 when no token is stored', async () => {
    const { client, fetch, store, onSignedOut } = setup(answer(401))
    store.clear()

    await expect(client.request('/api/v1/projects')).rejects.toBeInstanceOf(SignedOutError)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(onSignedOut).toHaveBeenCalledTimes(1)
  })

  it('a refused refresh clears the stored tokens and routes to sign-in', async () => {
    const { client, fetch, store, onSignedOut } = setup(answer(401), answer(400, { error: 'invalid_grant' }))

    await expect(client.request('/api/v1/projects')).rejects.toBeInstanceOf(SignedOutError)

    expect(store.read()).toBeNull()
    expect(onSignedOut).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('signs out without a second refresh when the repeated request is refused', async () => {
    const { client, fetch, store, onSignedOut } = setup(answer(401), answer(200, refreshed), answer(401))

    await expect(client.request('/api/v1/projects')).rejects.toBeInstanceOf(SignedOutError)

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(store.read()).toBeNull()
    expect(onSignedOut).toHaveBeenCalledTimes(1)
  })

  it('repeats with the pair another tab saved when that tab already spent the refresh token', async () => {
    const { client, fetch, store, onSignedOut } = setup()
    fetch.mockImplementation(async (url, init) => {
      if (url === `${apiUrl}/oauth/token`) {
        store.save({ accessToken: 'a2', refreshToken: 'r2' })
        return answer(400, { error: 'invalid_grant' })
      }
      return new Headers(init?.headers).get('Authorization') === 'Bearer a2' ? answer(200) : answer(401)
    })

    const response = await client.request('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(store.read()).toEqual({ accessToken: 'a2', refreshToken: 'r2' })
    expect(onSignedOut).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('does not store a refreshed pair when the device signed out while the refresh was in flight', async () => {
    const { client, fetch, store } = setup(answer(401), answer(200, refreshed), new Response(null, { status: 204 }))

    const response = client.request('/api/v1/sign_out', { method: 'POST' })
    store.clear()

    expect((await response).status).toBe(204)
    expect(sent(fetch, 2).headers.get('Authorization')).toBe('Bearer a2')
    expect(store.read()).toBeNull()
  })

  it('keeps the pair of a new sign-in made while the refresh of the old session was in flight', async () => {
    const { client, fetch, store } = setup()
    let answerRefresh: (response: Response) => void = () => {}
    fetch
      .mockResolvedValueOnce(answer(401))
      .mockReturnValueOnce(new Promise((resolve) => (answerRefresh = resolve)))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    const response = client.request('/api/v1/sign_out', { method: 'POST' })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    store.clear()
    store.save({ accessToken: 'b1', refreshToken: 'rb1' })
    answerRefresh(answer(200, refreshed))

    expect((await response).status).toBe(204)
    expect(store.read()).toEqual({ accessToken: 'b1', refreshToken: 'rb1' })
  })

  it('keeps the tokens when the refresh fails for another reason', async () => {
    const { client, store, onSignedOut } = setup(answer(401), answer(503))

    const error = await client.request('/api/v1/projects').catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(SignedOutError)
    expect(store.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('keeps the tokens when the refresh is refused as an unknown client', async () => {
    const { client, store, onSignedOut } = setup(answer(401), answer(401, { error: 'invalid_client' }))

    const error = await client.request('/api/v1/projects').catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(SignedOutError)
    expect(store.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('keeps the tokens when the refresh answers with an empty token', async () => {
    const { client, store, onSignedOut } = setup(answer(401), answer(200, { ...refreshed, refresh_token: '' }), answer(200))

    const error = await client.request('/api/v1/projects').catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(SignedOutError)
    expect(store.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    expect(onSignedOut).not.toHaveBeenCalled()
  })
})

describe('TokenRequest', () => {
  it('every grant the app sends is one the contract accepts, with the fields the contract names', () => {
    const contract = parse(readFileSync(new URL('../../docs/features/todolist/contracts/openapi.yaml', import.meta.url), 'utf8'))
    const schema: { required: string[]; properties: { grant_type: { enum: string[] } } } = contract.components.schemas.TokenRequest
    const sent: { [G in TokenRequest['grant_type']]: Extract<TokenRequest, { grant_type: G }> } = {
      password: { grant_type: 'password', client_id: 'web-client', username: 'user@example.test', password: 'secret1' },
      refresh_token: { grant_type: 'refresh_token', client_id: 'web-client', refresh_token: 'r1' },
      google_id_token: { grant_type: 'google_id_token', client_id: 'web-client', id_token: 'g-token' },
    }
    for (const body of Object.values(sent)) {
      expect(schema.properties.grant_type.enum).toContain(body.grant_type)
      expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(Object.keys(body)))
      expect(Object.keys(body)).toEqual(expect.arrayContaining(schema.required))
    }
  })
})
