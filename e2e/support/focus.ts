import { expect, type Locator, type Page } from '@playwright/test'

const controls = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
// The Google button is drawn by Google, in its own frame, and is not ours to style.
const google = '[data-testid="google-button"]'

/** Tabbing reaches every visible link, button and field in the scope, and each shows an outline when focused. */
export async function expectVisibleFocusOnEveryControl(page: Page, scope?: Locator): Promise<void> {
  const root = scope ?? page.locator('body')
  for (const control of await root.locator(controls).all()) {
    const ours = !(await control.evaluate((element, selector) => element.closest(selector) !== null, google))
    if (ours && (await control.isVisible()) && (await control.isEnabled())) {
      await control.evaluate((element) => element.setAttribute('data-e2e-control', ''))
    }
  }
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

  const hidden: string[] = []
  const steps = (await page.locator(controls).count()) + 10
  for (let step = 0; step < steps; step++) {
    await page.keyboard.press('Tab')
    const problem = await page.evaluate(() => {
      const element = document.activeElement
      if (!element?.hasAttribute('data-e2e-control') || element.hasAttribute('data-e2e-seen')) return null
      element.setAttribute('data-e2e-seen', '')
      const { outlineStyle, outlineWidth } = getComputedStyle(element)
      const label = `<${element.tagName.toLowerCase()} class="${element.getAttribute('class') ?? ''}"> ${(element.textContent ?? '').trim().slice(0, 40)}`
      return outlineStyle === 'none' || outlineWidth === '0px' ? label : ''
    })
    if (problem) hidden.push(problem)
  }

  const unreached = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-e2e-control]:not([data-e2e-seen])')).map(
      (element) => `<${element.tagName.toLowerCase()} class="${element.getAttribute('class') ?? ''}">`,
    ),
  )
  await page.evaluate(() =>
    document.querySelectorAll('[data-e2e-control]').forEach((element) => {
      element.removeAttribute('data-e2e-control')
      element.removeAttribute('data-e2e-seen')
    }),
  )
  expect(hidden, 'controls with no focus outline').toEqual([])
  expect(unreached, 'controls Tab never reached').toEqual([])
}
