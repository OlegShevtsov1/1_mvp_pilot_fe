import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { cabinetProjects, type CabinetState, stubCabinet } from './support/cabinet.ts'
import { expectVisibleFocusOnEveryControl } from './support/focus.ts'
import { expectNoMotionUnderReducedMotion } from './support/motion.ts'
import { expectFollowsDeviceTheme } from './support/theme.ts'
import { expectNoSidewaysScroll } from './support/viewport.ts'

// Fictional data: the list endpoint is stubbed, so these checks need no account and change nothing on the server.
const projects = [
  {
    id: 1,
    name: 'Website launch',
    description: 'Everything for the new site going live',
    tasks: [
      { id: 11, name: 'Write the launch copy', description: 'Hero and feature texts', status: 'completed' },
      { id: 12, name: 'Review the pricing page', description: 'Check every plan', status: 'in_progress' },
      { id: 13, name: 'Plan the launch email', description: 'Draft and schedule it', status: 'not_started' },
    ],
  },
  {
    id: 2,
    name: 'Home move',
    description: 'Boxes, movers and the new address',
    tasks: [
      { id: 21, name: 'Book the movers', description: 'Saturday morning', status: 'completed' },
      { id: 22, name: 'Pack the kitchen', description: 'Plates last', status: 'in_progress' },
    ],
  },
  {
    id: 3,
    name: 'Reading list',
    description: 'Books to read this year and next',
    tasks: [{ id: 31, name: 'Pick a short novel', description: 'Under 300 pages', status: 'not_started' }],
  },
  { id: 4, name: 'Garden plans', description: 'Everything for the garden this spring', tasks: [] },
]

// Seeds a fake token pair and answers the list endpoint, also across origins when the API is on another host.
async function stubDashboard(page: Page, data: unknown[]) {
  await page.addInitScript(() =>
    localStorage.setItem('pilot.tokens', JSON.stringify({ accessToken: 'e2e', refreshToken: 'e2e' })),
  )
  await page.route('**/api/v1/projects', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': 'authorization, content-type',
          },
        })
      : route.fulfill({ json: { data }, headers: { 'access-control-allow-origin': '*' } }),
  )
}

// Callers emulate reduced motion, so no element is captured mid-animation.
async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready)
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

test('the dashboard fits a 360 px screen and opens its project drawer', async ({ page }, testInfo) => {
  await stubDashboard(page, projects)
  await page.setViewportSize({ width: 360, height: 780 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await screenshot(page, testInfo, 'dashboard-mobile-light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await screenshot(page, testInfo, 'dashboard-mobile-dark')

  await expect(page.getByRole('navigation', { name: 'Project navigation' })).toBeHidden()
  await page.getByRole('button', { name: 'Projects menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Project navigation' })).toBeVisible()
})

test('the dashboard follows the system theme', async ({ page }, testInfo) => {
  await stubDashboard(page, projects)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.goto('/dashboard')

  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
  await screenshot(page, testInfo, 'dashboard-desktop-light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(17, 19, 23)')
  await screenshot(page, testInfo, 'dashboard-desktop-dark')
})

test('an empty dashboard invites a first project', async ({ page }, testInfo) => {
  await stubDashboard(page, [])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const [device, width, height] of [
    ['desktop', 1440, 900],
    ['mobile', 360, 780],
  ] as const) {
    await page.setViewportSize({ width, height })
    await page.goto('/dashboard')
    await expect(page.getByText('You have no projects yet. Start by creating your first project.')).toBeVisible()
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme })
      await screenshot(page, testInfo, `dashboard-${device}-${theme}-empty`)
    }
  }
})

test('the search shortcut lands on a visibly focused field', async ({ page }) => {
  await stubDashboard(page, projects)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()

  await page.keyboard.press('/')
  const search = page.getByRole('searchbox', { name: 'Search projects and tasks' })
  await expect(search).toBeFocused()
  await expect(search).not.toHaveCSS('outline-style', 'none')
  await expect(search).not.toHaveCSS('outline-width', '0px')
})

test('the dashboard does not animate when reduced motion is requested', async ({ page }) => {
  await stubDashboard(page, projects)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard')

  await expect(page.locator('.task-row').first()).toHaveCSS('animation-name', 'none')
})

test('the desktop sidebar background runs the full page height and stays in view', async ({ page }) => {
  const many = Array.from({ length: 12 }, (_, index) => ({ ...projects[index % projects.length], id: index + 1 }))
  await stubDashboard(page, many)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()

  const column = await page.evaluate(() => {
    const strip = getComputedStyle(document.querySelector('.dashboard')!, '::before')
    return {
      height: strip.height,
      background: strip.backgroundColor,
      page: `${document.documentElement.scrollHeight}px`,
      sidebar: getComputedStyle(document.querySelector('#dashboard-sidebar')!).backgroundColor,
    }
  })
  expect(Number.parseFloat(column.page)).toBeGreaterThan(900)
  expect(column.height).toBe(column.page)
  expect(column.background).toBe(column.sidebar)

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.getByRole('navigation', { name: 'Project navigation' })).toBeInViewport()
})

test('closing the new project form on a 360 px screen keeps focus on a visible control', async ({ page }) => {
  await stubDashboard(page, projects)
  await page.setViewportSize({ width: 360, height: 780 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Projects menu' }).click()
  await page.getByRole('button', { name: 'New project' }).click()
  await expect(page.getByRole('form', { name: 'New project' }).getByLabel('Name')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('form', { name: 'New project' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Projects menu' })).toBeFocused()
})

test.describe('cabinet shell', () => {
  const openCabinet = async (page: Page, width: number) => {
    await stubCabinet(page, 'populated')
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { level: 2, name: cabinetProjects[0].name })).toBeVisible()
  }

  test('at 360 px the one toggle opens the drawer under the top bar and the toggle or Escape closes it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openCabinet(page, 360)
    const menu = page.getByRole('button', { name: 'Projects menu' })
    const nav = page.getByRole('navigation', { name: 'Project navigation' })
    await expect(nav).toBeHidden()

    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    await expect(nav).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeInViewport()
    const toggle = (await menu.boundingBox())!
    const drawer = (await page.locator('#dashboard-sidebar').boundingBox())!
    expect(drawer.y, 'the drawer starts under the top bar').toBeGreaterThanOrEqual(toggle.y + toggle.height)
    const onTop = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('#dashboard-menu') !== null,
      [toggle.x + toggle.width / 2, toggle.y + toggle.height / 2],
    )
    expect(onTop, 'the toggle stays reachable above the drawer and the scrim').toBe(true)
    await expectNoSidewaysScroll(page, [360])

    await menu.click()
    await expect(nav).toBeHidden()
    await menu.click()
    await expect(nav).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(nav).toBeHidden()
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
  })

  test('at 1440 px shows a 280 px sidebar and a 64 px top bar holding the search', async ({ page }) => {
    await openCabinet(page, 1440)
    await expect(page.getByRole('button', { name: 'Projects menu' })).toBeHidden()
    const sidebar = (await page.locator('#dashboard-sidebar').boundingBox())!
    const topbar = (await page.locator('.dashboard-topbar').boundingBox())!
    const search = (await page.getByRole('searchbox', { name: 'Search projects and tasks' }).boundingBox())!
    expect(sidebar.width).toBe(280)
    expect(topbar.height).toBe(64)
    expect(topbar.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width)
    expect(search.y).toBeGreaterThanOrEqual(topbar.y)
    expect(search.y + search.height).toBeLessThanOrEqual(topbar.y + topbar.height)
  })

  test('does not scroll sideways at 360, 768 and 1440 px', async ({ page }) => {
    await openCabinet(page, 360)
    await expectNoSidewaysScroll(page, [360, 768, 1440])
  })

  test('follows the device theme', async ({ page }) => {
    await openCabinet(page, 1440)
    await expectFollowsDeviceTheme(page)
  })

  for (const width of [360, 1440]) {
    test(`shows a focus outline on every control at ${width} px`, async ({ page }) => {
      await openCabinet(page, width)
      if (width === 360) await page.getByRole('button', { name: 'Projects menu' }).click()
      await expectVisibleFocusOnEveryControl(page)
    })
  }

  test('declares no animation or transition under reduced motion, with the drawer open', async ({ page }) => {
    await openCabinet(page, 360)
    await page.getByRole('button', { name: 'Projects menu' }).click()
    await expectNoMotionUnderReducedMotion(page)
  })
})

test.describe('cabinet states', () => {
  // Each state: the stubbed answer, how to reach it, and the restyled part that must show.
  const states: { name: string; stub: CabinetState; reach?: (page: Page) => Promise<void>; shows: (page: Page) => Promise<void> }[] = [
    {
      name: 'filled list',
      stub: 'populated',
      shows: async (page) => {
        await expect(page.locator('.dashboard-filter-card').getByRole('group', { name: 'Filter by status' })).toBeVisible()
        await expect(page.locator('.dashboard-filter-card').getByLabel('Task status')).toBeVisible()
        await expect(page.getByRole('listitem', { name: 'Write the launch copy' }).locator('.dashboard-chip')).toHaveText('Completed')
      },
    },
    {
      name: 'loading',
      stub: 'loading',
      shows: async (page) => {
        await expect(page.getByRole('status')).toHaveText('Loading your projects…')
        await expect(page.locator('.dashboard-ring')).toBeVisible()
      },
    },
    {
      name: 'empty list',
      stub: 'empty',
      shows: async (page) => {
        await expect(page.getByText('You have no projects yet. Start by creating your first project.')).toBeVisible()
        await expect(page.locator('.dashboard-illustration')).toBeVisible()
      },
    },
    {
      name: 'first task',
      stub: 'guidance',
      shows: async (page) => {
        await expect(page.getByText('Next, add a first task to your project.')).toBeVisible()
        await expect(page.locator('.dashboard-illustration')).toBeVisible()
      },
    },
    {
      name: 'no match',
      stub: 'populated',
      reach: (page) => page.getByRole('searchbox', { name: 'Search projects and tasks' }).fill('zzz'),
      shows: async (page) => {
        await expect(page.getByText('No project matches these filters.')).toBeVisible()
        await expect(page.locator('.dashboard-illustration')).toBeVisible()
      },
    },
    {
      name: 'load failure',
      stub: 'failure',
      shows: async (page) => {
        await expect(page.getByRole('alert')).toHaveText('Could not load your projects. Try again later.')
        await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
        await expect(page.locator('.dashboard-illustration-error')).toBeVisible()
      },
    },
    {
      name: 'delete refused',
      stub: 'delete-refused',
      reach: (page) => page.getByRole('button', { name: `Delete ${cabinetProjects[0].name}` }).click(),
      shows: async (page) => {
        const alert = page.getByRole('listitem', { name: cabinetProjects[0].name }).getByRole('alert')
        await expect(alert).toHaveText('A project that still has tasks cannot be deleted, so it was kept.')
        await expect(alert).toHaveClass(/alert-error/)
      },
    },
    {
      name: 'new-project form',
      stub: 'empty',
      reach: (page) => page.getByRole('button', { name: 'Create your first project' }).click(),
      shows: async (page) => {
        await expect(page.getByRole('form', { name: 'New project' })).toHaveClass(/dashboard-card/)
        await expect(page.getByRole('button', { name: 'Create project' })).toBeVisible()
      },
    },
  ]

  for (const state of states) {
    for (const width of [360, 1440]) {
      test(`${state.name} at ${width} px: fits, follows the theme, shows focus and does not move`, async ({ page }) => {
        await stubCabinet(page, state.stub)
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/dashboard')
        await expect(page.getByRole('heading', { level: 1, name: 'Your projects' })).toBeVisible()
        if (state.stub !== 'loading' && state.stub !== 'failure') {
          await expect(page.getByText(/Loading your projects/)).toBeHidden()
        }
        await state.reach?.(page)
        await state.shows(page)
        await expectNoSidewaysScroll(page, [width])
        await expectFollowsDeviceTheme(page)
        await expectNoMotionUnderReducedMotion(page)
        await expectVisibleFocusOnEveryControl(page, page.getByRole('main'))
      })
    }
  }
})
