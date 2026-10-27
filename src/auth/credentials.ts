import { type ApiClient, postJson, requestToken } from '../api/client.ts'
import { type TokenPair, tokenPairFrom } from './tokenStore.ts'

export type Field = 'email' | 'password' | 'confirmation'
export type FieldErrors = Partial<Record<Field, string>>

export interface SignUpInput {
  email: string
  password: string
  confirmation: string
}

export interface SignInInput {
  email: string
  password: string
}

type SignedIn = { kind: 'signed-in'; pair: TokenPair }
/** The attempt was not judged: too many attempts (`429`, `Retry-After` seconds when usable) or no usable answer. */
export type Interrupted = { kind: 'wait'; seconds: number | null } | { kind: 'failed' }
/** `created`: the account exists but no token pair was issued (ADR-0008: no web client configured on this deploy). */
export type SignUpResult =
  | SignedIn
  | Interrupted
  | { kind: 'created' }
  | { kind: 'fields'; errors: FieldErrors }
  | { kind: 'taken' }
export type SignInResult = SignedIn | Interrupted | { kind: 'refused' }

const fieldMessages: Record<Field, string> = {
  email: 'Enter an email address like name@example.com.',
  password: 'Password must be at least 6 characters.',
  confirmation: 'The passwords do not match.',
}

// Devise's default email check, so the client never blocks an address the server accepts.
const emailPattern = /^[^@\s]+@[^@\s]+$/
// Contract `UserCreate.password` `minLength` and `maxLength`, counted in characters as the server does.
const minPasswordLength = 6
const maxPasswordLength = 128
const passwordTooLong = `Password must be at most ${maxPasswordLength} characters.`

export function validateSignUp({ email, password, confirmation }: SignUpInput): FieldErrors {
  const errors: FieldErrors = {}
  if (!emailPattern.test(email)) errors.email = fieldMessages.email
  const passwordLength = [...password].length
  if (passwordLength < minPasswordLength) errors.password = fieldMessages.password
  if (passwordLength > maxPasswordLength) errors.password = passwordTooLong
  if (confirmation !== password) errors.confirmation = fieldMessages.confirmation
  return errors
}

export function interruptionMessage(result: Interrupted): string {
  if (result.kind === 'failed') return 'Something went wrong. Try again.'
  const wait = result.seconds === null ? 'a minute' : `${result.seconds} second${result.seconds === 1 ? '' : 's'}`
  return `Too many attempts. Wait ${wait} and try again.`
}

function signedIn(body: unknown): SignedIn | Interrupted {
  const pair = tokenPairFrom(body)
  return pair ? { kind: 'signed-in', pair } : { kind: 'failed' }
}

function waitFor(response: Response): Interrupted {
  const seconds = Number(response.headers.get('Retry-After') ?? '')
  return { kind: 'wait', seconds: Number.isInteger(seconds) && seconds > 0 ? seconds : null }
}

// Longest prefix first: "Password confirmation …" also starts with "Password".
const fieldPrefixes: [string, Field][] = [
  ['Password confirmation', 'confirmation'],
  ['Password', 'password'],
  ['Email', 'email'],
]

/** Maps the Rails full messages of a `422 ErrorList` to the fields they name; any other message fails the attempt. */
function refusedSignUp(body: unknown): SignUpResult {
  const errors = typeof body === 'object' && body !== null && 'errors' in body ? body.errors : null
  if (!Array.isArray(errors) || errors.length === 0) return { kind: 'failed' }
  const fields: FieldErrors = {}
  for (const message of errors) {
    if (typeof message !== 'string') return { kind: 'failed' }
    if (message.startsWith('Email') && message.includes('taken')) return { kind: 'taken' }
    const field = fieldPrefixes.find(([prefix]) => message.startsWith(prefix))?.[1]
    if (!field) return { kind: 'failed' }
    fields[field] = fieldMessages[field]
  }
  return { kind: 'fields', errors: fields }
}

/** Contract operation `createUser`; a `201` answer with a token pair signs this device in. */
export async function signUp(apiUrl: string, input: SignUpInput, fetchFn: typeof fetch = fetch): Promise<SignUpResult> {
  try {
    const response = await postJson(
      `${apiUrl}/api/v1/users`,
      { user: { email: input.email, password: input.password, password_confirmation: input.confirmation } },
      fetchFn,
    )
    if (response.status === 201) {
      const body: unknown = await response.json()
      const pair = tokenPairFrom(typeof body === 'object' && body !== null && 'data' in body ? body.data : null)
      return pair ? { kind: 'signed-in', pair } : { kind: 'created' }
    }
    if (response.status === 422) return refusedSignUp(await response.json())
    if (response.status === 429) return waitFor(response)
    return { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/**
 * Contract operation `createToken` with the password grant. A `400` is one refusal for a wrong email and a wrong
 * password (AC-09), so its body is never read.
 */
export async function signIn(
  apiUrl: string,
  clientId: string,
  { email, password }: SignInInput,
  fetchFn: typeof fetch = fetch,
): Promise<SignInResult> {
  try {
    const response = await requestToken(
      apiUrl,
      { grant_type: 'password', client_id: clientId, username: email, password },
      fetchFn,
    )
    if (response.status === 200) return signedIn(await response.json())
    if (response.status === 400) return { kind: 'refused' }
    if (response.status === 429) return waitFor(response)
    return { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/**
 * Contract operation `signOut`, revoking this device's tokens only. The access token is read when it is called, so
 * the caller may clear the store at once. An expired token is renewed once with this session's own refresh token, never
 * with another session's pair. It never throws: the device signs out locally whatever the server answers.
 */
export async function signOut(api: ApiClient): Promise<void> {
  try {
    await api.request('/api/v1/sign_out', { method: 'POST', once: true })
  } catch {
    // Signed out locally; the server tokens expire on their own.
  }
}
