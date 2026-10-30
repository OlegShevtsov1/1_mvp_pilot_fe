import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { expectVisibleFocusOnEveryControl } from './support/focus.ts'
import { expectNoSidewaysScroll } from './support/viewport.ts'

// Callers emulate reduced motion, so no element is captured mid-animation.
async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

for (const [slug, path, title] of [
  ['privacy', '/privacy', 'Privacy policy'],
  ['terms', '/terms', 'Terms of use'],
]) {
  test(`${path} shows the ${title.toLowerCase()} in the site's style`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
    await page.goto(path)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expectNoSidewaysScroll(page)
    await expectVisibleFocusOnEveryControl(page)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

    for (const [device, width, height] of [
      ['desktop', 1440, 900],
      ['mobile', 360, 780],
    ] as const) {
      await page.setViewportSize({ width, height })
      for (const theme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: theme })
        await screenshot(page, testInfo, `${slug}-${device}-${theme}`)
      }
    }
  })
}

test('the landing footer leads to the privacy policy', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Privacy policy' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy policy')
})
