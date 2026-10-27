// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../auth/tokenStore.testSupport.ts'
import SignIn from './SignIn.tsx'

function renderSignIn(response: Response) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response)
  vi.stubGlobal('fetch', fetch)
  const store = memoryStore()
  render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route
          path="/sign-in"
          element={<SignIn apiUrl="https://api.example.test" clientId="web-client" store={store} />}
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
})
