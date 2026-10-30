import { expect, test, type Page } from '@playwright/test'
import { stubCabinet } from './support/cabinet.ts'
import { expectVisibleFocusOnEveryControl } from './support/focus.ts'
import { expectNoMotionUnderReducedMotion } from './support/motion.ts'
import { recordRequests, withGoogleClient } from './support/requests.ts'
import { expectFollowsDeviceTheme } from './support/theme.ts'
import { expectCentredShell, expectNoSidewaysScroll } from './support/viewport.ts'

// The sign-in screen in the Mantis auth layout (T17), with the token answers stubbed in the browser.

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' }

async function answerTokens(page: Page, status: number, json: object) {
  await page.route('**/oauth/token', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status, json, headers: cors }),
  )
}

async function openSignIn(page: Page) {
  await page.goto('/sign-in')
  await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible()
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('shows the brand above one card with the link to create an account in its head', async ({ page }) => {
  await openSignIn(page)

  await expect(page.getByRole('banner').getByRole('link', { name: 'Pilot App' })).toBeVisible()
  const card = page.getByRole('region', { name: 'Sign in' })
  await expect(card.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/sign-up')
  await expect(page.getByRole('link', { name: 'Back to the start' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Legal' })).toBeVisible()
})

test('correct credentials land in the cabinet (AC-05)', async ({ page }) => {
  await stubCabinet(page, 'populated')
  await page.addInitScript(() => localStorage.removeItem('pilot.tokens'))
  await answerTokens(page, 200, { access_token: 'e2e', refresh_token: 'e2e', token_type: 'Bearer', expires_in: 3600, created_at: 1 })
  await openSignIn(page)

  await signIn(page, 'olena@example.com', 'secret12')

  await expect(page).toHaveURL(/\/dashboard$/)
})

test('wrong credentials show the alert above the button and stay on sign-in (AC-06)', async ({ page }) => {
  await answerTokens(page, 400, { error: 'invalid_grant', error_description: 'The password is wrong.' })
  await openSignIn(page)

  await signIn(page, 'olena@example.com', 'wrong-pass')

  const alert = page.getByRole('alert')
  await expect(alert).toHaveText('Wrong email or password.')
  const alertBox = (await alert.boundingBox())!
  const buttonBox = (await page.getByRole('button', { name: 'Sign in' }).boundingBox())!
  expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(buttonBox.y)
  await expect(page).toHaveURL(/\/sign-in$/)
})

test('does not scroll sideways at 360 px and 768 px (AC-11)', async ({ page }) => {
  await openSignIn(page)
  await expectNoSidewaysScroll(page)
})

test('keeps its content centred and at most 1200 px wide at 1440 px (AC-16)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSignIn(page)
  await expectCentredShell(page, page.getByRole('main'))
})

test('follows the device theme, light when the device states no preference (AC-12)', async ({ page }) => {
  await openSignIn(page)
  await expectFollowsDeviceTheme(page)

  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await page.emulateMedia({ colorScheme: 'light' })
  const light = await background()
  await page.emulateMedia({ colorScheme: 'no-preference' })
  expect(await background()).toBe(light)
})

test('shows a focus outline on every link, button and field (AC-13)', async ({ page }) => {
  await openSignIn(page)
  await expectVisibleFocusOnEveryControl(page)
})

test('declares no animation or transition under reduced motion (AC-14)', async ({ page }) => {
  await openSignIn(page)
  await expectNoMotionUnderReducedMotion(page)
})

for (const [name, clientId] of [
  ['without a Google client', ''],
  ['with a Google client', 'e2e-client.apps.googleusercontent.com'],
] as const) {
  test(`requests no third-party font or image ${name}`, async ({ page }) => {
    await withGoogleClient(page, clientId)
    const requests = recordRequests(page)
    await openSignIn(page)
    await expect(page.getByText('or with email')).toHaveCount(clientId ? 1 : 0)
    requests.expectNoThirdPartyAssets()
  })
}
