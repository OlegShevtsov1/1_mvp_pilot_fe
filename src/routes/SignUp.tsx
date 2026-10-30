import { type FormEvent, type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { type FieldErrors, type SignUpInput, interruptionMessage, signUp, validateSignUp } from '../auth/credentials.ts'
import type { TokenStore } from '../auth/tokenStore.ts'
import { AuthAlert, AuthLayout } from './AuthLayout.tsx'
import TextField from './TextField.tsx'
import { paths } from './paths.ts'

interface SignUpProps {
  apiUrl: string
  store: TokenStore
  /**
   * Google's sign-in button; App passes it so only these screens load Google's script, and only when Google
   * sign-in is offered, so its presence also decides whether the taken-email message mentions Google.
   */
  google?: ReactNode
}

function SignUp({ apiUrl, store, google }: SignUpProps) {
  const navigate = useNavigate()
  const [input, setInput] = useState<SignUpInput>({ email: '', password: '', confirmation: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [alert, setAlert] = useState<ReactNode>(null)
  const [created, setCreated] = useState(false)
  const [pending, setPending] = useState(false)

  const change = (field: keyof SignUpInput) => (value: string) =>
    setInput((current) => ({ ...current, [field]: value }))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAlert(null)
    setCreated(false)
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
      setCreated(true)
      setAlert(
        <>
          Your account was created. <Link to={paths.signIn}>Sign in</Link> to continue.
        </>,
      )
    } else if (result.kind === 'taken') {
      setAlert(
        <>
          An account with this email already exists. <Link to={paths.signIn}>Sign in</Link> instead
          {google ? ', with Google or your password.' : ' with your password.'}
        </>,
      )
    } else {
      setAlert(interruptionMessage(result))
    }
  }

  return (
    <AuthLayout
      title="Sign up"
      switchLink={
        <Link className="link" to={paths.signIn}>
          I already have an account
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
        {alert && <AuthAlert tone={created ? 'info' : 'error'}>{alert}</AuthAlert>}
        <button className="button button-primary button-block" type="submit" disabled={pending}>
          Sign up
        </button>
      </form>
    </AuthLayout>
  )
}

export default SignUp
