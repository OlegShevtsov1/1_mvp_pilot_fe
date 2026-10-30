import { expect, test, type Locator, type Page } from '@playwright/test'
import { heroStarts } from './landing.ts'
import { stubCabinet } from './support/cabinet.ts'
import { expectVisibleFocusOnEveryControl } from './support/focus.ts'
import { expectNoMotionUnderReducedMotion } from './support/motion.ts'
import { recordRequests } from './support/requests.ts'
import { expectFollowsDeviceTheme } from './support/theme.ts'
import { expectNoSidewaysScroll } from './support/viewport.ts'

// The four screens and the crash screen after the redesign, checked together (T10): one brand mark, the widths, the
// themes, focus, reduced motion and no font or image from another origin.

interface Screen {
  name: string
  open(page: Page): Promise<void>
  /** The column that holds the content (default `main`): at most 1200 px wide and centred in the space beside any sidebar. */
  column?(page: Page): Locator
  /** The box the column centres in (default the page body): the cabinet's body beside the sidebar. */
  frame?(page: Page): Locator
  dark: 'always' | 'device'
}

// The landing palette's background (ADR-0005), whatever theme the device asks for.
const landingBackground = 'rgb(7, 6, 11)'
const maxColumn = 1200

const screens: Screen[] = [
  {
    name: 'landing page',
    open: async (page) => {
      await page.goto('/')
      await expect(page.getByRole('main')).toBeVisible()
    },
    dark: 'always',
  },
  {
    name: 'sign-up',
    open: async (page) => {
      await page.goto('/sign-up')
      await expect(page.getByRole('region', { name: 'Sign up' })).toBeVisible()
    },
    dark: 'device',
  },
  {
    name: 'sign-in',
    open: async (page) => {
      await page.goto('/sign-in')
      await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible()
    },
    dark: 'device',
  },
  {
    name: 'cabinet',
    open: async (page) => {
      await stubCabinet(page, 'populated')
      await page.goto('/dashboard')
      await expect(page.getByRole('list', { name: 'Projects' })).toBeVisible()
    },
    column: (page) => page.locator('.dashboard-main'),
    frame: (page) => page.locator('.dashboard-body'),
    dark: 'device',
  },
  {
    name: 'crash screen',
    open: async (page) => {
      await page.goto(`/?error-test=render&marker=e2e-sweep-${Date.now()}`)
      await expect(page.getByRole('alert')).toHaveText(/^Something went wrong\./)
    },
    dark: 'device',
  },
]

const brandMark = (page: Page) => page.locator('.brand .brand-mark').filter({ visible: true }).first()
const markup = (mark: Locator) => mark.evaluate((element) => element.outerHTML)
const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor)

test('the same brand mark leads from the landing page to sign-up, sign-in and the cabinet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await stubCabinet(page, 'populated')
  await page.goto('/')
  const landing = await markup(brandMark(page))

  await (await heroStarts(page)).emailSignUp.click()
  await expect(page.getByRole('region', { name: 'Sign up' })).toBeVisible()
  expect(await markup(brandMark(page)), 'brand mark on sign-up').toBe(landing)

  await page.getByRole('link', { name: 'I already have an account' }).click()
  await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible()
  expect(await markup(brandMark(page)), 'brand mark on sign-in').toBe(landing)

  await page.goto('/dashboard')
  await expect(page.getByRole('list', { name: 'Projects' })).toBeVisible()
  expect(await markup(brandMark(page)), 'brand mark in the cabinet').toBe(landing)

  await screens.find(({ name }) => name === 'crash screen')!.open(page)
  expect(await markup(brandMark(page)), 'brand mark on the crash screen').toBe(landing)
})

for (const screen of screens) {
  test.describe(screen.name, () => {
    test('shows the brand mark at 360, 768 and 1440 px', async ({ page }) => {
      await screen.open(page)
      for (const width of [360, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await expect(brandMark(page), `brand mark at ${width} px`).toBeVisible()
      }
    })

    test('fits 360, 768 and 1440 px, and at 1440 px keeps its column centred and at most 1200 px wide', async ({ page }) => {
      await screen.open(page)
      await expectNoSidewaysScroll(page, [360, 768, 1440])
      await page.setViewportSize({ width: 1440, height: 900 })
      const column = (await (screen.column?.(page) ?? page.getByRole('main')).boundingBox())!
      const frame = (await (screen.frame?.(page) ?? page.locator('body')).boundingBox())!
      expect(column.width, 'column width').toBeLessThanOrEqual(maxColumn)
      const left = column.x - frame.x
      const right = frame.x + frame.width - (column.x + column.width)
      expect(Math.abs(left - right), 'left and right margins differ').toBeLessThanOrEqual(1)
    })

    if (screen.dark === 'always') {
      test('stays dark under the light, the dark and no theme preference', async ({ page }) => {
        await screen.open(page)
        for (const colorScheme of ['light', 'dark', 'no-preference'] as const) {
          await page.emulateMedia({ colorScheme })
          await expect(page.locator('.palette-landing'), colorScheme).toHaveCSS('background-color', landingBackground)
        }
      })
    } else {
      test('follows the device theme, light when the device states no preference', async ({ page }) => {
        await screen.open(page)
        await expectFollowsDeviceTheme(page)
        await page.emulateMedia({ colorScheme: 'light' })
        const light = await background(page)
        await page.emulateMedia({ colorScheme: 'no-preference' })
        expect(await background(page)).toBe(light)
      })
    }

    test('shows a focus outline on every control and declares no motion under reduced motion', async ({ page }) => {
      await screen.open(page)
      await page.setViewportSize({ width: 1440, height: 900 })
      await expectVisibleFocusOnEveryControl(page)
      await expectNoMotionUnderReducedMotion(page)
    })

    test('loads no font or image from another origin', async ({ page }) => {
      const requests = recordRequests(page)
      await screen.open(page)
      await page.waitForLoadState('networkidle')
      requests.expectNoThirdPartyAssets()
    })
  })
}
