// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../auth/tokenStore.testSupport.ts'
import SignIn from './SignIn.tsx'

function renderSignIn(response: Response, google?: ReactNode) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response)
  vi.stubGlobal('fetch', fetch)
  const store = memoryStore()
  render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route
          path="/sign-in"
          element={<SignIn apiUrl="https://api.example.test" clientId="web-client" store={store} google={google} />}
        />
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  return { fetch, store }
}

function submit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('SignIn', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("correct email and password store this device's pair and open the dashboard", async () => {
    const pair = { access_token: 'a1', refresh_token: 'r1', token_type: 'Bearer', expires_in: 3600, created_at: 1 }
    const { fetch, store } = renderSignIn(Response.json(pair))

    submit('user@example.test', 'secret1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy()
    expect(store.pair).toEqual({ accessToken: 'a1', refreshToken: 'r1' })
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({
      grant_type: 'password',
      client_id: 'web-client',
    })
  })

  it('wrong email and wrong password show the same message', async () => {
    const messages = []
    for (const description of ['No user has this email.', 'The password is wrong.']) {
      const refusal = Response.json({ error: 'invalid_grant', error_description: description }, { status: 400 })
      const { store } = renderSignIn(refusal)
      submit('user@example.test', 'wrong-password')
      messages.push((await screen.findByRole('alert')).textContent)
      expect(store.pair).toBeNull()
      cleanup()
    }
    expect(messages).toEqual(['Wrong email or password.', 'Wrong email or password.'])
  })

  it('a rate-limited attempt tells the visitor how long to wait', async () => {
    const tooMany = Response.json(
      { errors: ['Too many attempts, try again later'] },
      { status: 429, headers: { 'Retry-After': '30' } },
    )
    const { store } = renderSignIn(tooMany)

    submit('user@example.test', 'secret1')

    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Wait 30 seconds and try again.')
    expect(store.pair).toBeNull()
  })

  it('shows the brand at the top, linking back to the start', () => {
    renderSignIn(Response.json({}))

    const brand = within(screen.getByRole('banner')).getByRole('link', { name: 'Pilot App' })
    expect(brand.getAttribute('href')).toBe('/')
    expect(brand.querySelector('svg.brand-mark')).not.toBeNull()
  })

  it('one card holds the title with the link to create an account in its head, the fields and the button', () => {
    renderSignIn(Response.json({}))

    const card = screen.getByRole('region', { name: 'Sign in' })
    const head = within(card).getByRole('heading', { level: 1, name: 'Sign in' }).parentElement!
    expect(within(head).getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe('/sign-up')
    for (const label of ['Email', 'Password']) expect(within(card).getByLabelText(label)).toBeTruthy()
    expect(within(card).getByRole('button', { name: 'Sign in' })).toBeTruthy()
    expect(within(card).queryByRole('link', { name: 'Back to the start' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Back to the start' }).getAttribute('href')).toBe('/')
  })

  it('shows the "or with email" divider only when Google is offered', () => {
    renderSignIn(Response.json({}))
    expect(screen.queryByText('or with email')).toBeNull()
    cleanup()

    renderSignIn(Response.json({}), <div data-testid="google-button" />)
    const card = screen.getByRole('region', { name: 'Sign in' })
    const google = within(card).getByTestId('google-button')
    const divider = within(card).getByText('or with email')
    const form = card.querySelector('form')!
    expect(google.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(divider.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('wrong credentials show an error alert right above the full-width button', async () => {
    renderSignIn(Response.json({ error: 'invalid_grant', error_description: 'The password is wrong.' }, { status: 400 }))

    submit('user@example.test', 'wrong-password')

    const alert = await screen.findByRole('alert')
    expect(alert.className).toContain('alert-error')
    const button = screen.getByRole('button', { name: 'Sign in' })
    expect(alert.nextElementSibling).toBe(button)
    expect(button.className).toContain('button-block')
  })

  it('sign-in links to the privacy policy and the terms of use', () => {
    renderSignIn(Response.json({}))
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy policy' }).getAttribute('href')).toBe('/privacy')
    expect(within(legal).getByRole('link', { name: 'Terms of use' }).getAttribute('href')).toBe('/terms')
  })
})
