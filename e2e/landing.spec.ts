import { expect, test, type Page, type TestInfo } from '@playwright/test'

test('a visitor sees what the app does and both ways to start', async ({ page }) => {
  const apiPaths: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/v1/')) apiPaths.push(path)
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every project and every task in one calm place')
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign up with email and password' })).toBeVisible()
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

  await expect(page.getByRole('link', { name: 'Continue with Google' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign up with email and password' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await screenshot(page, testInfo, 'landing-mobile-light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await screenshot(page, testInfo, 'landing-mobile-dark')
})

test('the landing page follows the system theme', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/')
  await screenshot(page, testInfo, 'landing-desktop-light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(8, 9, 12)')
  await screenshot(page, testInfo, 'landing-desktop-dark')
})

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
  const google = page.getByRole('link', { name: 'Continue with Google' })

  // The header's brand and Sign in links come before the hero's first call to action.
  for (let tab = 0; tab < 3; tab++) await page.keyboard.press('Tab')
  await expect(google).toBeFocused()
  await expect(google).not.toHaveCSS('outline-style', 'none')
  await expect(google).not.toHaveCSS('outline-width', '0px')
})

test('the debug footer shows on dev only', async ({ page }) => {
  await page.goto('/')
  const envName = await page.evaluate(() => window.APP_CONFIG?.ENV_NAME)

  if (envName === 'dev') await expect(page.getByTestId('api-status')).toBeVisible()
  else await expect(page.getByTestId('api-status')).toHaveCount(0)
})
