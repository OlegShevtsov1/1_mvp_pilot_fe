import type { Page } from '@playwright/test'
import type { Project } from '../../src/api/projects.ts'

export type CabinetState = 'populated' | 'filtered' | 'empty' | 'guidance' | 'loading' | 'failure' | 'delete-refused'

// Fictional data, typed from the contract types the app uses. `filtered` serves this list too: the screen spec applies
// the filter in the UI, and the statuses below give every filter something to keep and something to hide.
export const cabinetProjects: Project[] = [
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

const withoutTasks: Project[] = [cabinetProjects[3]]

const cors = { 'access-control-allow-origin': '*' }

/**
 * Plants a stored token pair before the page loads and answers the cabinet's project requests in the browser. The
 * `loading` state holds the list answer until `release()` is called; `delete-refused` answers a delete with 422.
 */
export async function stubCabinet(page: Page, state: CabinetState): Promise<{ release(): void }> {
  await page.addInitScript(() =>
    localStorage.setItem('pilot.tokens', JSON.stringify({ accessToken: 'e2e', refreshToken: 'e2e' })),
  )
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  const preflight = {
    ...cors,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE',
  }

  await page.route('**/api/v1/projects', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: preflight })
    if (state === 'loading') await released
    if (state === 'failure') return route.fulfill({ status: 500, json: { errors: ['Something went wrong'] }, headers: cors })
    const data = state === 'empty' ? [] : state === 'guidance' ? withoutTasks : cabinetProjects
    return route.fulfill({ json: { data }, headers: cors })
  })
  await page.route('**/api/v1/projects/*', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: preflight })
    return state === 'delete-refused' && route.request().method() === 'DELETE'
      ? route.fulfill({ status: 422, json: { errors: ['Project has tasks'] }, headers: cors })
      : route.fulfill({ status: 204, headers: cors })
  })
  return { release }
}
