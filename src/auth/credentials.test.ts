import { describe, expect, it, vi } from 'vitest'
import { parse } from 'yaml'
import contract from '../../docs/features/todolist/contracts/openapi.yaml?raw'
import { createApiClient } from '../api/client.ts'
import { signIn, signOut, signUp, validateSignUp } from './credentials.ts'
import { memoryStore } from './tokenStore.testSupport.ts'

const apiUrl = 'https://api.example.test'
const valid = { email: 'new@example.test', password: 'secret1', confirmation: 'secret1' }
const pair = { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer', expires_in: 3600, created_at: 1 }

function answering(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response)
}

function sent(fetch: ReturnType<typeof answering>) {
  const [url, init] = fetch.mock.calls[0]
  return { url, method: init?.method, headers: new Headers(init?.headers), json: JSON.parse(String(init?.body)) }
}

describe('validateSignUp', () => {
  it.each([
    ['email', { ...valid, email: 'not-an-email' }, 'Enter an email address like name@example.com.'],
    ['password', { ...valid, password: 'short', confirmation: 'short' }, 'Password must be at least 6 characters.'],
    ['confirmation', { ...valid, confirmation: 'secret2' }, 'The passwords do not match.'],
  ])('names a wrong %s and what it must be', (field, input, message) => {
    expect(validateSignUp(input)).toEqual({ [field]: message })
  })

  it('names a password over the maximum length', () => {
    const long = 'p'.repeat(129)

    expect(validateSignUp({ ...valid, password: long, confirmation: long })).toEqual({
      password: 'Password must be at most 128 characters.',
    })
  })

  it('counts password length in characters, not UTF-16 units', () => {
    const emoji = '🔑'.repeat(128)

    expect(validateSignUp({ ...valid, password: emoji, confirmation: emoji })).toEqual({})
  })

  it('counts the minimum in characters too, not UTF-16 units', () => {
    const short = '🔑'.repeat(3)

    expect(validateSignUp({ ...valid, password: short, confirmation: short })).toEqual({
      password: 'Password must be at least 6 characters.',
    })
  })

  it("enforces the contract's UserCreate password length bounds", () => {
    const { minLength, maxLength } = parse(contract).components.schemas.UserCreate.properties.user.properties.password
    const withPassword = (length: number) => {
      const password = 'p'.repeat(length)
      return validateSignUp({ ...valid, password, confirmation: password })
    }

    expect(withPassword(minLength - 1)).toHaveProperty('password')
    expect(withPassword(minLength)).toEqual({})
    expect(withPassword(maxLength)).toEqual({})
    expect(withPassword(maxLength + 1)).toHaveProperty('password')
  })

  it('accepts a valid sign-up', () => {
    expect(validateSignUp(valid)).toEqual({})
  })
})

describe('signUp', () => {
  it("sends the contract's UserCreate body and signs in with the answered pair", async () => {
    const fetch = answering(Response.json({ status: 'success', message: 'ok', data: pair }, { status: 201 }))

    const result = await signUp(apiUrl, valid, fetch)

    const request = sent(fetch)
    expect(request.url).toBe('https://api.example.test/api/v1/users')
    expect(request.method).toBe('POST')
    expect(request.headers.get('Content-Type')).toBe('application/json')
    expect(request.json).toEqual({
      user: { email: 'new@example.test', password: 'secret1', password_confirmation: 'secret1' },
    })
    expect(result).toEqual({ kind: 'signed-in', pair: { accessToken: 'a1', refreshToken: 'r1' } })
  })

  it('reports a created account without signing in when the answer carries no token pair (ADR-0008)', async () => {
    const data = { user_id: 7, email: 'new@example.test', authentication_token: 'legacy' }
    const fetch = answering(Response.json({ status: 'success', message: 'ok', data }, { status: 201 }))

    expect(await signUp(apiUrl, valid, fetch)).toEqual({ kind: 'created' })
  })

  it('names the confirmation, not the password, for a server-side mismatch', async () => {
    const fetch = answering(Response.json({ errors: ["Password confirmation doesn't match Password"] }, { status: 422 }))

    expect(await signUp(apiUrl, valid, fetch)).toEqual({
      kind: 'fields',
      errors: { confirmation: 'The passwords do not match.' },
    })
  })

  it('tells the visitor to wait the Retry-After seconds when sign-ups from this source are too many (AC-04b)', async () => {
    const fetch = answering(
      Response.json({ errors: ['Too many attempts, try again later'] }, { status: 429, headers: { 'Retry-After': '30' } }),
    )

    expect(await signUp(apiUrl, valid, fetch)).toEqual({ kind: 'wait', seconds: 30 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('still tells the visitor to wait when a 429 carries no usable Retry-After (AC-04b)', async () => {
    const fetch = answering(Response.json({ errors: ['Too many attempts, try again later'] }, { status: 429 }))

    expect(await signUp(apiUrl, valid, fetch)).toEqual({ kind: 'wait', seconds: null })
  })
})

describe('signIn', () => {
  it('sends the password grant and signs in with the answered pair', async () => {
    const fetch = answering(Response.json(pair))

    const result = await signIn(apiUrl, 'web-client', { email: 'user@example.test', password: 'secret1' }, fetch)

    const request = sent(fetch)
    expect(request.url).toBe('https://api.example.test/oauth/token')
    expect(request.method).toBe('POST')
    expect(request.json).toEqual({
      grant_type: 'password',
      client_id: 'web-client',
      username: 'user@example.test',
      password: 'secret1',
    })
    expect(result).toEqual({ kind: 'signed-in', pair: { accessToken: 'a1', refreshToken: 'r1' } })
  })
})

describe('signOut', () => {
  it('the contract answers sign-out on this device with 204', () => {
    expect(Object.keys(parse(contract).paths['/api/v1/sign_out'].post.responses)).toContain('204')
  })

  it("posts this device's access token to sign_out", async () => {
    const fetch = answering(new Response(null, { status: 204 }))
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }

    await signOut(createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut: () => {}, fetch }))

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.example.test/api/v1/sign_out')
    expect(init?.method).toBe('POST')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer a1')
  })

  it('sends once, so an expired token is never renewed into a session signed in afterwards', async () => {
    let answer: (response: Response) => void = () => {}
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (answer = resolve)))
      .mockResolvedValue(new Response(null, { status: 204 }))
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }
    const onSignedOut = vi.fn()

    const signingOut = signOut(createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut, fetch }))
    store.clear()
    store.save({ accessToken: 'b1', refreshToken: 'rb1' })
    answer(new Response(null, { status: 401 }))
    await signingOut

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(store.read()).toEqual({ accessToken: 'b1', refreshToken: 'rb1' })
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it("renews an expired access token with this session's refresh token and revokes the renewed one", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...pair, access_token: 'a2', refresh_token: 'r2' })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }
    const onSignedOut = vi.fn()

    const signingOut = signOut(createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut, fetch }))
    store.clear()
    await signingOut

    expect(fetch).toHaveBeenCalledTimes(3)
    const [[refreshUrl, refresh], [repeatUrl, repeat]] = fetch.mock.calls.slice(1)
    expect(refreshUrl).toBe('https://api.example.test/oauth/token')
    expect(JSON.parse(String(refresh?.body))).toEqual({ grant_type: 'refresh_token', client_id: 'web-client', refresh_token: 'r1' })
    expect(repeatUrl).toBe('https://api.example.test/api/v1/sign_out')
    expect(repeat?.method).toBe('POST')
    expect(new Headers(repeat?.headers).get('Authorization')).toBe('Bearer a2')
    expect(store.read()).toBeNull()
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it("never repeats with the pair another tab saved after spending this session's refresh token", async () => {
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (url) => {
      if (url !== `${apiUrl}/oauth/token`) return new Response(null, { status: 401 })
      store.save({ accessToken: 'a2', refreshToken: 'r2' })
      return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
    })
    const onSignedOut = vi.fn()

    const signingOut = signOut(createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut, fetch }))
    store.clear()
    await signingOut

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get('Authorization'))).not.toContain('Bearer a2')
    expect(store.read()).toEqual({ accessToken: 'a2', refreshToken: 'r2' })
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('signs out locally without routing to sign-in when its own session cannot be renewed', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }
    const onSignedOut = vi.fn()

    const signingOut = signOut(createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut, fetch }))
    store.clear()
    await signingOut

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(store.read()).toBeNull()
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('joins a refresh another request of this tab already started, so both do not spend the same refresh token', async () => {
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }
    let answerRefresh: (response: Response) => void = () => {}
    let spent = false
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((url, init) => {
      if (url === `${apiUrl}/oauth/token`) {
        if (spent) return Promise.resolve(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
        spent = true
        return new Promise<Response>((resolve) => (answerRefresh = resolve))
      }
      const status = new Headers(init?.headers).get('Authorization') === 'Bearer a2' ? 204 : 401
      return Promise.resolve(new Response(null, { status }))
    })
    const api = createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut: () => {}, fetch })

    const loading = api.request('/api/v1/projects')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const signingOut = signOut(api)
    store.clear()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
    answerRefresh(new Response(JSON.stringify({ ...pair, access_token: 'a2', refresh_token: 'r2' })))
    await signingOut
    await loading.catch(() => {})

    const signOuts = fetch.mock.calls.filter(([url]) => url === `${apiUrl}/api/v1/sign_out`)
    expect(signOuts.map(([, init]) => new Headers(init?.headers).get('Authorization'))).toEqual(['Bearer a1', 'Bearer a2'])
    expect(fetch.mock.calls.filter(([url]) => url === `${apiUrl}/oauth/token`)).toHaveLength(1)
  })

  it('repeats with the renewal another request of this tab already finished, so it never spends the rotated refresh token', async () => {
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }
    let answerRefresh: (response: Response) => void = () => {}
    let answerSignOut: (response: Response) => void = () => {}
    let spent = false
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation((url, init) => {
      if (url === `${apiUrl}/oauth/token`) {
        if (spent) return Promise.resolve(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
        spent = true
        return new Promise<Response>((resolve) => (answerRefresh = resolve))
      }
      const authorization = new Headers(init?.headers).get('Authorization')
      if (url === `${apiUrl}/api/v1/sign_out` && authorization === 'Bearer a1') {
        return new Promise<Response>((resolve) => (answerSignOut = resolve))
      }
      return Promise.resolve(new Response(null, { status: authorization === 'Bearer a2' ? 204 : 401 }))
    })
    const onSignedOut = vi.fn()
    const api = createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut, fetch })

    const loading = api.request('/api/v1/projects')
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    const signingOut = signOut(api)
    store.clear()
    answerRefresh(new Response(JSON.stringify({ ...pair, access_token: 'a2', refresh_token: 'r2' })))
    await loading.catch(() => {})
    answerSignOut(new Response(null, { status: 401 }))
    await signingOut

    const signOuts = fetch.mock.calls.filter(([url]) => url === `${apiUrl}/api/v1/sign_out`)
    expect(signOuts.map(([, init]) => new Headers(init?.headers).get('Authorization'))).toEqual(['Bearer a1', 'Bearer a2'])
    expect(fetch.mock.calls.filter(([url]) => url === `${apiUrl}/oauth/token`)).toHaveLength(1)
    expect(store.read()).toBeNull()
    expect(onSignedOut).not.toHaveBeenCalled()
  })

  it('never throws when the server cannot be reached', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('offline'))
    const store = memoryStore()
    store.pair = { accessToken: 'a1', refreshToken: 'r1' }

    await expect(
      signOut(createApiClient({ apiUrl, clientId: 'web-client', store, onSignedOut: () => {}, fetch })),
    ).resolves.toBeUndefined()
  })
})
