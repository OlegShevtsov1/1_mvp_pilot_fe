import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { type SignInInput, interruptionMessage, signIn } from '../auth/credentials.ts'
import type { TokenStore } from '../auth/tokenStore.ts'
import { AuthAlert, AuthLayout } from './AuthLayout.tsx'
import TextField from './TextField.tsx'
import { paths } from './paths.ts'

interface SignInProps {
  apiUrl: string
  /** The public uid of the OAuth web application (contract `TokenRequest.client_id`). */
  clientId: string
  store: TokenStore
  /** Google's sign-in button; App passes it so only these screens load Google's script. */
  google?: ReactNode
}

function SignIn({ apiUrl, clientId, store, google }: SignInProps) {
  const navigate = useNavigate()
  const [input, setInput] = useState<SignInInput>({ email: '', password: '' })
  const [alert, setAlert] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const change = (field: keyof SignInInput) => (value: string) =>
    setInput((current) => ({ ...current, [field]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAlert(null)
    setPending(true)
    const result = await signIn(apiUrl, clientId, input)
    setPending(false)
    if (result.kind === 'signed-in') {
      store.save(result.pair)
      navigate(paths.dashboard, { replace: true })
    } else if (result.kind === 'refused') {
      setAlert('Wrong email or password.')
    } else {
      setAlert(interruptionMessage(result))
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      switchLink={
        <Link className="link" to={paths.signUp}>
          Create an account
        </Link>
      }
      google={google}
    >
      <form className="auth-card-form" noValidate onSubmit={submit}>
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={input.email}
          onChange={change('email')}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={input.password}
          onChange={change('password')}
        />
        {alert && <AuthAlert tone="error">{alert}</AuthAlert>}
        <button className="button button-primary button-block" type="submit" disabled={pending}>
          Sign in
        </button>
      </form>
    </AuthLayout>
  )
}

export default SignIn
