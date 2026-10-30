// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { Privacy, Terms } from './Legal.tsx'

function renderPage(page: ReactElement) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

const privacySections = [
  'Who runs this service',
  'What we store and why',
  'Error reports',
  'Who we share data with',
  'How long we keep data',
  'Access and deletion',
  'Changes to this policy',
]
const termsSections = ['The service', 'Acceptable use', 'Accounts', 'Contact']

function sectionNames() {
  return screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
}

describe('Privacy', () => {
  afterEach(cleanup)

  it('the privacy policy covers who runs the service, stored data, error reports, sharing, retention, access and deletion, and changes', () => {
    renderPage(<Privacy contact="" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Privacy policy')
    expect(sectionNames()).toEqual(privacySections)
    expect(screen.getByText('Effective 29 October 2026.')).toBeTruthy()
    expect(document.body.textContent).toMatch(/Pilot Todolist/)
    expect(document.body.textContent).toMatch(/GlitchTip/)
    expect(document.body.textContent).toMatch(/kept only as a hash/)
    expect(document.body.textContent).toMatch(/do not sell your data/)
  })

  it('with SUPPORT_EMAIL the privacy policy offers that address for access and deletion', () => {
    renderPage(<Privacy contact="support@example.test" />)
    expect(screen.getByRole('link', { name: 'support@example.test' }).getAttribute('href')).toBe(
      'mailto:support@example.test',
    )
    expect(document.body.textContent).toMatch(/no way to delete an account in the app/)
  })

  it('without SUPPORT_EMAIL the privacy policy says to contact the operator of this deployment', () => {
    const { container } = renderPage(<Privacy contact="" />)
    expect(screen.getByText(/contact the operator of this deployment/)).toBeTruthy()
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
  })
})

describe('Terms', () => {
  afterEach(cleanup)

  it('the terms of use cover the service, acceptable use, accounts and contact', () => {
    renderPage(<Terms contact="" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Terms of use')
    expect(sectionNames()).toEqual(termsSections)
    expect(document.body.textContent).toMatch(/as is/)
    expect(document.body.textContent).toMatch(/rate limits/)
    expect(document.body.textContent).toMatch(/scrape/)
  })

  it('with SUPPORT_EMAIL the terms of use offer that address', () => {
    renderPage(<Terms contact="support@example.test" />)
    expect(screen.getByRole('link', { name: 'support@example.test' }).getAttribute('href')).toBe(
      'mailto:support@example.test',
    )
  })

  it('without SUPPORT_EMAIL the terms of use say to contact the operator of this deployment', () => {
    const { container } = renderPage(<Terms contact="" />)
    expect(screen.getByText(/contact the operator of this deployment/)).toBeTruthy()
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull()
  })
})

describe.each([
  ['Privacy', <Privacy contact="" />],
  ['Terms', <Terms contact="" />],
])('%s page chrome', (_name, page) => {
  afterEach(cleanup)

  it('carries the site header and the legal footer', () => {
    renderPage(page)
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'Pilot App' }).getAttribute('href')).toBe('/')
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    expect(within(legal).getByRole('link', { name: 'Privacy policy' }).getAttribute('href')).toBe('/privacy')
    expect(within(legal).getByRole('link', { name: 'Terms of use' }).getAttribute('href')).toBe('/terms')
  })

  it('shares the landing page’s always-dark palette', () => {
    renderPage(page)
    const root = screen.getByRole('main').closest('.palette-landing')
    expect(root).not.toBeNull()
    expect(root!.contains(screen.getByRole('banner'))).toBe(true)
  })
})
