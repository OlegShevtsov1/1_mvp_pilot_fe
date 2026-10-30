import { randomBytes } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { apiUrl } from './apiUrl.ts'
import { headline, heroStarts } from './landing.ts'

// Signs up a real account on the target backend. Sign-ups are limited per source IP (AC-04b), so the journey signs up
// exactly once, never signs in and never retries. The contract has no user deletion: the account stays behind.

const noProjects = 'You have no projects yet. Start by creating your first project.'
const addFirstTask = 'Next, add a first task to your project.'

const stamp = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`
const email = `e2e-${stamp}@example.com`
const password = randomBytes(18).toString('base64url')
const projectName = `E2E ${stamp}`
const taskName = `First task ${stamp}`

/** What the journey created and still owns, so a failure part-way leaves no project or task behind. */
const created: { api?: string; token?: string; projectId?: number; taskId?: number } = {}

test.setTimeout(120_000)

async function accessToken(page: Page): Promise<string> {
  const stored = await page.evaluate(() => localStorage.getItem('pilot.tokens'))
  const token = stored ? (JSON.parse(stored) as { accessToken?: string }).accessToken : undefined
  if (!token) throw new Error('no access token in localStorage after sign-up')
  return token
}

/** The id of the object a UI action creates, read from the backend's 201 answer. */
async function createdId(page: Page, path: RegExp, action: () => Promise<void>): Promise<number> {
  const answer = page.waitForResponse(
    (response) => response.request().method() === 'POST' && path.test(new URL(response.url()).pathname),
  )
  await action()
  const response = await answer
  expect(response.status()).toBe(201)
  return ((await response.json()) as { data: { id: number } }).data.id
}

async function removeCreated(request: APIRequestContext) {
  const { api, token, projectId, taskId } = created
  if (!api || !token) return
  const headers = { Authorization: `Bearer ${token}` }
  if (projectId !== undefined && taskId !== undefined) {
    await request.delete(`${api}/api/v1/projects/${projectId}/tasks/${taskId}`, { headers })
  }
  if (projectId !== undefined) await request.delete(`${api}/api/v1/projects/${projectId}`, { headers })
}

test.afterEach(async ({ request }) => {
  await removeCreated(request)
})

test('a new visitor signs up, creates a first project and task, completes it and signs out', async ({ page }) => {
  const api = await apiUrl(page)
  created.api = api

  // AC-01: the landing says what the app does and offers both starts.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(headline)
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible()
  const { starts, emailSignUp } = await heroStarts(page)
  for (const start of starts) await expect(start).toBeVisible()
  await emailSignUp.click()

  // AC-02: an e-mail sign-up signs the visitor in and opens the dashboard.
  await expect(page.getByRole('heading', { level: 1, name: 'Sign up' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign up', exact: true }).click()
  const dashboard = page.getByRole('heading', { level: 1, name: 'Your projects' })
  const refusal = page.getByRole('alert')
  await expect(dashboard.or(refusal)).toBeVisible({ timeout: 15_000 })
  if (await refusal.isVisible()) throw new Error(`sign-up refused: ${await refusal.innerText()}`)
  await expect(page).toHaveURL(/\/dashboard$/)
  created.token = await accessToken(page)

  // AC-21: the empty dashboard invites a first project.
  await expect(page.getByText(noProjects)).toBeVisible()
  await page.getByRole('button', { name: 'Create your first project' }).click()
  const projectForm = page.getByRole('form', { name: 'New project' })
  await projectForm.getByRole('textbox', { name: 'Name' }).fill(projectName)
  await projectForm.getByRole('textbox', { name: 'Description' }).fill('Created by the end-to-end journey.')
  created.projectId = await createdId(page, /^\/api\/v1\/projects$/, () =>
    projectForm.getByRole('button', { name: 'Create project' }).click(),
  )

  // AC-14 and AC-21: the project is listed and the guidance moves on to a first task.
  const project = page.getByRole('listitem', { name: projectName, exact: true })
  await expect(project.getByRole('heading', { name: projectName })).toBeVisible()
  await expect(page.getByText(addFirstTask)).toBeVisible()
  await page.getByRole('button', { name: 'Add a task', exact: true }).click()
  const taskForm = page.getByRole('form', { name: `New task in ${projectName}` })
  await taskForm.getByRole('textbox', { name: 'Name' }).fill(taskName)
  await taskForm.getByRole('textbox', { name: 'Description' }).fill('The first task of the journey.')
  created.taskId = await createdId(page, /^\/api\/v1\/projects\/\d+\/tasks$/, () =>
    taskForm.getByRole('button', { name: 'Add task' }).click(),
  )

  // AC-18 and AC-21: the task starts as not started, the guidance is gone, and the task can be completed.
  const task = project.getByRole('listitem', { name: taskName, exact: true })
  await expect(task).toContainText('Not started')
  await expect(page.getByText(addFirstTask)).toHaveCount(0)
  await task.getByRole('button', { name: `Mark ${taskName} completed` }).click()
  await expect(task).toContainText('Completed')
  await expect(task.getByRole('button', { name: `Mark ${taskName} completed` })).toHaveCount(0)

  // The UI has no task deletion and a project with tasks cannot be deleted (AC-16), so the task goes through the API.
  const removed = await page.request.delete(`${api}/api/v1/projects/${created.projectId}/tasks/${created.taskId}`, {
    headers: { Authorization: `Bearer ${created.token}` },
  })
  expect(removed.status()).toBe(204)
  created.taskId = undefined
  await page.reload()
  await page.getByRole('button', { name: `Delete ${projectName}` }).click()
  await expect(project).toHaveCount(0)
  created.projectId = undefined
  await expect(page.getByText(noProjects)).toBeVisible()

  // AC-11: signing out ends the session on the server too.
  const signedOut = page.waitForResponse(
    (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/sign_out',
  )
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await signedOut).status()).toBe(204)
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  const afterSignOut = await page.request.get(`${api}/api/v1/projects`, {
    headers: { Authorization: `Bearer ${created.token}` },
  })
  expect(afterSignOut.status()).toBe(401)
})
