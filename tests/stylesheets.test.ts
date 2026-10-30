import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatViolation, scanStylesheet, stylesheetsUnder } from './stylesheetScan.ts'
import { repoRoot } from './support.ts'

/*
 * What the scan does not cover (ADR-0002, sad §11): it is a pattern scan, not a CSS parser.
 * - widths, heights, line-heights and icon sizes (left to review);
 * - values reached through a shorthand other than the listed properties (`font`, `border`, `outline`);
 * - colours written as `color()`, `lab()`, `oklch()` or system colours;
 * - at-rules other than `@media` (`@supports`, `@container`, `@keyframes` bodies);
 * - the `var(--…)` fallback value after a comma is scanned like any other value.
 */

/** Every stylesheet of the app (AC-15): the scan finds them itself, so a new one is guarded from its first commit. */
const DESIGN_VALUES = 'src/styles/tokens.css'
const GUARDED = stylesheetsUnder(repoRoot, 'src').filter((file) => file !== DESIGN_VALUES)

const reduced = '@media (prefers-reduced-motion: no-preference)'

const read = (file: string) => readFileSync(join(repoRoot, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rules = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, prelude, body]) => ({ prelude: prelude.trim(), body }))
const selectors = (prelude: string) => prelude.split(',').map((part) => part.trim())

describe('scanStylesheet: colours', () => {
  it('reports a raw hex colour with file, selector and declaration', () => {
    const found = scanStylesheet('x.css', '.a { color: #fff; }')
    expect(found).toEqual([{ file: 'x.css', selector: '.a', declaration: 'color: #fff', rule: 'colour' }])
  })

  it('reports rgb(), hsl() and named colours', () => {
    const css = '.a { color: rgb(0 0 0); } .b { background: hsl(10 20% 30%); } .c { border-color: red; }'
    expect(scanStylesheet('x.css', css).map((v) => v.selector)).toEqual(['.a', '.b', '.c'])
  })

  it('accepts var(), transparent, currentColor and none', () => {
    const css = '.a { color: var(--color-text); background: transparent; border-color: currentColor; box-shadow: none; }'
    expect(scanStylesheet('x.css', css)).toEqual([])
  })

  it('ignores a colour inside a comment', () => {
    expect(scanStylesheet('x.css', '/* color: #fff; */ .a { color: var(--color-text); }')).toEqual([])
  })
})

describe('scanStylesheet: lengths', () => {
  it('reports a raw font-size', () => {
    const found = scanStylesheet('x.css', '.a { font-size: 14px; }')
    expect(found).toEqual([{ file: 'x.css', selector: '.a', declaration: 'font-size: 14px', rule: 'length' }])
  })

  it.each(['margin: 8px', 'padding: 1rem', 'gap: 4px', 'inset: 2px', 'border-radius: 6px', 'box-shadow: 0 1px 2px var(--c)', 'text-shadow: 0 0 4px var(--c)'])(
    'reports a raw length in %s',
    (declaration) => {
      expect(scanStylesheet('x.css', `.a { ${declaration}; }`)).toHaveLength(1)
    },
  )

  it('accepts var(), 0, auto, percentages and keywords', () => {
    const css =
      '.a { margin: 0 auto; padding: var(--space-2) 0; gap: var(--space-1); border-radius: 50%; font-size: inherit; inset: 0; }'
    expect(scanStylesheet('x.css', css)).toEqual([])
  })

  it('accepts a length in a calc() over variables only', () => {
    expect(scanStylesheet('x.css', '.a { padding: calc(var(--space-2) * 2); }')).toEqual([])
  })

  it('accepts breakpoints in an @media prelude', () => {
    expect(scanStylesheet('x.css', '@media (min-width: 768px) { .a { padding: var(--space-2); } }')).toEqual([])
  })

  it('does not look at properties it does not guard', () => {
    expect(scanStylesheet('x.css', '.a { width: 24px; height: 24px; }')).toEqual([])
  })
})

describe('scanStylesheet: motion', () => {
  it('reports a transition outside the reduced-motion media block', () => {
    const found = scanStylesheet('x.css', '.a { transition: color 0.2s; }')
    expect(found).toEqual([{ file: 'x.css', selector: '.a', declaration: 'transition: color 0.2s', rule: 'motion' }])
  })

  it('reports an animation outside the reduced-motion media block', () => {
    expect(scanStylesheet('x.css', '.a { animation: fade 1s; }').map((v) => v.rule)).toEqual(['motion'])
  })

  it('reports a transition inside a different media block', () => {
    const css = '@media (min-width: 768px) { .a { transition: color 0.2s; } }'
    expect(scanStylesheet('x.css', css).map((v) => v.rule)).toEqual(['motion'])
  })

  it('accepts a transition and an animation inside the reduced-motion media block', () => {
    const css = `${reduced} { .a { transition: color var(--duration); animation: fade var(--duration); } }`
    expect(scanStylesheet('x.css', css)).toEqual([])
  })

  it('names the selector of a rule that follows an at-rule block', () => {
    const css = `${reduced} { .a { transition: none; } } .b { animation: fade 1s; }`
    expect(scanStylesheet('x.css', css).map((v) => v.selector)).toEqual(['.b'])
  })
})

describe('formatViolation', () => {
  it('names the file, the selector and the declaration', () => {
    const message = formatViolation({ file: 'src/x.css', selector: '.a', declaration: 'color: #fff', rule: 'colour' })
    expect(message).toContain('src/x.css')
    expect(message).toContain('.a')
    expect(message).toContain('color: #fff')
  })
})

describe('guarded stylesheets', () => {
  const sources = (dir: string): string[] =>
    readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? sources(join(dir, entry.name)) : /\.[jt]sx?$/.test(entry.name) ? [join(dir, entry.name)] : [],
    )

  it('scans every stylesheet under src except the design values', () => {
    expect(GUARDED).toEqual(
      expect.arrayContaining(['src/App.css', 'src/styles/base.css', 'src/routes/Dashboard.css', 'src/routes/Landing.css']),
    )
    expect(GUARDED).not.toContain(DESIGN_VALUES)
  })

  it('finds a stylesheet in a nested folder', () => {
    const found = stylesheetsUnder(repoRoot, 'tests/fixtures/stylesheets')
    expect(found).toEqual(['tests/fixtures/stylesheets/a.css', 'tests/fixtures/stylesheets/nested/b.css'])
  })

  it('leaves no stylesheet the app imports unscanned', () => {
    const imported = sources('src').flatMap((file) =>
      [...readFileSync(join(repoRoot, file), 'utf8').matchAll(/import\s+['"](\.{1,2}\/[^'"]+\.css)['"]/g)].map(([, path]) =>
        relative(repoRoot, join(repoRoot, dirname(file), path)),
      ),
    )
    expect(imported.length).toBeGreaterThan(0)
    expect(imported.filter((file) => file !== DESIGN_VALUES && !GUARDED.includes(file))).toEqual([])
  })

  it.each(GUARDED)('%s uses only shared design values and declares no motion outside reduced-motion', (file) => {
    const css = readFileSync(join(repoRoot, file), 'utf8')
    expect(scanStylesheet(file, css).map(formatViolation)).toEqual([])
  })
})

describe('base.css', () => {
  it('is imported right after tokens.css and replaces index.css', () => {
    const main = read('src/main.tsx')
    expect(main.indexOf("import './styles/base.css'")).toBeGreaterThan(main.indexOf("import './styles/tokens.css'"))
    expect(main).not.toContain('index.css')
    expect(existsSync(join(repoRoot, 'src', 'index.css'))).toBe(false)
  })

  it('centres the page shell up to the maximum content width', () => {
    const page = rules(read('src/styles/base.css')).find((rule) => rule.prelude === '.page')
    expect(page?.body).toMatch(/max-width:\s*var\(--content-width-max\)/)
    expect(page?.body).toMatch(/margin:\s*0 auto/)
  })

  it('draws one focus ring in the focus colour on the brand, buttons, links and inputs', () => {
    const ring = rules(read('src/styles/base.css')).filter((rule) => rule.prelude.includes(':focus-visible'))
    expect(ring).toHaveLength(1)
    expect(ring[0].body).toMatch(/outline:\s*\d+px solid var\(--color-focus\)/)
    for (const selector of ['.brand', '.button', '.link', '.input']) {
      expect(ring[0].prelude.split(',').map((part) => part.trim()), selector).toContain(`${selector}:focus-visible`)
    }
  })

  it('offers the primary, outline, text, small and full-width buttons and an info alert', () => {
    const found = rules(read('src/styles/base.css')).flatMap((rule) => selectors(rule.prelude))
    for (const selector of ['.button-primary', '.button-outline', '.button-text', '.button-sm', '.button-block', '.alert-info']) {
      expect(found, selector).toContain(selector)
    }
  })

  it('uses class selectors only, so nothing reaches into the Google button slot', () => {
    const allowed = ['body', '.page h1']
    const bare = rules(read('src/styles/base.css'))
      .filter((rule) => !rule.prelude.startsWith('@'))
      .flatMap((rule) => rule.prelude.split(',').map((part) => part.trim()))
      .filter((selector) => !allowed.includes(selector) && !selector.split(/\s+/).pop()!.startsWith('.'))
    expect(bare).toEqual([])
  })
})

/*
 * Under `.palette-landing` (ADR-0005) `accent` is too dark for text on the dark surfaces and `accent-strong` too light
 * under white text: the four landing pairs the contrast test skips (T13). Every rule the landing page or the legal pages
 * can reach therefore keeps accent-coloured text and accent-strong backgrounds away from the hook.
 */
describe('landing palette', () => {
  const files = ['src/styles/base.css', 'src/routes/SiteChrome.css', 'src/routes/Landing.css', 'src/routes/Legal.css']
  const hook = '.palette-landing'
  const unsafe = {
    'accent text': /(?:^|;)\s*color:\s*var\(--color-accent\)/,
    'accent-strong background': /(?:^|;)\s*background(?:-color)?:[^;]*var\(--color-accent-strong\)/,
  }
  const resets = {
    'accent text': /(?:^|;)\s*color:\s*var\(--color-accent-strong\)/,
    'accent-strong background': /(?:^|;)\s*background(?:-color)?:/,
  }
  const all = files.flatMap((file) => rules(read(file)).map((rule) => ({ file, ...rule })))

  it('resets accent text to accent-strong and accent-strong backgrounds under the hook in Landing, Legal.css and base.css', () => {
    const problems: string[] = []
    for (const { file, prelude, body } of all.filter((rule) => !rule.prelude.startsWith('@'))) {
      for (const [kind, pattern] of Object.entries(unsafe) as [keyof typeof unsafe, RegExp][]) {
        if (!pattern.test(body)) continue
        for (const selector of selectors(prelude)) {
          if (selector.startsWith(hook)) {
            problems.push(`${file}: ${selector} sets ${kind} under the landing palette`)
            continue
          }
          const reset = all.some(
            (rule) =>
              selectors(rule.prelude).includes(`${hook} ${selector}`) &&
              resets[kind].test(rule.body) &&
              !pattern.test(rule.body),
          )
          if (!reset) problems.push(`${file}: ${selector} sets ${kind} with no ${hook} ${selector} reset`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('reads links in the legal text in accent-strong', () => {
    const link = rules(read('src/routes/Legal.css')).find((rule) => selectors(rule.prelude).includes('.legal-text a'))
    expect(link?.body).toMatch(/color:\s*var\(--color-accent-strong\)/)
  })

  it('gives the landing primary call to action the accent gradient and glow, also on hover', () => {
    for (const selector of [`${hook} .landing-start-primary`, `${hook} .landing-start-primary:hover`]) {
      const rule = all.find((candidate) => selectors(candidate.prelude).includes(selector))
      expect(rule?.body, selector).toMatch(/background:\s*var\(--gradient-accent\)/)
    }
  })
})
