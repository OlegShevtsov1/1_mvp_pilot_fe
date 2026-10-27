// @vitest-environment jsdom
import * as Sentry from '@sentry/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import App from './App.tsx'
import type { AppConfig } from './config.ts'

const config: AppConfig = {
  API_URL: 'https://api.example.test',
  SENTRY_DSN: '',
  ENV_NAME: 'dev',
  APP_VERSION: 'sha-abc123',
  GOOGLE_CLIENT_ID: '',
  OAUTH_CLIENT_ID: '',
}

function stubFetch(impl: () => Promise<Response>) {
  const fetch = vi.fn(impl)
  vi.stubGlobal('fetch', fetch)
  return fetch
}

// React reports an error thrown during render to console.error and, in development,
// as a window "error" event that jsdom prints. Both are expected in boundary tests.
function silenceRenderErrorReports() {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const swallow = (event: ErrorEvent) => event.preventDefault()
  window.addEventListener('error', swallow)
  onTestFinished(() => window.removeEventListener('error', swallow))
}

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.pushState({}, '', '/')
    document.head.querySelectorAll('script[src*="accounts.google.com"]').forEach((script) => script.remove())
    delete window.google
  })

  it('renders the landing page and the runtime config', () => {
    stubFetch(() => new Promise(() => {}))
    render(<App config={config} errorTest={null} />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Every project and every task in one calm place',
    )
    expect(screen.getByText('API: https://api.example.test')).toBeTruthy()
    expect(screen.getByText('Environment: dev')).toBeTruthy()
  })

  it.each(['prod', 'unknown'])('hides the debug footer and skips the health check when ENV_NAME is %s', (envName) => {
    const fetch = stubFetch(async () => Response.json({ status: 'ok' }))
    render(<App config={{ ...config, ENV_NAME: envName }} errorTest={null} />)
    expect(screen.queryByTestId('api-status')).toBeNull()
    expect(screen.queryByText(/^API:/)).toBeNull()
    expect(screen.queryByRole('contentinfo')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('unknown paths fall back to the landing page', () => {
    stubFetch(() => new Promise(() => {}))
    window.history.pushState({}, '', '/no-such-page')
    render(<App config={config} errorTest={null} />)
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeTruthy()
  })

  it.each([
    ['Continue with Google', 'Sign in'],
    ['Sign up with email and password', 'Sign up'],
  ])('the "%s" start opens the %s screen', (link, title) => {
    stubFetch(() => new Promise(() => {}))
    render(<App config={config} errorTest={null} />)
    fireEvent.click(screen.getByRole('link', { name: link }))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title)
  })

  it('a visitor on the landing page loads no project data', async () => {
    const fetch = stubFetch(async () => Response.json({ status: 'ok' }))
    render(<App config={config} errorTest={null} />)
    await screen.findByText('API status: ok')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/health', expect.anything())
  })

  it('a signed-out visitor opening /dashboard is sent to sign-in', async () => {
    const fetch = stubFetch(async () => Response.json({ status: 'ok' }))
    window.history.pushState({}, '', '/dashboard')
    render(<App config={config} errorTest={null} />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Sign in')
    await screen.findByText('API status: ok')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/health', expect.anything())
  })

  it('shows the status the backend reports from /health', async () => {
    const fetch = stubFetch(async () => Response.json({ status: 'ok' }))
    render(<App config={config} errorTest={null} />)
    expect((await screen.findByText('API status: ok')).dataset.testid).toBe('api-status')
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/health', expect.anything())
  })

  it('reports the API as unreachable when the request fails', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    render(<App config={config} errorTest={null} />)
    expect(await screen.findByText('API status: unreachable')).toBeTruthy()
  })

  it('reports the API as unreachable on a non-2xx response', async () => {
    stubFetch(async () => new Response('down', { status: 503 }))
    render(<App config={config} errorTest={null} />)
    expect(await screen.findByText('API status: unreachable')).toBeTruthy()
  })

  it('does not call the API when no API_URL is configured', () => {
    const fetch = stubFetch(async () => Response.json({ status: 'ok' }))
    render(<App config={{ ...config, API_URL: '' }} errorTest={null} />)
    expect(screen.getByTestId('api-status').textContent).toBe('API status: not configured')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('breaks rendering for the render error test so the boundary fallback shows', () => {
    stubFetch(() => new Promise(() => {}))
    silenceRenderErrorReports()
    render(
      <Sentry.ErrorBoundary fallback={<p role="alert">fallback</p>}>
        <App config={config} errorTest={{ kind: 'render', marker: 'm1' }} />
      </Sentry.ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toBe('fallback')
  })

  it("Google's script is loaded on the sign-in and sign-up screens only", () => {
    stubFetch(() => new Promise(() => {}))
    const withGoogle = { ...config, GOOGLE_CLIENT_ID: 'client-id.apps.example.test' }
    const googleScript = () => document.querySelector('script[src="https://accounts.google.com/gsi/client"]')

    render(<App config={withGoogle} errorTest={null} />)
    expect(googleScript()).toBeNull()
    cleanup()

    for (const path of ['/sign-in', '/sign-up']) {
      window.history.pushState({}, '', path)
      render(<App config={withGoogle} errorTest={null} />)
      expect(googleScript()).not.toBeNull()
      cleanup()
      googleScript()?.remove()
    }
  })

  it("leaving the sign-in screen removes Google's script", async () => {
    stubFetch(() => new Promise(() => {}))
    const googleScript = () => document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    window.history.pushState({}, '', '/sign-in')
    render(<App config={{ ...config, GOOGLE_CLIENT_ID: 'client-id.apps.example.test' }} errorTest={null} />)
    expect(googleScript()).not.toBeNull()

    fireEvent.click(screen.getByRole('link', { name: 'Back to the start' }))

    expect(await screen.findByRole('link', { name: 'Continue with Google' })).toBeTruthy()
    expect(googleScript()).toBeNull()
  })
})
