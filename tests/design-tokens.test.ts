import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repoRoot } from './support.ts'

const tokens = readFileSync(join(repoRoot, 'src', 'styles', 'tokens.css'), 'utf8')
const landing = readFileSync(join(repoRoot, 'src', 'routes', 'Landing.css'), 'utf8')

/** The text between the brace that opens at or after `start` and the brace that closes it. */
function block(css: string, start: number): string {
  const open = css.indexOf('{', start)
  let depth = 0
  for (let at = open; at < css.length; at++) {
    if (css[at] === '{') depth++
    if (css[at] === '}' && --depth === 0) return css.slice(open + 1, at)
  }
  throw new Error(`unclosed block at ${start}`)
}

/** The custom properties declared directly in a block body, as name → value. */
function declarations(body: string): Map<string, string> {
  return new Map([...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

/** `css` with every block whose prelude is `prelude` removed. */
function without(css: string, prelude: string): string {
  let rest = css
  for (let at = rest.indexOf(prelude); at >= 0; at = rest.indexOf(prelude)) {
    rest = rest.slice(0, at) + rest.slice(at + prelude.length + block(rest, at).length + 2)
  }
  return rest
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const darkQuery = '@media (prefers-color-scheme: dark)'
const lightRoot = declarations(block(without(tokens, darkQuery), tokens.indexOf(':root')))
const darkRoot = (): Map<string, string> => {
  const media = tokens.indexOf(darkQuery)
  expect(media, darkQuery).toBeGreaterThanOrEqual(0)
  const body = block(tokens, media)
  return declarations(block(body, body.indexOf(':root')))
}
const colours = (theme: Map<string, string>) => [...theme.keys()].filter((name) => name.startsWith('--color-')).sort()

describe('design tokens', () => {
  it('defines colour, type scale, spacing, radius and shadow tokens in one place', () => {
    for (const prefix of ['--color-', '--font-size-', '--space-', '--radius-', '--shadow-']) {
      expect([...lightRoot.keys()].some((name) => name.startsWith(prefix)), prefix).toBe(true)
    }
  })

  it('follows the system colour scheme with a dark theme for every colour', () => {
    expect(block(tokens, tokens.indexOf(':root'))).toMatch(/color-scheme:\s*light dark;/)
    expect(colours(darkRoot())).toEqual(colours(lightRoot))
  })

  it.each([
    ['light', () => lightRoot],
    ['dark', darkRoot],
  ])('keeps text and controls at WCAG AA contrast in the %s theme', (_, theme) => {
    const colour = (name: string) => {
      const value = theme().get(`--color-${name}`)
      expect(value, name).toMatch(/^#[0-9a-f]{6}$/i)
      return value!
    }
    const pairs: [string, string, number][] = [
      ['text', 'bg', 4.5],
      ['text', 'surface', 4.5],
      ['text-muted', 'bg', 4.5],
      ['text-muted', 'surface', 4.5],
      ['text-muted', 'accent-soft', 4.5],
      ['on-accent', 'accent', 4.5],
      ['on-accent', 'accent-strong', 4.5],
      ['accent', 'surface', 4.5],
      ['accent', 'bg', 4.5],
      ['error', 'surface', 4.5],
      ['text', 'accent-soft', 4.5],
      ['focus', 'bg', 3],
      ['focus', 'surface', 3],
      ['status-progress', 'surface', 3],
      ['status-done', 'surface', 3],
    ]
    for (const [fg, bg, min] of pairs) {
      expect(contrast(colour(fg), colour(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min)
    }
  })

  it('uses a self-hosted display font', () => {
    expect(lightRoot.get('--font-family-display')).toMatch(/^'Space Grotesk Variable'/)
    expect(readFileSync(join(repoRoot, 'src', 'main.tsx'), 'utf8')).toContain("import '@fontsource-variable/space-grotesk'")
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    expect(manifest.dependencies).toHaveProperty(['@fontsource-variable/space-grotesk'])
  })
})

describe('landing page styles', () => {
  it('animates the landing page only when the visitor allows motion', () => {
    const motion = '@media (prefers-reduced-motion: no-preference)'
    expect(landing).toContain(motion)
    expect(without(landing, motion)).not.toMatch(/\b(animation|transition)(-[a-z]+)?\s*:/)
  })

  it('shows a visible focus ring on the landing calls to action', () => {
    const rules = [...landing.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)].map(([, , body]) => body)
    expect(rules.some((body) => body.includes('outline') && body.includes('var(--color-focus)'))).toBe(true)
  })

  it('glows on hover', () => {
    const rules = [...landing.matchAll(/([^{}]*:hover[^{}]*)\{([^}]*)\}/g)].map(([, , body]) => body)
    expect(rules.some((body) => body.includes('var(--shadow-glow)'))).toBe(true)
  })
})
