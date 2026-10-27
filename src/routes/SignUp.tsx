import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { type FieldErrors, type SignUpInput, interruptionMessage, signUp, validateSignUp } from '../auth/credentials.ts'
import type { TokenStore } from '../auth/tokenStore.ts'
import './AuthForm.css'
import './Landing.css'
import TextField from './TextField.tsx'
import { paths } from './paths.ts'

interface SignUpProps {
  apiUrl: string
  store: TokenStore
  /** Google's sign-in button; App passes it so only these screens load Google's script. */
  google?: ReactNode
}

function SignUp({ apiUrl, store, google }: SignUpProps) {
  const navigate = useNavigate()
  const [input, setInput] = useState<SignUpInput>({ email: '', password: '', confirmation: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [alert, setAlert] = useState<ReactNode>(null)
  const [pending, setPending] = useState(false)

  const change = (field: keyof SignUpInput) => (value: string) =>
    setInput((current) => ({ ...current, [field]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAlert(null)
    const invalid = validateSignUp(input)
    setErrors(invalid)
    if (Object.keys(invalid).length > 0) return

    setPending(true)
    const result = await signUp(apiUrl, input)
    setPending(false)
    if (result.kind === 'signed-in') {
      store.save(result.pair)
      navigate(paths.dashboard, { replace: true })
    } else if (result.kind === 'fields') {
      setErrors(result.errors)
    } else if (result.kind === 'created') {
      setAlert(
        <>
          Your account was created. <Link to={paths.signIn}>Sign in</Link> to continue.
        </>,
      )
    } else if (result.kind === 'taken') {
      setAlert(
        <>
          An account with this email already exists. <Link to={paths.signIn}>Sign in</Link> instead, with Google or
          your password.
        </>,
      )
    } else {
      setAlert(interruptionMessage(result))
    }
  }

  return (
    <main className="page">
      <h1>Sign up</h1>
      {google}
      <form className="auth-form" noValidate onSubmit={submit}>
        <TextField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={input.email}
          error={errors.email}
          onChange={change('email')}
        />
        <TextField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={input.password}
          error={errors.password}
          onChange={change('password')}
        />
        <TextField
          id="confirmation"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={input.confirmation}
          error={errors.confirmation}
          onChange={change('confirmation')}
        />
        {alert && (
          <p className="auth-alert" role="alert">
            {alert}
          </p>
        )}
        <button type="submit" disabled={pending}>
          Sign up
        </button>
      </form>
      <Link to={paths.signIn}>I already have an account</Link>
      <Link to={paths.landing}>Back to the start</Link>
    </main>
  )
}

export default SignUp
