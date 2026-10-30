import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import './App.css'
import GoogleSignIn from './auth/GoogleSignIn.tsx'
import type { GoogleButtonText } from './auth/google.ts'
import { createTokenStore } from './auth/tokenStore.ts'
import type { AppConfig } from './config.ts'
import type { ErrorTest } from './errorTest.ts'
import Dashboard from './routes/Dashboard.tsx'
import Landing from './routes/Landing.tsx'
import { Privacy, Terms } from './routes/Legal.tsx'
import SignIn from './routes/SignIn.tsx'
import SignUp from './routes/SignUp.tsx'
import { paths } from './routes/paths.ts'

interface AppProps {
  config: AppConfig
  errorTest: ErrorTest | null
}

function RenderErrorTest({ marker }: { marker: string }): never {
  throw new Error(`error-test render ${marker}`)
}

async function fetchApiStatus(apiUrl: string, signal: AbortSignal): Promise<string> {
  try {
    const response = await fetch(`${apiUrl}/health`, { signal })
    if (!response.ok) return 'unreachable'
    const body: unknown = await response.json()
    const reported = typeof body === 'object' && body !== null && 'status' in body ? body.status : null
    return typeof reported === 'string' ? reported : 'unreachable'
  } catch {
    return 'unreachable'
  }
}

function App({ config, errorTest }: AppProps) {
  const apiUrl = config.API_URL
  const debug = config.ENV_NAME === 'dev'
  const google = Boolean(config.GOOGLE_CLIENT_ID)
  const [apiStatus, setApiStatus] = useState(apiUrl ? 'checking…' : 'not configured')
  const [store] = useState(createTokenStore)
  /** Google's button for sign-up or sign-in, or nothing when Google sign-in is not configured. */
  const googleButton = (text: GoogleButtonText) =>
    google ? <GoogleSignIn config={config} store={store} text={text} /> : undefined

  useEffect(() => {
    if (!apiUrl || !debug) return
    const controller = new AbortController()
    fetchApiStatus(apiUrl, controller.signal).then((status) => {
      if (!controller.signal.aborted) setApiStatus(status)
    })
    return () => controller.abort()
  }, [apiUrl, debug])

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path={paths.landing} element={<Landing google={google} />} />
          <Route
            path={paths.signUp}
            element={
              <SignUp
                apiUrl={apiUrl}
                store={store}
                google={googleButton('signup_with')}
              />
            }
          />
          <Route
            path={paths.signIn}
            element={
              <SignIn
                apiUrl={apiUrl}
                clientId={config.OAUTH_CLIENT_ID}
                store={store}
                google={googleButton('signin_with')}
              />
            }
          />
          <Route
            path={paths.dashboard}
            element={<Dashboard apiUrl={apiUrl} clientId={config.OAUTH_CLIENT_ID} store={store} />}
          />
          <Route path={paths.privacy} element={<Privacy contact={config.SUPPORT_EMAIL} />} />
          <Route path={paths.terms} element={<Terms contact={config.SUPPORT_EMAIL} />} />
          <Route path="*" element={<Landing google={google} />} />
        </Routes>
      </BrowserRouter>
      {debug && (
        <footer className="App-footer">
          <p className="api-info">API: {apiUrl || 'not configured'}</p>
          <p className="api-info">Environment: {config.ENV_NAME}</p>
          <p className="api-info" data-testid="api-status">API status: {apiStatus}</p>
        </footer>
      )}
      {errorTest?.kind === 'render' && <RenderErrorTest marker={errorTest.marker} />}
    </div>
  )
}

export default App
