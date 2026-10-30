import { expect, test, type Page } from '@playwright/test'
import { expectNoMotionUnderReducedMotion } from './support/motion.ts'
import { expectFollowsDeviceTheme } from './support/theme.ts'
import { expectNoSidewaysScroll } from './support/viewport.ts'

// The render error test throws inside the app, so the error boundary shows the crash screen on any deployment.
async function openCrashScreen(page: Page): Promise<void> {
  await page.goto(`/?error-test=render&marker=e2e-crash-${Date.now()}`)
  await expect(page.getByRole('alert')).toHaveText(/^Something went wrong\.( The error was reported\.)?$/)
}

test.describe('crash screen', () => {
  test('shows the brand without a link, a decorative illustration and the message in the display face', async ({ page }) => {
    await openCrashScreen(page)
    const brand = page.getByRole('banner').locator('.brand')
    await expect(brand).toHaveText('Pilot App')
    await expect(brand.locator('svg.brand-mark')).toBeVisible()
    await expect(page.getByRole('link')).toHaveCount(0)
    await expect(page.getByRole('button')).toHaveCount(0)
    await expect(page.locator('svg.crash-illustration')).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('svg.crash-illustration')).toBeVisible()
    const face = await page.getByRole('alert').evaluate((alert) => getComputedStyle(alert).fontFamily)
    expect(face).toMatch(/^"?Space Grotesk/)
  })

  test('does not scroll sideways at 360 px and 1440 px', async ({ page }) => {
    await openCrashScreen(page)
    await expectNoSidewaysScroll(page, [360, 1440])
  })

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`keeps the message readable at 360 px and 1440 px in the ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme })
      await openCrashScreen(page)
      for (const width of [360, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(page.getByRole('alert'), `alert at ${width} px`).toBeInViewport()
        await expect(page.locator('svg.crash-illustration'), `illustration at ${width} px`).toBeInViewport()
      }
    })
  }

  test('follows the device theme', async ({ page }) => {
    await openCrashScreen(page)
    await expectFollowsDeviceTheme(page)
  })

  test('declares no animation or transition under reduced motion', async ({ page }) => {
    await openCrashScreen(page)
    await expectNoMotionUnderReducedMotion(page)
  })
})
