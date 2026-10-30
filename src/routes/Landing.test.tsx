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

  it('landing page is drawn in the always-dark landing palette', () => {
    renderLanding()
    const root = screen.getByRole('main').closest('.palette-landing')
    expect(root).not.toBeNull()
    expect(root!.contains(screen.getByRole('banner'))).toBe(true)
  })

  it('landing hero opens with the badge above the one headline', () => {
    renderLanding()
    const hero = screen.getByRole('region', { name: headline })
    const badge = within(hero).getByText('Personal projects and tasks')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(badge.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('landing preview shows a status chip on every task, hidden from assistive technology', () => {
    renderLanding()
    const preview = screen.getByRole('region', { name: headline }).querySelector('.landing-preview')!
    expect(preview.getAttribute('aria-hidden')).toBe('true')
    const chips = [...preview.querySelectorAll('.landing-chip')].map((chip) => chip.textContent)
    expect(chips).toEqual(['Completed', 'In progress', 'Not started', 'Not started'])
  })

  it('landing page presents four features', () => {
    renderLanding()
    const features = screen.getByRole('region', { name: 'Everything a personal plan needs' })
    expect(within(features).getAllByRole('heading', { level: 3 })).toHaveLength(4)
  })

  it('features section opens with its eyebrow and the sub-line under its heading', () => {
    renderLanding()
    const features = screen.getByRole('region', { name: 'Everything a personal plan needs' })
    expect(within(features).getByText('Features')).toBeTruthy()
    expect(
      within(features).getByText('Projects, tasks and three statuses. Nothing you have to set up first.'),
    ).toBeTruthy()
  })

  it('"How it works" shows the three steps from a first idea to done', () => {
    renderLanding()
    const steps = screen.getByRole('region', { name: 'From a first idea to done in three steps' })
    expect(within(steps).getByText('How it works')).toBeTruthy()
    const items = within(steps).getAllByRole('article')
    expect(items.map((item) => within(item).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Create a project',
      'Add its tasks',
      'Move them to done',
    ])
    expect(within(steps).getByText('Give it a name and, if you like, a short description.')).toBeTruthy()
    expect(within(steps).getByText('Every new task starts as not started.')).toBeTruthy()
    expect(
      within(steps).getByText('Mark a task in progress, then completed, and filter to see what is left.'),
    ).toBeTruthy()
  })

  it('final call to action says the projects stay private', () => {
    renderLanding()
    const final = screen.getByRole('region', { name: 'Start your first project in a minute' })
    expect(within(final).getByText('Your projects and tasks are visible only to you.')).toBeTruthy()
  })

  it('every call to action on the landing page leads only to sign-up or sign-in', () => {
    renderLanding()
    const hrefs = within(screen.getByRole('main'))
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))
    expect(hrefs.length).toBeGreaterThan(0)
    expect(hrefs.filter((href) => href !== '/sign-up' && href !== '/sign-in')).toEqual([])
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

describe('Landing footer', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it.each([true, false])('the landing footer links to the privacy policy and the terms of use (Google %s)', (google) => {
    renderLanding(google)
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy policy' }).getAttribute('href')).toBe('/privacy')
    expect(within(legal).getByRole('link', { name: 'Terms of use' }).getAttribute('href')).toBe('/terms')
  })
})

describe('Landing footer bar', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('the footer shows the brand beside the legal links, as text rather than a second home link', () => {
    renderLanding()
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    const bar = legal.closest('.site-footer-bar')
    expect(bar).not.toBeNull()
    expect(within(bar as HTMLElement).getByText('Pilot App').closest('a')).toBeNull()
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
