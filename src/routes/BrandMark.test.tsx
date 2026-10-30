// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrandMark } from './BrandMark.tsx'
import Landing from './Landing.tsx'

describe('BrandMark', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders as decorative content hidden from assistive technology', () => {
    const { container } = render(<BrandMark />)
    const mark = container.querySelector('svg')
    expect(mark).not.toBeNull()
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(mark?.getAttribute('focusable')).toBe('false')
    expect(mark?.getAttribute('class')).toContain('brand-mark')
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('is the logo inside the landing header link, whose name stays "Pilot App"', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})))
    render(
      <MemoryRouter>
        <Landing google />
      </MemoryRouter>,
    )
    const brand = within(screen.getByRole('banner')).getByRole('link', { name: 'Pilot App' })
    expect(brand.querySelector('svg.brand-mark')).not.toBeNull()
  })
})
