import { expect, test } from '@playwright/test'
import { cabinetProjects, stubCabinet } from './support/cabinet.ts'
import { recordRequests } from './support/requests.ts'

// Proves the helpers the screen specs reuse, against the landing page and the stubbed cabinet.

test.describe('landing page', () => {
  // The landing page's own width, theme, focus, motion and request checks live in landing.spec.ts (T14).
  test('reports a third-party font request', async ({ page }) => {
    const requests = recordRequests(page)
    await page.route('https://fonts.example.test/**', (route) => route.fulfill({ body: '', contentType: 'font/woff2' }))
    await page.goto('/')
    await page.evaluate(() => new FontFace('Elsewhere', 'url(https://fonts.example.test/a.woff2)').load().catch(() => null))
    expect(() => requests.expectNoThirdPartyAssets()).toThrow(/fonts\.example\.test/)
  })
})

test.describe('stubbed cabinet', () => {
  test('lists the stubbed projects', async ({ page }) => {
    await stubCabinet(page, 'populated')
    await page.goto('/dashboard')
    await expect(page.getByText(cabinetProjects[0].name).first()).toBeVisible()
  })

  test('offers a filter over projects that differ by task status', async ({ page }) => {
    await stubCabinet(page, 'filtered')
    await page.goto('/dashboard')
    await expect(page.getByText(cabinetProjects[0].name).first()).toBeVisible()
  })

  test('invites a first project when the list is empty', async ({ page }) => {
    await stubCabinet(page, 'empty')
    await page.goto('/dashboard')
    await expect(page.getByText('You have no projects yet. Start by creating your first project.')).toBeVisible()
  })

  test('guides the first task of a project without tasks', async ({ page }) => {
    await stubCabinet(page, 'guidance')
    await page.goto('/dashboard')
    await expect(page.getByRole('button', { name: /add a task/i }).first()).toBeVisible()
  })

  test('shows the loading state until the list is released', async ({ page }) => {
    const stub = await stubCabinet(page, 'loading')
    await page.goto('/dashboard')
    await expect(page.getByText('Loading your projects…')).toBeVisible()
    stub.release()
    await expect(page.getByText('Loading your projects…')).toBeHidden()
  })

  test('shows the load failure message', async ({ page }) => {
    await stubCabinet(page, 'failure')
    await page.goto('/dashboard')
    await expect(page.getByRole('alert')).toHaveText('Could not load your projects. Try again later.')
  })

  test('answers a delete of a project that still has tasks with 422', async ({ page }) => {
    await stubCabinet(page, 'delete-refused')
    await page.goto('/dashboard')
    const status = await page.evaluate(
      async (id) => (await fetch(`${window.APP_CONFIG?.API_URL ?? ''}/api/v1/projects/${id}`, { method: 'DELETE' })).status,
      1,
    )
    expect(status).toBe(422)
  })
})
