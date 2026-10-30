// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../config.ts'
import GoogleSignIn from './GoogleSignIn.tsx'
import type { TokenPair, TokenStore } from './tokenStore.ts'

const config: AppConfig = {
  API_URL: 'https://api.example.test',
  SENTRY_DSN: '',
  ENV_NAME: 'dev',
  APP_VERSION: 'sha-abc123',
  GOOGLE_CLIENT_ID: 'client-id.apps.example.test',
  OAUTH_CLIENT_ID: 'web-client',
  SUPPORT_EMAIL: '',
}
const earlier = { accessToken: 'a0', refreshToken: 'r0' }
const answer = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status })

function memoryStore(pair: TokenPair | null = null): TokenStore {
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

interface FakeGoogle {
  signIn: (response: { credential: string }) => void
  click: () => void
}

function stubGoogle(): FakeGoogle {
  const fake = {} as FakeGoogle
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn(({ callback }) => {
          fake.signIn = callback
        }),
        renderButton: vi.fn((_parent, { click_listener }) => {
          fake.click = click_listener
        }),
      },
    },
  }
  return fake
}

function renderSignIn(store: TokenStore, googleConfig: AppConfig = config) {
  return render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route path="/sign-in" element={<GoogleSignIn config={googleConfig} store={store} text="signin_with" />} />
        <Route path="/dashboard" element={<p>dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function startGoogle(store: TokenStore) {
  const google = stubGoogle()
  const { unmount } = renderSignIn(store)
  await waitFor(() => expect(google.click).toBeTypeOf('function'))
  return { ...google, unmount }
}

describe('GoogleSignIn', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.head.querySelectorAll('script').forEach((script) => script.remove())
    delete window.google
  })

  it("completing Google sign-in stores this device's pair and opens the dashboard", async () => {
    const fetch = vi.fn(async () => answer(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer' }))
    vi.stubGlobal('fetch', fetch)
    const store = memoryStore(earlier)
    const google = await startGoogle(store)

    await act(async () => google.signIn({ credential: 'g-token' }))

    expect(await screen.findByText('dashboard')).toBeTruthy()
    expect(store.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/oauth/token', expect.anything())
  })

  it("the exchange sends the OAuth web client's id, not Google's", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      answer(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer' }),
    )
    vi.stubGlobal('fetch', fetch)
    const google = await startGoogle(memoryStore())

    await act(async () => google.signIn({ credential: 'g-token' }))

    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ client_id: 'web-client', id_token: 'g-token' })
  })

  it('a refused Google sign-in changes nothing and says it did not complete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer(400, { error: 'invalid_grant' })))
    const store = memoryStore(earlier)
    const google = await startGoogle(store)

    await act(async () => google.signIn({ credential: 'g-token' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/Google sign-in did not complete/)
    expect(store.read()).toEqual(earlier)
    expect(screen.queryByText('dashboard')).toBeNull()
    expect(screen.getByTestId('google-button')).toBeTruthy()
  })

  it('a cancelled Google step says it did not complete and sends nothing', async () => {
    const fetch = vi.fn(async () => answer(200))
    vi.stubGlobal('fetch', fetch)
    const store = memoryStore(earlier)
    const google = await startGoogle(store)
    vi.useFakeTimers()
    vi.spyOn(document, 'hasFocus').mockReturnValueOnce(false).mockReturnValue(true)

    act(() => google.click())
    act(() => vi.advanceTimersByTime(5_000))

    expect(screen.getByRole('alert').textContent).toMatch(/Google sign-in did not complete/)
    expect(fetch).not.toHaveBeenCalled()
    expect(store.read()).toEqual(earlier)
  })

  it("Google's script failing to load says sign-in did not complete", async () => {
    const fetch = vi.fn(async () => answer(200))
    vi.stubGlobal('fetch', fetch)
    const store = memoryStore(earlier)
    renderSignIn(store)

    act(() => document.querySelector('script[src="https://accounts.google.com/gsi/client"]')?.dispatchEvent(new Event('error')))

    expect((await screen.findByRole('alert')).textContent).toMatch(/Google sign-in did not complete/)
    expect(fetch).not.toHaveBeenCalled()
    expect(store.read()).toEqual(earlier)
  })

  it("Google's script refusing to start the button says sign-in did not complete", async () => {
    const store = memoryStore(earlier)
    stubGoogle()
    vi.mocked(window.google!.accounts.id.initialize).mockImplementation(() => {
      throw new Error('invalid client_id')
    })
    renderSignIn(store)

    expect((await screen.findByRole('alert')).textContent).toMatch(/Google sign-in did not complete/)
    expect(store.read()).toEqual(earlier)
  })

  it('a sign-in that completes after focus returns is not reported as cancelled', async () => {
    let answerExchange: (response: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (answerExchange = resolve))))
    const store = memoryStore(earlier)
    const google = await startGoogle(store)
    vi.useFakeTimers()
    vi.spyOn(document, 'hasFocus').mockReturnValueOnce(false).mockReturnValue(true)

    act(() => google.click())
    act(() => vi.advanceTimersByTime(500))
    act(() => {
      google.signIn({ credential: 'g-token' })
    })
    act(() => vi.advanceTimersByTime(5_000))
    expect(screen.queryByRole('alert')).toBeNull()

    vi.useRealTimers()
    await act(async () => answerExchange(answer(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer' })))
    expect(await screen.findByText('dashboard')).toBeTruthy()
    expect(store.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
  })

  it('a sign-in that completes after the visitor left the screen still signs this device in', async () => {
    let answerExchange: (response: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => (answerExchange = resolve))))
    const store = memoryStore(earlier)
    const google = await startGoogle(store)

    act(() => {
      google.signIn({ credential: 'g-token' })
    })
    google.unmount()
    await act(async () => answerExchange(answer(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer' })))

    await waitFor(() => expect(store.read()).toEqual({ accessToken: 'a1', refreshToken: 'r1' }))
  })

  it('without a Google client id no Google button is offered', () => {
    renderSignIn(memoryStore(), { ...config, GOOGLE_CLIENT_ID: '' })
    expect(document.querySelector('script')).toBeNull()
    expect(screen.queryByTestId('google-button')).toBeNull()
  })
})
