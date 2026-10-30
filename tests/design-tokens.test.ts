import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repoRoot } from './support.ts'

const tokens = readFileSync(join(repoRoot, 'src', 'styles', 'tokens.css'), 'utf8')
const landing = readFileSync(join(repoRoot, 'src', 'routes', 'Landing.css'), 'utf8')
const base = readFileSync(join(repoRoot, 'src', 'styles', 'base.css'), 'utf8')
const dashboard = readFileSync(join(repoRoot, 'src', 'routes', 'Dashboard.css'), 'utf8')

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

/** `foreground` laid over the solid `background` at `alpha` (0..1), as a hex colour. */
function blend(foreground: string, alpha: number, background: string): string {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16)
  const mixed = [1, 3, 5].map((at) => Math.round(channel(background, at) * (1 - alpha) + channel(foreground, at) * alpha))
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const colours = (theme: Map<string, string>) => [...theme.keys()].filter((name) => name.startsWith('--color-')).sort()

/** The `.palette-landing` block (ADR-0005): the landing page's dark values for the same role names. */
const landingHook = '.palette-landing'
const landingBlock = (): Map<string, string> => {
  const at = without(tokens, darkQuery).indexOf(`${landingHook} {`)
  expect(at, `${landingHook} outside any colour-scheme query`).toBeGreaterThanOrEqual(0)
  return declarations(block(without(tokens, darkQuery), at))
}
/** The landing palette as the browser sees it: the hook block over the light or the dark `:root`. */
const landingOver = (root: () => Map<string, string>) => (): Map<string, string> => new Map([...root(), ...landingBlock()])

/** The hex colour stops of a gradient value, in order. */
const stops = (gradient: string | undefined): string[] => gradient?.match(/#[0-9a-f]{6}\b/gi) ?? []

describe('design tokens', () => {
  it('defines colour, type scale, spacing, radius and shadow tokens in one place', () => {
    for (const prefix of ['--color-', '--font-size-', '--space-', '--radius-', '--shadow-']) {
      expect([...lightRoot.keys()].some((name) => name.startsWith(prefix)), prefix).toBe(true)
    }
  })

  it.each([
    '--color-surface-muted',
    '--color-border-strong',
    '--color-error-soft',
    '--font-size-xs',
    '--font-weight-regular',
    '--font-weight-medium',
    '--font-weight-semibold',
    '--space-7',
    '--radius-xl',
    '--duration-fast',
    '--duration-slow',
  ])('defines the role %s', (name) => {
    expect(lightRoot.has(name), name).toBe(true)
  })

  it('caps the page content at 1200px', () => {
    expect(lightRoot.get('--content-width-max')).toBe('1200px')
  })

  it('follows the system colour scheme with a dark theme for every colour', () => {
    expect(block(tokens, tokens.indexOf(':root'))).toMatch(/color-scheme:\s*light dark;/)
    expect(colours(darkRoot())).toEqual(colours(lightRoot))
  })

  it.each([
    ['light', () => lightRoot],
    ['dark', darkRoot],
    ['landing (over light)', landingOver(() => lightRoot)],
    ['landing (over dark)', landingOver(darkRoot)],
  ])('keeps text and controls at WCAG AA contrast in the %s palette', (name, theme) => {
    // The landing palette splits the accent: `accent` (#7c3aed) is a fill under white text (buttons, brand mark), and
    // accent-coloured text (links, eyebrows) reads `accent-strong` on the dark surfaces. No violet passes both ways,
    // so four pairs are skipped there only: the primary hover is the accent gradient plus glow (T14), never an
    // accent-strong background, and no landing text is drawn in `accent`.
    const skipped = name.startsWith('landing')
      ? ['on-accent on accent-strong', 'accent on surface', 'accent on bg', 'accent on accent-soft']
      : []
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
      ['text', 'surface-muted', 4.5],
      ['text-muted', 'surface-muted', 4.5],
      ['accent', 'accent-soft', 4.5],
      ['accent-strong', 'surface', 4.5],
      ['error', 'bg', 4.5],
      ['error', 'error-soft', 4.5],
      ['text', 'error-soft', 4.5],
      ['focus', 'bg', 3],
      ['focus', 'surface', 3],
      ['border-strong', 'bg', 3],
      ['border-strong', 'surface', 3],
      ['status-progress', 'surface', 3],
      ['status-progress', 'bg', 3],
      ['status-done', 'surface', 3],
      ['status-done', 'bg', 3],
      ['status-progress', 'status-progress-soft', 4.5],
      ['status-done', 'status-done-soft', 4.5],
      ['text', 'status-progress-soft', 4.5],
      ['text', 'status-done-soft', 4.5],
      ['accent-strong', 'bg', 4.5],
      ['accent-strong', 'accent-soft', 4.5],
      ['accent-strong', 'surface-muted', 4.5],
    ]
    for (const [fg, bg, min] of pairs.filter(([fg, bg]) => !skipped.includes(`${fg} on ${bg}`))) {
      expect(contrast(colour(fg), colour(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min)
    }
  })

  it.each([
    ['light', () => lightRoot],
    ['dark', darkRoot],
  ])('keeps text readable over the hero glow in the %s theme', (_, theme) => {
    // The hex pairs cannot see a gradient: check the worst case, the glow's centre at full strength, as a solid colour.
    const glow = theme().get('--gradient-glow')!.match(/rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)/)
    expect(glow, 'the glow colour must be an rgb(r g b / a%) stop').not.toBeNull()
    const [, r, g, b, alpha] = glow!
    const tint = `#${[r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`
    const worst = blend(tint, Number(alpha) / 100, theme().get('--color-bg')!)
    for (const name of ['text', 'text-muted']) {
      expect(contrast(theme().get(`--color-${name}`)!, worst), `${name} over the glow`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each([
    '--color-status-progress-soft',
    '--color-status-done-soft',
    '--color-scrim',
    '--gradient-hero',
    '--gradient-accent',
    '--gradient-title',
    '--gradient-orb',
    '--gradient-grid',
  ])('defines the new role %s on :root', (name) => {
    expect(lightRoot.has(name), name).toBe(true)
  })

  it.each([
    ['light', () => lightRoot],
    ['dark', darkRoot],
  ])('dims the page behind the phone drawer with a translucent black scrim in the %s theme', (_, theme) => {
    const scrim = theme().get('--color-scrim')?.match(/^rgb\(0 0 0 \/ (\d+)%\)$/)
    expect(scrim, 'the scrim must be an rgb(0 0 0 / a%) value').not.toBeNull()
    expect(Number(scrim![1])).toBeGreaterThanOrEqual(30)
    expect(Number(scrim![1])).toBeLessThanOrEqual(60)
  })

  it('uses a self-hosted display font', () => {
    expect(lightRoot.get('--font-family-display')).toMatch(/^'Space Grotesk Variable'/)
    expect(readFileSync(join(repoRoot, 'src', 'main.tsx'), 'utf8')).toContain("import '@fontsource-variable/space-grotesk'")
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    expect(manifest.dependencies).toHaveProperty(['@fontsource-variable/space-grotesk'])
  })

  it('uses self-hosted Public Sans for body text, with the system stack as fallback', () => {
    expect(lightRoot.get('--font-family-base')).toMatch(/^'Public Sans Variable', -apple-system, BlinkMacSystemFont,/)
    expect(lightRoot.get('--font-family-base')).toMatch(/, sans-serif$/)
    const main = readFileSync(join(repoRoot, 'src', 'main.tsx'), 'utf8')
    expect(main).toContain("import '@fontsource-variable/public-sans'")
    expect(main.indexOf("import '@fontsource-variable/public-sans'")).toBeLessThan(main.indexOf("import './styles/tokens.css'"))
    const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
    expect(manifest.dependencies).toHaveProperty(['@fontsource-variable/public-sans'])
  })

  it('keeps Space Grotesk for display text on top of the body face', () => {
    expect(lightRoot.get('--font-family-display')).toBe("'Space Grotesk Variable', var(--font-family-base)")
  })
})

describe('landing palette', () => {
  it('is one dark block of the shared role names, outside any colour-scheme query', () => {
    const landing = landingBlock()
    expect(block(without(tokens, darkQuery), without(tokens, darkQuery).indexOf(`${landingHook} {`))).toMatch(
      /color-scheme:\s*dark;/,
    )
    expect(block(tokens, tokens.indexOf(darkQuery))).not.toContain(landingHook)
    for (const name of landing.keys()) expect(lightRoot.has(name), `${name} is also defined on :root`).toBe(true)
  })

  it.each(['--gradient-hero', '--gradient-accent', '--gradient-title', '--gradient-orb', '--gradient-grid', '--shadow-glow'])(
    'defines %s',
    (name) => {
      expect(landingBlock().has(name), name).toBe(true)
    },
  )

  it('is violet: the landing accent differs from the blue of the other screens', () => {
    expect(landingBlock().get('--color-accent')).toBe('#7c3aed')
    expect(landingBlock().get('--color-accent')).not.toBe(lightRoot.get('--color-accent'))
  })

  it('keeps button text readable at every stop of the accent gradient', () => {
    const landing = landingOver(darkRoot)()
    const gradient = stops(landing.get('--gradient-accent'))
    expect(gradient, 'the accent gradient ends at the accent').toContain('#7c3aed')
    for (const stop of gradient) {
      expect(contrast(landing.get('--color-on-accent')!, stop), `on-accent on ${stop}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the gradient headline readable at every stop over the landing background', () => {
    const landing = landingOver(darkRoot)()
    const gradient = stops(landing.get('--gradient-title'))
    expect(gradient.length).toBeGreaterThanOrEqual(2)
    for (const stop of gradient) {
      expect(contrast(stop, landing.get('--color-bg')!), `${stop} on bg`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('design values', () => {
  it('are defined only on :root and on the landing hook class', () => {
    const sheets = readdirSync(join(repoRoot, 'src'), { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.css'))
    const definers = sheets.flatMap((file) => {
      const css = readFileSync(join(repoRoot, 'src', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter(([, , body]) => /(^|;)\s*--[a-z0-9-]+\s*:/.test(body))
        .map(([, prelude]) => `${file}: ${prelude.trim().split(/\s*\n\s*/).pop()}`)
    })
    expect(definers.length).toBeGreaterThan(0)
    expect(definers.filter((definer) => !/^styles\/tokens\.css: (:root|\.palette-landing)$/.test(definer))).toEqual([])
  })
})

describe('landing page styles', () => {
  it('animates the landing page only when the visitor allows motion', () => {
    const motion = '@media (prefers-reduced-motion: no-preference)'
    expect(landing).toContain(motion)
    expect(without(landing, motion)).not.toMatch(/\b(animation|transition)(-[a-z]+)?\s*:/)
  })

  it('shows a visible focus ring on the landing calls to action, drawn by the shared base rule', () => {
    // The landing calls to action carry the `button` class; the ring moved to base.css with the shared controls.
    const rules = [...base.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)].map(([, selector, body]) => ({ selector, body }))
    expect(
      rules.some(
        ({ selector, body }) =>
          selector.includes('.button:focus-visible') && body.includes('outline') && body.includes('var(--color-focus)'),
      ),
    ).toBe(true)
    expect(readFileSync(join(repoRoot, 'src', 'routes', 'Landing.tsx'), 'utf8')).toMatch(/className="button landing-start/)
  })

  it('glows on hover', () => {
    const rules = [...landing.matchAll(/([^{}]*:hover[^{}]*)\{([^}]*)\}/g)].map(([, , body]) => body)
    expect(rules.some((body) => body.includes('var(--shadow-glow)'))).toBe(true)
  })
})

describe('dashboard styles', () => {
  it('animates the dashboard only when the user allows motion', () => {
    const motion = '@media (prefers-reduced-motion: no-preference)'
    expect(dashboard).toContain(motion)
    expect(without(dashboard, motion)).not.toMatch(/\b(animation|transition)(-[a-z]+)?\s*:/)
  })

  it('shows a visible focus ring on dashboard controls', () => {
    const rules = [...dashboard.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^}]*)\}/g)].map(([, , body]) => body)
    expect(rules.some((body) => body.includes('outline') && body.includes('var(--color-focus)'))).toBe(true)
  })
})
