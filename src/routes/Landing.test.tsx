// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Landing from './Landing.tsx'

function renderLanding(google = true) {
  const fetch = vi.fn(() => new Promise<Response>(() => {}))
  vi.stubGlobal('fetch', fetch)
  render(
    <MemoryRouter>
      <Landing google={google} />
    </MemoryRouter>,
  )
  return fetch
}

const headline = 'Every project and every task in one calm place'

describe('Landing', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('landing page explains the app and offers both starts', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(headline)
    expect(screen.getByText(/projects and their tasks in one place/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Continue with Google' }).getAttribute('href')).toBe('/sign-in')
    expect(screen.getByRole('link', { name: 'Sign up with email and password' }).getAttribute('href')).toBe('/sign-up')
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'Pilot App' }).getAttribute('href')).toBe('/')
    expect(within(header).getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
  })

  it('landing page shows no projects or tasks', () => {
    const fetch = renderLanding()
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryAllByRole('list')).toEqual([])
    expect(screen.queryAllByRole('listitem')).toEqual([])
    for (const sample of ['Website launch', 'Write the launch copy']) {
      for (const element of screen.queryAllByText(sample)) {
        expect(element.closest('[aria-hidden="true"]'), sample).not.toBeNull()
      }
    }
  })

  it('landing hero pairs the explanation with a dashboard preview and both calls to action', () => {
    renderLanding()
    const hero = screen.getByRole('region', { name: headline })
    expect(within(hero).getByText(/projects and their tasks in one place/)).toBeTruthy()
    expect(within(hero).getByRole('link', { name: 'Continue with Google' }).getAttribute('href')).toBe('/sign-in')
    expect(within(hero).getByRole('link', { name: 'Sign up with email and password' }).getAttribute('href')).toBe(
      '/sign-up',
    )
    const previews = hero.querySelectorAll('[aria-hidden="true"].landing-preview')
    expect(previews).toHaveLength(1)
    for (const status of ['todo', 'progress', 'done']) {
      expect(previews[0].querySelector(`.landing-status-${status}`), status).not.toBeNull()
    }
  })

  it('landing page presents four features', () => {
    renderLanding()
    const features = screen.getByRole('region', { name: 'Everything a personal plan needs' })
    expect(within(features).getAllByRole('heading', { level: 3 })).toHaveLength(4)
  })

  it('with Google sign-in the sign-in feature still offers Google', () => {
    renderLanding()
    const features = screen.getByRole('region', { name: 'Everything a personal plan needs' })
    expect(within(features).getByRole('heading', { level: 3, name: 'Sign in your way' })).toBeTruthy()
    expect(
      within(features).getByText('Use your Google account or an email and password; your projects stay yours.'),
    ).toBeTruthy()
  })

  it('final call to action offers both starts again', () => {
    renderLanding()
    const final = screen.getByRole('region', { name: 'Start your first project in a minute' })
    expect(within(final).getByRole('link', { name: 'Start with Google' }).getAttribute('href')).toBe('/sign-in')
    expect(within(final).getByRole('link', { name: 'Create an account with email' }).getAttribute('href')).toBe(
      '/sign-up',
    )
  })
})

describe('Landing without Google sign-in', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('without Google sign-in the landing never mentions Google', () => {
    renderLanding(false)
    expect(document.body.textContent).not.toMatch(/google/i)
    expect(screen.queryByRole('link', { name: /google/i })).toBeNull()
  })

  it.each([headline, 'Start your first project in a minute'])(
    'without Google sign-in the starts in "%s" are email ones',
    (region) => {
      renderLanding(false)
      const section = screen.getByRole('region', { name: region })
      expect(within(section).getByRole('link', { name: 'Sign up' }).getAttribute('href')).toBe('/sign-up')
      expect(within(section).getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/sign-in')
    },
  )

  it('without Google sign-in the sign-in feature speaks of email and password only', () => {
    renderLanding(false)
    const features = screen.getByRole('region', { name: 'Everything a personal plan needs' })
    expect(within(features).getAllByRole('heading', { level: 3 })).toHaveLength(4)
    expect(within(features).getByText('Use your email and password; your projects stay yours.')).toBeTruthy()
  })
})
