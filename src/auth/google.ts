import { requestToken } from '../api/client.ts'
import { type TokenPair, tokenPairFrom } from './tokenStore.ts'

/** The parts of Google Identity Services this app uses (https://developers.google.com/identity/gsi/web/reference/js-reference). */
export interface GoogleIdentity {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void
  renderButton(
    parent: HTMLElement,
    options: { type: 'standard'; text: GoogleButtonText; click_listener?: () => void },
  ): void
}

export type GoogleButtonText = 'signin_with' | 'signup_with'

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } }
  }
}

const scriptSrc = 'https://accounts.google.com/gsi/client'

/** Adds Google's script on first use only, so screens without the Google button never load it. */
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const loaded = window.google?.accounts.id
  if (loaded) return Promise.resolve(loaded)

  let script = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`)
  if (!script) {
    script = document.createElement('script')
    script.src = scriptSrc
    script.async = true
    document.head.append(script)
  }
  const pending = script
  return new Promise((resolve, reject) => {
    function fail(message: string) {
      // A later visit adds the script again instead of waiting on one that already failed or did not start.
      pending.remove()
      reject(new Error(message))
    }
    pending.addEventListener('load', () => {
      const id = window.google?.accounts.id
      if (id) resolve(id)
      else fail('Google Identity Services did not start')
    })
    pending.addEventListener('error', () => fail('Google Identity Services did not load'))
  })
}

/**
 * Removes Google's script element and `window.google`, so the next sign-in screen loads and initializes it again.
 * What the script already ran stays in the page: its message listeners, its button stylesheet, its client.
 */
export function unloadGoogleIdentity(): void {
  document.querySelector(`script[src="${scriptSrc}"]`)?.remove()
  delete window.google
}

export interface GoogleExchange {
  apiUrl: string
  /** The public uid of the OAuth web application (contract `TokenRequest.client_id`). */
  clientId: string
  idToken: string
  fetch?: typeof fetch
}

/** This device's pair for a Google ID token (contract `createToken`), or null when the grant did not complete. */
export async function exchangeGoogleIdToken({
  apiUrl,
  clientId,
  idToken,
  fetch = globalThis.fetch,
}: GoogleExchange): Promise<TokenPair | null> {
  try {
    const response = await requestToken(apiUrl, { grant_type: 'google_id_token', client_id: clientId, id_token: idToken }, fetch)
    return response.ok ? tokenPairFrom(await response.json()) : null
  } catch {
    return null
  }
}
