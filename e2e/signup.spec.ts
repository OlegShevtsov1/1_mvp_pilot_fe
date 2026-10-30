import { expect, test, type Page } from '@playwright/test'
import { stubCabinet } from './support/cabinet.ts'
import { expectVisibleFocusOnEveryControl } from './support/focus.ts'
import { expectNoMotionUnderReducedMotion } from './support/motion.ts'
import { recordRequests, withGoogleClient } from './support/requests.ts'
import { expectFollowsDeviceTheme } from './support/theme.ts'
import { expectCentredShell, expectNoSidewaysScroll } from './support/viewport.ts'

// The sign-up screen in the Mantis auth layout (T16), with the API answers stubbed in the browser.

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' }

async function openSignUp(page: Page) {
  await page.goto('/sign-up')
  await expect(page.getByRole('region', { name: 'Sign up' })).toBeVisible()
}

async function fill(page: Page, email: string, password: string, confirmation: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password').fill(confirmation)
  await page.getByRole('button', { name: 'Sign up' }).click()
}

test('shows the brand above one card with the link to sign in in its head', async ({ page }) => {
  await openSignUp(page)

  await expect(page.getByRole('banner').getByRole('link', { name: 'Pilot App' })).toBeVisible()
  const card = page.getByRole('region', { name: 'Sign up' })
  await expect(card.getByRole('link', { name: 'I already have an account' })).toHaveAttribute('href', '/sign-in')
  await expect(page.getByRole('link', { name: 'Back to the start' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Legal' })).toBeVisible()
})

test('a new email with matching passwords lands in the cabinet (AC-03)', async ({ page }) => {
  await stubCabinet(page, 'populated')
  await page.addInitScript(() => localStorage.removeItem('pilot.tokens'))
  const data = { access_token: 'e2e', refresh_token: 'e2e', token_type: 'Bearer', expires_in: 3600, created_at: 1 }
  await page.route('**/api/v1/users', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 201, json: { status: 'success', message: 'ok', data }, headers: cors }),
  )
  await openSignUp(page)

  await fill(page, 'olena@example.com', 'secret12', 'secret12')

  await expect(page).toHaveURL(/\/dashboard$/)
})

test('each faulty field shows its message and nothing is sent (AC-04)', async ({ page }) => {
  const sent: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/users') sent.push(request.method())
  })
  await openSignUp(page)

  await fill(page, 'olena@', 'abc', 'abcd')

  for (const [label, message] of [
    ['Email', 'Enter an email address like name@example.com.'],
    ['Password', 'Password must be at least 6 characters.'],
    ['Confirm password', 'The passwords do not match.'],
  ] as const) {
    const field = page.getByLabel(label, { exact: true })
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(message)
  }
  expect(sent).toEqual([])
})

test('does not scroll sideways at 360 px and 768 px (AC-11)', async ({ page }) => {
  await openSignUp(page)
  await expectNoSidewaysScroll(page)
})

test('keeps its content centred and at most 1200 px wide at 1440 px (AC-16)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openSignUp(page)
  await expectCentredShell(page, page.getByRole('main'))
})

test('follows the device theme, light when the device states no preference (AC-12)', async ({ page }) => {
  await openSignUp(page)
  await expectFollowsDeviceTheme(page)

  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  await page.emulateMedia({ colorScheme: 'light' })
  const light = await background()
  await page.emulateMedia({ colorScheme: 'no-preference' })
  expect(await background()).toBe(light)
})

test('shows a focus outline on every link, button and field (AC-13)', async ({ page }) => {
  await openSignUp(page)
  await expectVisibleFocusOnEveryControl(page)
})

test('declares no animation or transition under reduced motion (AC-14)', async ({ page }) => {
  await openSignUp(page)
  await expectNoMotionUnderReducedMotion(page)
})

for (const [name, clientId] of [
  ['without a Google client', ''],
  ['with a Google client', 'e2e-client.apps.googleusercontent.com'],
] as const) {
  test(`requests no third-party font or image ${name}`, async ({ page }) => {
    await withGoogleClient(page, clientId)
    const requests = recordRequests(page)
    await openSignUp(page)
    await expect(page.getByText('or with email')).toHaveCount(clientId ? 1 : 0)
    requests.expectNoThirdPartyAssets()
  })
}
