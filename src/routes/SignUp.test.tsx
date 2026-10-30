// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../auth/tokenStore.testSupport.ts'
import SignUp from './SignUp.tsx'

function renderSignUp(response?: Response, google?: ReactNode) {
  const fetch = vi.fn(async () => response ?? new Response(null, { status: 500 }))
  vi.stubGlobal('fetch', fetch)
  const store = memoryStore()
  render(
    <MemoryRouter initialEntries={['/sign-up']}>
      <Routes>
        <Route path="/sign-up" element={<SignUp apiUrl="https://api.example.test" store={store} google={google} />} />
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

  it('without Google a taken email says to sign in with the password', async () => {
    const { store } = renderSignUp(refused(['Email has already been taken']))

    submit('taken@example.test', 'secret1', 'secret1')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('An account with this email already exists.')
    expect(alert.textContent).toContain('Sign in instead with your password.')
    expect(alert.textContent).not.toMatch(/google/i)
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign up')
    expect(store.pair).toBeNull()
  })

  it('with Google offered a taken email says to sign in with Google or the password', async () => {
    const { store } = renderSignUp(refused(['Email has already been taken']), <div data-testid="google-button" />)

    submit('taken@example.test', 'secret1', 'secret1')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('An account with this email already exists.')
    expect(alert.textContent).toContain('Sign in instead, with Google or your password.')
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign up')
    expect(store.pair).toBeNull()
  })

  it('too many sign-ups from this source tell the visitor how long to wait and change nothing else (AC-04b)', async () => {
    const tooMany = Response.json(
      { errors: ['Too many attempts, try again later'] },
      { status: 429, headers: { 'Retry-After': '30' } },
    )
    const { fetch, store } = renderSignUp(tooMany)

    submit('new@example.test', 'secret1', 'secret1')

    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Wait 30 seconds and try again.')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(store.pair).toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sign up')
    for (const label of ['Email', 'Password', 'Confirm password']) {
      expect(screen.getByLabelText(label).getAttribute('aria-invalid')).toBeNull()
    }
    expect(screen.getByRole('button', { name: 'Sign up' }).hasAttribute('disabled')).toBe(false)
  })

  it('shows the brand at the top, linking back to the start', () => {
    renderSignUp()

    const brand = within(screen.getByRole('banner')).getByRole('link', { name: 'Pilot App' })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.querySelector('svg.brand-mark')).not.toBeNull()
  })

  it('one card holds the title with the link to sign in in its head, the fields and the button', () => {
    renderSignUp()

    const card = screen.getByRole('region', { name: 'Sign up' })
    const head = within(card).getByRole('heading', { level: 1, name: 'Sign up' }).parentElement!
    expect(within(head).getByRole('link', { name: 'I already have an account' }).getAttribute('href')).toBe('/sign-in')
    for (const label of ['Email', 'Password', 'Confirm password']) expect(within(card).getByLabelText(label)).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Sign up' })).toBeTruthy()
    expect(within(card).queryByRole('link', { name: 'Back to the start' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to the start' }).getAttribute('href')).toBe('/')
  })

  it('shows the "or with email" divider only when Google is offered', () => {
    renderSignUp()
    expect(screen.queryByText('or with email')).toBeNull()
    cleanup()

    renderSignUp(undefined, <div data-testid="google-button" />)
    const card = screen.getByRole('region', { name: 'Sign up' })
    const google = within(card).getByTestId('google-button')
    const divider = within(card).getByText('or with email')
    const form = card.querySelector('form')!
    expect(google.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(divider.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a field message carries a decorative icon inside its paragraph', () => {
    renderSignUp()

    submit('not-an-email', 'short', 'other')

    const message = screen.getByText('Enter an email address like name@example.com.')
    expect(message.closest('p')?.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toBe(message.closest('p')?.id)
  })

  it('the account-created message is an info alert and the taken email an error alert', async () => {
    const data = { user_id: 7, email: 'new@example.test', authentication_token: 'legacy' }
    renderSignUp(Response.json({ status: 'success', message: 'ok', data }, { status: 201 }))
    submit('new@example.test', 'secret1', 'secret1')
    expect((await screen.findByRole('alert')).className).toContain('alert-info')
    cleanup()

    renderSignUp(refused(['Email has already been taken']))
    submit('taken@example.test', 'secret1', 'secret1')
    expect((await screen.findByRole('alert')).className).toContain('alert-error')
  })

  it('sign-up links to the privacy policy and the terms of use', () => {
    renderSignUp()
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy policy' }).getAttribute('href')).toBe('/privacy')
    expect(within(legal).getByRole('link', { name: 'Terms of use' }).getAttribute('href')).toBe('/terms')
  })
})
