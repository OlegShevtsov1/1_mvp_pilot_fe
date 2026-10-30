import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { headline, heroStarts } from './landing.ts'
import { expectVisibleFocusOnEveryControl } from './support/focus.ts'
import { expectNoMotionUnderReducedMotion } from './support/motion.ts'
import { recordRequests, withGoogleClient } from './support/requests.ts'
import { expectCentredShell, expectNoSidewaysScroll } from './support/viewport.ts'

async function expectBothStarts(page: Page) {
  const { google, starts } = await heroStarts(page)
  for (const start of starts) await expect(start).toBeVisible()
  if (!google) await expect(page.getByRole('main')).not.toContainText(/google/i)
}

test('a visitor sees what the app does and both ways to start', async ({ page }) => {
  const apiPaths: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/v1/')) apiPaths.push(path)
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline)
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expectBothStarts(page)
  await expect(page.getByRole('listitem')).toHaveCount(0)
  expect(apiPaths).toEqual([])
})

// Callers emulate reduced motion, so no element is captured mid-animation.
async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('the landing page fits a 360 px screen', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/')

  await expectBothStarts(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await screenshot(page, testInfo, 'landing-mobile-light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await screenshot(page, testInfo, 'landing-mobile-dark')
})

// The landing palette's background (ADR-0005), whatever theme the device asks for.
const landingBackground = 'rgb(7, 6, 11)'

test('the landing page stays dark under the light and the dark theme', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/')
  const root = page.locator('.palette-landing')
  await expect(root).toHaveCSS('background-color', landingBackground)
  await screenshot(page, testInfo, 'landing-desktop-light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(root).toHaveCSS('background-color', landingBackground)
  await screenshot(page, testInfo, 'landing-desktop-dark')
})

test('the landing page fits 360, 768 and 1440 px with its content centred', async ({ page }) => {
  await page.goto('/')
  await expectNoSidewaysScroll(page, [360, 768, 1440])
  await page.setViewportSize({ width: 1440, height: 900 })
  await expectCentredShell(page, page.getByRole('main'))
})

// Distinct row positions of a section's cards: how many rows the grid wraps them into.
async function rows(page: Page, region: string, cards: string): Promise<number> {
  const tops = await page
    .getByRole('region', { name: region })
    .locator(cards)
    .evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)))
  return new Set(tops).size
}

test('at 768 px the features sit two across and the steps three across', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1000 })
  await page.goto('/')

  expect(await rows(page, 'Everything a personal plan needs', 'article'), 'feature rows').toBe(2)
  expect(await rows(page, 'From a first idea to done in three steps', 'article'), 'step rows').toBe(1)
  await expectNoSidewaysScroll(page, [768])
})

test('at 1440 px the four features sit in one row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')

  expect(await rows(page, 'Everything a personal plan needs', 'article'), 'feature rows').toBe(1)
})

test('every link on the landing page shows a focus outline', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline)
  await expectVisibleFocusOnEveryControl(page)
})

test('the landing page declares no animation or transition under reduced motion', async ({ page }) => {
  await page.goto('/')
  await expectNoMotionUnderReducedMotion(page)
})

for (const [name, clientId] of [
  ['without a Google client', ''],
  ['with a Google client', 'e2e-client.apps.googleusercontent.com'],
] as const) {
  test(`the landing page requests no third-party font or image ${name}`, async ({ page }) => {
    await withGoogleClient(page, clientId)
    const requests = recordRequests(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline)
    requests.expectNoThirdPartyAssets()
  })
}

test('the landing page does not animate when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  await expect(page.locator('.landing-preview')).toHaveCSS('animation-name', 'none')
})

test('the dashboard preview enters after the hero text when motion is enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')

  await expect(page.locator('.landing-preview')).toHaveCSS('animation-delay', '0.24s')
})

test('keyboard focus on a call to action is visible', async ({ page }) => {
  await page.goto('/')
  const [primary] = (await heroStarts(page)).starts

  // The header's brand and Sign in links come before the hero's first call to action.
  for (let tab = 0; tab < 3; tab++) await page.keyboard.press('Tab')
  await expect(primary).toBeFocused()
  await expect(primary).not.toHaveCSS('outline-style', 'none')
  await expect(primary).not.toHaveCSS('outline-width', '0px')
})

test('the debug footer shows on dev only', async ({ page }) => {
  await page.goto('/')
  const envName = await page.evaluate(() => window.APP_CONFIG?.ENV_NAME)

  if (envName === 'dev') await expect(page.getByTestId('api-status')).toBeVisible()
  else await expect(page.getByTestId('api-status')).toHaveCount(0)
})
