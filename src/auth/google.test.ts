// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { exchangeGoogleIdToken, loadGoogleIdentity, unloadGoogleIdentity } from './google.ts'

const apiUrl = 'https://api.example.test'
const answer = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })

function exchange(fetch: typeof globalThis.fetch) {
  return exchangeGoogleIdToken({ apiUrl, clientId: 'web-client', idToken: 'g-token', fetch })
}

describe('loadGoogleIdentity', () => {
  afterEach(() => {
    document.head.querySelectorAll('script').forEach((script) => script.remove())
    delete window.google
  })

  it("loads Google's script once", async () => {
    const first = loadGoogleIdentity()
    const second = loadGoogleIdentity()
    const scripts = document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')
    expect(scripts).toHaveLength(1)

    const id = { initialize: vi.fn(), renderButton: vi.fn() }
    window.google = { accounts: { id } }
    scripts[0].dispatchEvent(new Event('load'))
    expect(await first).toBe(id)
    expect(await second).toBe(id)
  })

  it("rejects and removes the script when Google's script fails to load", async () => {
    const loading = loadGoogleIdentity()
    const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    script?.dispatchEvent(new Event('error'))
    await expect(loading).rejects.toThrow()
    expect(document.querySelector('script')).toBeNull()
  })

  it("rejects when Google's script loads but does not start", async () => {
    const loading = loadGoogleIdentity()
    document.querySelector('script')?.dispatchEvent(new Event('load'))
    await expect(loading).rejects.toThrow()
  })

  it("a later call loads Google's script again after it loaded but did not start", async () => {
    const failed = loadGoogleIdentity()
    const stale = document.querySelector('script')
    stale?.dispatchEvent(new Event('load'))
    await expect(failed).rejects.toThrow()

    const retried = loadGoogleIdentity()
    const scripts = document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')
    expect(scripts).toHaveLength(1)
    expect(scripts[0]).not.toBe(stale)
    const id = { initialize: vi.fn(), renderButton: vi.fn() }
    window.google = { accounts: { id } }
    scripts[0].dispatchEvent(new Event('load'))
    expect(await retried).toBe(id)
  })

  it("after unloading a started script, the next call loads Google's script again", async () => {
    const first = loadGoogleIdentity()
    const started = document.querySelector('script')
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton: vi.fn() } } }
    started?.dispatchEvent(new Event('load'))
    await first

    unloadGoogleIdentity()
    expect(window.google).toBeUndefined()
    expect(document.querySelector('script')).toBeNull()

    void loadGoogleIdentity()
    expect(document.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')).toHaveLength(1)
  })
})

describe('exchangeGoogleIdToken', () => {
  it('sends the Google ID token as the google_id_token grant', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      answer(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer', expires_in: 3600, created_at: 1 }),
    )
    expect(await exchange(fetch)).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.example.test/oauth/token')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      grant_type: 'google_id_token',
      client_id: 'web-client',
      id_token: 'g-token',
    })
  })

  it('a refused grant gives no pair', async () => {
    expect(await exchange(vi.fn<typeof globalThis.fetch>().mockResolvedValue(answer(400, { error: 'invalid_grant' })))).toBeNull()
    expect(await exchange(vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('Failed to fetch')))).toBeNull()
    expect(
      await exchange(vi.fn<typeof globalThis.fetch>().mockResolvedValue(answer(200, { access_token: 'a1', refresh_token: '' }))),
    ).toBeNull()
  })
})
