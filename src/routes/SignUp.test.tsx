// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../auth/tokenStore.testSupport.ts'
import SignUp from './SignUp.tsx'

function renderSignUp(response?: Response) {
  const fetch = vi.fn(async () => response ?? new Response(null, { status: 500 }))
  vi.stubGlobal('fetch', fetch)
  const store = memoryStore()
  render(
    <MemoryRouter initialEntries={['/sign-up']}>
      <Routes>
        <Route path="/sign-up" element={<SignUp apiUrl="https://api.example.test" store={store} />} />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  return { fetch, store }
}

function submit(email: string, password: string, confirmation: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
}

const refused = (errors: string[]) =>
  Response.json({ status: 'error', message: 'User could not be created', errors }, { status: 422 })

describe('SignUp', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('sign-up with a new email stores the token pair and opens the dashboard', async () => {
    const data = { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer', expires_in: 3600, created_at: 1 }
    const { store } = renderSignUp(Response.json({ status: 'success', message: 'ok', data }, { status: 201 }))

    submit('new@example.test', 'secret1', 'secret1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    expect(store.pair).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
  })

  it('a sign-up answered without a token pair says the account exists and links to sign in', async () => {
    const data = { user_id: 7, email: 'new@example.test', authentication_token: 'legacy' }
    const { store } = renderSignUp(Response.json({ status: 'success', message: 'ok', data }, { status: 201 }))

    submit('new@example.test', 'secret1', 'secret1')

    expect((await screen.findByRole('alert')).textContent).toBe('Your account was created. Sign in to continue.')
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
    expect(store.pair).toBeNull()
  })

  it('invalid fields are named with what they must be and nothing is sent', () => {
    const { fetch, store } = renderSignUp()

    submit('not-an-email', 'short', 'other')

    expect(screen.getByText('Enter an email address like name@example.com.')).toBeTruthy()
    expect(screen.getByText('Password must be at least 6 characters.')).toBeTruthy()
    expect(screen.getByText('The passwords do not match.')).toBeTruthy()
    for (const label of ['Email', 'Password', 'Confirm password']) {
      expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBe('true')
    }
    expect(fetch).not.toHaveBeenCalled()
    expect(store.pair).toBeNull()
  })

  it('a field error from the server is shown under that field', async () => {
    const { store } = renderSignUp(refused(['Password is too short (minimum is 6 characters)']))

    submit('new@example.test', 'secret1', 'secret1')

    expect(await screen.findByText('Password must be at least 6 characters.')).toBeTruthy()
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign up')
    expect(store.pair).toBeNull()
  })

  it('a taken email says an account exists and links to sign in', async () => {
    const { store } = renderSignUp(refused(['Email has already been taken']))

    submit('taken@example.test', 'secret1', 'secret1')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('An account with this email already exists.')
    expect(alert.textContent).toContain('Sign in instead, with Google or your password.')
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign up')
    expect(store.pair).toBeNull()
  })
})
