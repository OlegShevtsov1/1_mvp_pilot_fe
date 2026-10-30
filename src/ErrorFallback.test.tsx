// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ErrorFallback from './ErrorFallback.tsx'

const baseCss = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8')

/** Declarations of the first rule whose selector list is exactly `selector`. */
function declarations(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return baseCss.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
}

describe('ErrorFallback', () => {
  afterEach(cleanup)

  it('says the error was reported when Sentry is on', () => {
    render(<ErrorFallback reported />)
    expect(screen.getByRole('alert').textContent).toBe('Something went wrong. The error was reported.')
  })

  it('claims no report when Sentry is off', () => {
    render(<ErrorFallback reported={false} />)
    expect(screen.getByRole('alert').textContent).toBe('Something went wrong.')
  })

  for (const reported of [true, false]) {
    describe(reported ? 'reported variant' : 'unreported variant', () => {
      it('sits in the page shell under a header with the brand mark, which is not a link', () => {
        const { container } = render(<ErrorFallback reported={reported} />)
        expect(container.querySelector('.page')).not.toBeNull()
        const header = screen.getByRole('banner')
        const brand = header.querySelector('.brand')
        expect(brand?.textContent).toBe('Pilot App')
        expect(brand?.querySelector('svg.brand-mark')).not.toBeNull()
        expect(brand?.closest('a')).toBeNull()
        expect(screen.queryByRole('link')).toBeNull()
      })

      it('shows a decorative illustration hidden from assistive technology', () => {
        const { container } = render(<ErrorFallback reported={reported} />)
        const illustration = container.querySelector('svg.crash-illustration')
        expect(illustration).not.toBeNull()
        expect(illustration?.getAttribute('aria-hidden')).toBe('true')
        expect(illustration?.getAttribute('focusable')).toBe('false')
        expect(screen.queryByRole('img')).toBeNull()
      })

      it('adds no action', () => {
        render(<ErrorFallback reported={reported} />)
        expect(screen.queryByRole('button')).toBeNull()
        expect(screen.queryByRole('link')).toBeNull()
      })

      it('sets the message in the display face', () => {
        render(<ErrorFallback reported={reported} />)
        expect(screen.getByRole('alert').classList.contains('crash-message')).toBe(true)
        expect(declarations('.crash-message')).toMatch(/font-family:\s*var\(--font-family-display\)/)
      })
    })
  }

  it('puts "The error was reported." on a second, quieter line', () => {
    render(<ErrorFallback reported />)
    const second = screen.getByRole('alert').querySelector('.crash-message-detail')
    expect(second?.textContent).toBe('The error was reported.')
    expect(declarations('.crash-message-detail')).toMatch(/display:\s*block/)
    expect(declarations('.crash-message-detail')).toMatch(/color:\s*var\(--color-text-muted\)/)
  })
})
