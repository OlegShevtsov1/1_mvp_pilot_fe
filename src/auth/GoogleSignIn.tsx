import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { AppConfig } from '../config.ts'
import { paths } from '../routes/paths.ts'
import { type GoogleButtonText, exchangeGoogleIdToken, loadGoogleIdentity, unloadGoogleIdentity } from './google.ts'
import type { TokenStore } from './tokenStore.ts'

const focusPollMs = 500
const cancelGraceMs = 2_000

interface GoogleSignInProps {
  config: AppConfig
  store: TokenStore
  text: GoogleButtonText
}

/**
 * Google Identity Services reports no cancel for the button flow. Google's popup takes the page's focus; focus
 * that comes back with no credential within the grace period is taken as a cancelled step. A popup that never
 * takes focus is never reported, so a cancel can be missed. A visitor who returns to this page while the popup is
 * still open is told sign-in did not complete; a credential that still arrives clears the message.
 */
function watchForCancel(onCancelled: () => void): () => void {
  let left = false
  let grace: ReturnType<typeof setTimeout> | undefined
  const poll = setInterval(() => {
    if (!document.hasFocus()) {
      left = true
    } else if (left) {
      clearInterval(poll)
      grace = setTimeout(onCancelled, cancelGraceMs)
    }
  }, focusPollMs)
  return () => {
    clearInterval(poll)
    clearTimeout(grace)
  }
}

function GoogleSignIn({ config, store, text }: GoogleSignInProps) {
  const { GOOGLE_CLIENT_ID: googleClientId, API_URL: apiUrl, OAUTH_CLIENT_ID: oauthClientId } = config
  const button = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!googleClientId) return
    let mounted = true
    let stopWatching = () => {}

    async function signIn({ credential }: { credential: string }) {
      stopWatching()
      setFailed(false)
      const pair = await exchangeGoogleIdToken({ apiUrl, clientId: oauthClientId, idToken: credential })
      if (pair) store.save(pair)
      if (!mounted) return
      if (pair) navigate(paths.dashboard, { replace: true })
      else setFailed(true)
    }

    function googleStepStarted() {
      stopWatching()
      setFailed(false)
      stopWatching = watchForCancel(() => setFailed(true))
    }

    loadGoogleIdentity()
      .then((google) => {
        if (!mounted || !button.current) return
        google.initialize({ client_id: googleClientId, callback: signIn })
        google.renderButton(button.current, { type: 'standard', text, click_listener: googleStepStarted })
      })
      .catch(() => {
        if (mounted) setFailed(true)
      })
    return () => {
      mounted = false
      stopWatching()
      unloadGoogleIdentity()
    }
  }, [googleClientId, apiUrl, oauthClientId, store, text, navigate])

  if (!googleClientId) return null
  return (
    <div className="google-sign-in">
      <div ref={button} data-testid="google-button" />
      {failed && (
        <p className="auth-alert" role="alert">
          Google sign-in did not complete. Try again, or use your email and password.
        </p>
      )}
    </div>
  )
}

export default GoogleSignIn
