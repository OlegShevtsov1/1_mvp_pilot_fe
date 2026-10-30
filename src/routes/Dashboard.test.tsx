// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStore } from '../auth/tokenStore.testSupport.ts'
import Dashboard from './Dashboard.tsx'

const apiUrl = 'https://api.example.test'

const projects = [
  {
    id: 1,
    name: 'Home chores',
    description: 'Things to do around the house',
    tasks: [
      { id: 11, name: 'Buy milk', description: 'Two litres of whole milk', status: 'not_started' },
      { id: 12, name: 'Fix the door', description: 'The back door squeaks', status: 'completed' },
    ],
  },
  {
    id: 2,
    name: 'Garden plans',
    description: 'Everything for the garden this spring',
    tasks: [{ id: 21, name: 'Plant roses', description: 'Along the south fence', status: 'in_progress' }],
  },
  { id: 3, name: 'Empty project', description: '<img src=x onerror=alert(1)> stays plain text', tasks: [] },
]

type Routed = Record<string, () => Response | Promise<Response>>

function renderDashboard(routes: Routed = {}, { signedIn = true } = {}) {
  const routed: Routed = { [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: projects }), ...routes }
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const answer = routed[`${init?.method ?? 'GET'} ${String(input)}`]
    return answer ? answer() : new Response('unrouted', { status: 500 })
  })
  vi.stubGlobal('fetch', fetch)
  const store = memoryStore()
  if (signedIn) store.pair = { accessToken: 'a1', refreshToken: 'r1' }
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard apiUrl={apiUrl} clientId="web-client" store={store} />} />
        <Route path="/sign-in" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  return { fetch, store }
}

function sentBody(fetch: ReturnType<typeof renderDashboard>['fetch'], method: string, path = ''): unknown {
  const call = fetch.mock.calls.find(([url, init]) => init?.method === method && String(url).endsWith(path))
  return JSON.parse(String(call?.[1]?.body))
}

function fill(form: HTMLElement, name: string, description: string) {
  fireEvent.change(within(form).getByLabelText('Name'), { target: { value: name } })
  fireEvent.change(within(form).getByLabelText('Description'), { target: { value: description } })
}

function projectHeadings(): string[] {
  return screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent ?? '')
}

function openNewProject() {
  const nav = within(screen.getByRole('navigation', { name: 'Project navigation' }))
  fireEvent.click(nav.getByRole('button', { name: 'New project' }))
}

async function openTaskForm(projectName: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Add task to ${projectName}` }))
}

describe('Dashboard', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("dashboard lists the signed-in user's projects with their tasks and statuses", async () => {
    const { fetch } = renderDashboard()

    expect(await screen.findByRole('heading', { level: 2, name: 'Home chores' })).toBeTruthy()
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project'])
    const home = within(screen.getByRole('listitem', { name: 'Home chores' }))
    for (const text of ['Buy milk', 'Not started', 'Fix the door', 'Completed']) expect(home.getByText(text)).toBeTruthy()
    expect(screen.getByText('<img src=x onerror=alert(1)> stays plain text')).toBeTruthy()
    expect(document.querySelector('img')).toBeNull()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${apiUrl}/api/v1/projects`)
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer a1')
  })

  it('the status filter shows only projects that have tasks in that status', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const filter = screen.getByLabelText('Task status')

    fireEvent.change(filter, { target: { value: 'completed' } })
    expect(projectHeadings()).toEqual(['Home chores'])
    fireEvent.change(filter, { target: { value: 'in_progress' } })
    expect(projectHeadings()).toEqual(['Garden plans'])
    fireEvent.change(filter, { target: { value: '' } })
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project'])
  })

  it('creating a project with a valid name and description shows it on the dashboard', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    const { fetch } = renderDashboard({
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Reading list' })).toBeTruthy()
    expect(sentBody(fetch, 'POST')).toEqual({
      project: { name: 'Reading list', description: 'Books to read this year and next' },
    })
  })

  it('a project created while the list is still loading stays once the list arrives', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    let releaseList: (response: Response) => void = () => {}
    const { fetch } = renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () => new Promise((resolve) => (releaseList = resolve)),
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Reading list' })).toBeTruthy()

    releaseList(Response.json({ data: projects }))
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project', 'Reading list'])
  })

  it('a project created while the list is loading appears once when the list already has it', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    let releaseList: (response: Response) => void = () => {}
    const { fetch } = renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () => new Promise((resolve) => (releaseList = resolve)),
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))
    await screen.findByRole('heading', { level: 2, name: 'Reading list' })

    releaseList(Response.json({ data: [...projects, created] }))
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project', 'Reading list'])
  })

  it('a project created while the list is loading is not shown as the whole list when the load fails', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    let releaseList: (response: Response) => void = () => {}
    const { fetch } = renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () => new Promise((resolve) => (releaseList = resolve)),
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))
    await screen.findByRole('heading', { level: 2, name: 'Reading list' })

    releaseList(new Response(null, { status: 500 }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not load your projects. Try again later.')
    expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull()
  })

  it('a project created after the list failed to load is shown apart from the missing list', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () => new Response(null, { status: 500 }),
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await screen.findByRole('alert')

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))

    const createdList = await screen.findByRole('list', { name: 'Projects created just now' })
    expect(within(createdList).getByRole('heading', { level: 2, name: 'Reading list' })).toBeTruthy()
    expect(screen.getByText('Projects created just now')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Could not load your projects. Try again later.')
    expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull()
  })

  it('renaming a project shows the new name', async () => {
    const renamed = { ...projects[0], name: 'House chores' }
    const { fetch } = renderDashboard({
      [`PUT ${apiUrl}/api/v1/projects/1`]: () => Response.json({ data: renamed }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Home chores' }))

    const form = screen.getByRole('form', { name: 'Rename Home chores' })
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'House chores' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'House chores' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Home chores' })).toBeNull()
    expect(sentBody(fetch, 'PUT')).toEqual({
      project: { name: 'House chores', description: 'Things to do around the house' },
    })
  })

  it('a name or description outside the limits is not saved and shows the allowed length', async () => {
    const { fetch } = renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'abc', 'too short')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))

    expect(within(form).getByText('Name must be 5 to 20 characters.')).toBeTruthy()
    expect(within(form).getByText('Description must be 20 to 120 characters.')).toBeTruthy()
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('a length refusal from the server keeps the old name and shows the allowed length', async () => {
    renderDashboard({
      [`PUT ${apiUrl}/api/v1/projects/1`]: () =>
        Response.json({ errors: ['Name is too long (maximum is 20 characters)'] }, { status: 422 }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Home chores' }))

    const form = screen.getByRole('form', { name: 'Rename Home chores' })
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'House chores' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))

    expect(await within(form).findByText('Name must be 5 to 20 characters.')).toBeTruthy()
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Home chores' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'House chores' })).toBeNull()
  })

  it('deleting a project that still has tasks keeps it and explains why', async () => {
    renderDashboard({
      [`DELETE ${apiUrl}/api/v1/projects/1`]: () =>
        Response.json({ errors: ['A project that still has tasks cannot be deleted'] }, { status: 422 }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Home chores' }))

    const home = screen.getByRole('listitem', { name: 'Home chores' })
    expect((await within(home).findByRole('alert')).textContent).toBe(
      'A project that still has tasks cannot be deleted, so it was kept.',
    )
    expect(within(home).getByText('Buy milk')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Home chores' })).toBeTruthy()
  })

  it('deleting an empty project removes it from the dashboard', async () => {
    renderDashboard({ [`DELETE ${apiUrl}/api/v1/projects/3`]: () => new Response(null, { status: 204 }) })
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Empty project' }))

    await waitFor(() => expect(projectHeadings()).toEqual(['Home chores', 'Garden plans']))
  })

  it('a delete that fails for another reason keeps the project and says so', async () => {
    renderDashboard({ [`DELETE ${apiUrl}/api/v1/projects/3`]: () => new Response(null, { status: 500 }) })
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Empty project' }))

    const empty = screen.getByRole('listitem', { name: 'Empty project' })
    expect((await within(empty).findByRole('alert')).textContent).toBe('Could not delete the project. Try again.')
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project'])
  })

  it('a list that could not be loaded says so instead of showing an empty dashboard', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => new Response(null, { status: 500 }) })

    expect((await screen.findByRole('alert')).textContent).toBe('Could not load your projects. Try again later.')
    expect(screen.queryByText('Loading your projects…')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Projects' })).toBeNull()
  })

  it('a signed-out device opening the dashboard is sent to sign-in and loads nothing', async () => {
    const { fetch } = renderDashboard({}, { signedIn: false })

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
    expect(projectHeadings()).toEqual([])
  })

  it('a device whose tokens were revoked is sent to sign-in and shown no project', async () => {
    const { store } = renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () => new Response(null, { status: 401 }),
      [`POST ${apiUrl}/oauth/token`]: () => Response.json({ error: 'invalid_grant' }, { status: 400 }),
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
    expect(store.pair).toBeNull()
    expect(projectHeadings()).toEqual([])
  })

  it('adding a task with a name and description shows it as not started', async () => {
    const created = { id: 31, name: 'Water plants', description: 'Every other morning', status: 'not_started' }
    const { fetch } = renderDashboard({
      [`POST ${apiUrl}/api/v1/projects/3/tasks`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await openTaskForm('Empty project')
    const form = await screen.findByRole('form', { name: 'New task in Empty project' })
    fill(form, 'Water plants', 'Every other morning')
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    const task = await within(screen.getByRole('listitem', { name: 'Empty project' })).findByRole('listitem', {
      name: 'Water plants',
    })
    expect(within(task).getByText('Not started')).toBeTruthy()
    expect(sentBody(fetch, 'POST', '/tasks')).toEqual({
      task: { name: 'Water plants', description: 'Every other morning', status: 'not_started' },
    })
  })

  it("one click changes a task's status and the dashboard shows it", async () => {
    const { fetch } = renderDashboard({
      [`PUT ${apiUrl}/api/v1/projects/1/tasks/11`]: () =>
        Response.json({ data: { ...projects[0].tasks[0], status: 'in_progress' } }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Buy milk in progress' }))

    const task = screen.getByRole('listitem', { name: 'Buy milk' })
    expect(await within(task).findByText('In progress', { selector: 'span' })).toBeTruthy()
    expect(within(task).queryByText('Not started', { selector: 'span' })).toBeNull()
    expect(sentBody(fetch, 'PUT')).toEqual({ task: { status: 'in_progress' } })
    fireEvent.change(screen.getByLabelText('Task status'), { target: { value: 'in_progress' } })
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans'])
  })

  it('a task in progress is completed with one click', async () => {
    renderDashboard({
      [`PUT ${apiUrl}/api/v1/projects/2/tasks/21`]: () =>
        Response.json({ data: { ...projects[1].tasks[0], status: 'completed' } }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Plant roses completed' }))

    const task = screen.getByRole('listitem', { name: 'Plant roses' })
    expect(await within(task).findByText('Completed', { selector: 'span' })).toBeTruthy()
  })

  it('an empty task name or description is not saved and says what is allowed', async () => {
    const { fetch } = renderDashboard()
    await openTaskForm('Empty project')
    const form = await screen.findByRole('form', { name: 'New task in Empty project' })
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    expect(within(form).getByText('Name must not be empty.')).toBeTruthy()
    expect(within(form).getByText('Description must not be empty.')).toBeTruthy()
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/tasks'))).toBe(false)
  })

  it('a status the server refuses keeps the old status and shows the allowed statuses', async () => {
    renderDashboard({
      [`PUT ${apiUrl}/api/v1/projects/1/tasks/11`]: () =>
        Response.json({ errors: ["'archived' is not a valid status"] }, { status: 422 }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Buy milk in progress' }))

    const task = screen.getByRole('listitem', { name: 'Buy milk' })
    expect((await within(task).findByRole('alert')).textContent).toBe(
      'Status must be Not started, In progress or Completed.',
    )
    expect(within(task).getByText('Not started', { selector: 'span' })).toBeTruthy()
  })

  it('a task the server refuses for an empty name shows what is allowed', async () => {
    renderDashboard({
      [`POST ${apiUrl}/api/v1/projects/3/tasks`]: () => Response.json({ errors: ["Name can't be blank"] }, { status: 422 }),
    })
    await openTaskForm('Empty project')
    const form = await screen.findByRole('form', { name: 'New task in Empty project' })
    fill(form, 'Water plants', 'Every other morning')
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    expect(await within(form).findByText('Name must not be empty.')).toBeTruthy()
  })

  it('a task the server refuses for an empty description shows what is allowed', async () => {
    renderDashboard({
      [`POST ${apiUrl}/api/v1/projects/3/tasks`]: () =>
        Response.json({ errors: ["Description can't be blank"] }, { status: 422 }),
    })
    await openTaskForm('Empty project')
    const form = await screen.findByRole('form', { name: 'New task in Empty project' })
    fill(form, 'Water plants', 'Every other morning')
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    expect(await within(form).findByText('Description must not be empty.')).toBeTruthy()
    expect(screen.queryByRole('listitem', { name: 'Water plants' })).toBeNull()
  })

  it('a user with no projects is guided to a first project and then to a first task', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    const task = { id: 41, name: 'Pick a book', description: 'Something short', status: 'not_started' }
    renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [] }),
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
      [`POST ${apiUrl}/api/v1/projects/4/tasks`]: () => Response.json({ data: task }, { status: 201 }),
    })
    const firstProject = 'You have no projects yet. Start by creating your first project.'
    const firstTask = 'Next, add a first task to your project.'
    expect(await screen.findByText(firstProject)).toBeTruthy()

    openNewProject()
    const projectForm = screen.getByRole('form', { name: 'New project' })
    fill(projectForm, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(projectForm).getByRole('button', { name: 'Create project' }))
    expect(await screen.findByText(firstTask)).toBeTruthy()
    expect(screen.queryByText(firstProject)).toBeNull()

    await openTaskForm('Reading list')
    const taskForm = screen.getByRole('form', { name: 'New task in Reading list' })
    fill(taskForm, 'Pick a book', 'Something short')
    fireEvent.click(within(taskForm).getByRole('button', { name: 'Add task' }))
    const shown = await screen.findByRole('listitem', { name: 'Pick a book' })
    expect(within(shown).getByText('Not started', { selector: 'span' })).toBeTruthy()
    expect(screen.queryByText(firstTask)).toBeNull()
  })

  it('a list that failed to load shows no getting-started guidance', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => new Response(null, { status: 500 }) })
    await screen.findByRole('alert')

    expect(screen.queryByText(/You have no projects yet/)).toBeNull()
    expect(screen.queryByText(/add a first task/)).toBeNull()
  })

  it("signing out revokes this device's token, clears its tokens and shows sign-in", async () => {
    const { fetch, store } = renderDashboard({
      [`POST ${apiUrl}/api/v1/sign_out`]: () => new Response(null, { status: 204 }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
    expect(store.pair).toBeNull()
    const calls = fetch.mock.calls.filter(([url]) => String(url) === `${apiUrl}/api/v1/sign_out`)
    expect(calls).toHaveLength(1)
    expect(new Headers(calls[0][1]?.headers).get('Authorization')).toBe('Bearer a1')
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/oauth/revoke'))).toBe(false)
  })

  it("sign-out still clears this device's tokens when the server cannot be reached", async () => {
    const { store } = renderDashboard({
      [`POST ${apiUrl}/api/v1/sign_out`]: () => Promise.reject(new TypeError('offline')),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
    expect(store.pair).toBeNull()
  })

  it('sign-out clears this device\'s tokens and shows sign-in at once, even while the server has not answered', async () => {
    const { store } = renderDashboard({ [`POST ${apiUrl}/api/v1/sign_out`]: () => new Promise<Response>(() => {}) })
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy()
    expect(store.pair).toBeNull()
  })

  it('a created project appears in the sidebar and choosing it shows only that project', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    renderDashboard({
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))
    await screen.findByRole('heading', { level: 2, name: 'Reading list' })

    const nav = within(screen.getByRole('navigation', { name: 'Project navigation' }))
    const choice = nav.getByRole('button', { name: 'Reading list' })
    fireEvent.click(choice)
    expect(choice.getAttribute('aria-current')).toBe('true')
    expect(projectHeadings()).toEqual(['Reading list'])
    fireEvent.click(nav.getByRole('button', { name: 'All projects' }))
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project', 'Reading list'])
  })

  it('renaming a project renames it in the sidebar', async () => {
    const renamed = { ...projects[0], name: 'House chores' }
    renderDashboard({ [`PUT ${apiUrl}/api/v1/projects/1`]: () => Response.json({ data: renamed }) })
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Home chores' }))

    const form = screen.getByRole('form', { name: 'Rename Home chores' })
    fireEvent.change(within(form).getByLabelText('Name'), { target: { value: 'House chores' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Save' }))
    await screen.findByRole('heading', { level: 2, name: 'House chores' })

    const nav = within(screen.getByRole('navigation', { name: 'Project navigation' }))
    expect(nav.getByRole('button', { name: 'House chores' })).toBeTruthy()
    expect(nav.queryByRole('button', { name: 'Home chores' })).toBeNull()
  })

  it('a list that failed to load can be retried', async () => {
    let calls = 0
    renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () =>
        ++calls === 1 ? new Response(null, { status: 500 }) : Response.json({ data: projects }),
    })
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('while the list loads, a skeleton announces it', async () => {
    const { fetch } = renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => new Promise<Response>(() => {}) })
    await waitFor(() => expect(fetch).toHaveBeenCalled())

    expect(screen.getByRole('status').textContent).toContain('Loading your projects…')
  })

  it('a status chip filters the projects and shows it is pressed', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const chips = within(screen.getByRole('group', { name: 'Filter by status' }))

    const completed = chips.getByRole('button', { name: 'Completed' })
    fireEvent.click(completed)
    expect(completed.getAttribute('aria-pressed')).toBe('true')
    expect(projectHeadings()).toEqual(['Home chores'])
    fireEvent.click(chips.getByRole('button', { name: 'All' }))
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project'])
  })

  it('slash focuses the search and the search keeps projects whose name or task matches', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    fireEvent.keyDown(document.body, { key: '/' })
    const search = screen.getByRole('searchbox', { name: 'Search projects and tasks' })
    expect(document.activeElement).toBe(search)
    fireEvent.change(search, { target: { value: 'roses' } })
    expect(projectHeadings()).toEqual(['Garden plans'])
    fireEvent.change(search, { target: { value: 'garden' } })
    expect(projectHeadings()).toEqual(['Garden plans'])
  })

  it("n focuses the name of the first project's new task", async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    fireEvent.keyDown(document.body, { key: 'n' })
    const form = screen.getByRole('form', { name: 'New task in Home chores' })
    expect(document.activeElement).toBe(within(form).getByLabelText('Name'))
  })

  it('shortcuts are ignored while typing in a field', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    const search = screen.getByRole('searchbox', { name: 'Search projects and tasks' })
    search.focus()
    fireEvent.keyDown(search, { key: 'n' })
    expect(document.activeElement).toBe(search)
  })

  it('the projects menu opens the drawer and choosing a project closes it', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const menu = screen.getByRole('button', { name: 'Projects menu' })
    const nav = within(screen.getByRole('navigation', { name: 'Project navigation' }))

    expect(menu.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(nav.getByRole('button', { name: 'Garden plans' }))
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(menu)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(menu.getAttribute('aria-expanded')).toBe('false')
  })

  it('the first-project invitation moves focus to the new project form', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [] }) })

    fireEvent.click(await screen.findByRole('button', { name: 'Create your first project' }))
    const form = screen.getByRole('form', { name: 'New project' })
    expect(document.activeElement).toBe(within(form).getByLabelText('Name'))
  })

  it('closing the new project form returns focus to the invitation that opened it', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [] }) })

    const invitation = await screen.findByRole('button', { name: 'Create your first project' })
    fireEvent.click(invitation)
    fireEvent.keyDown(within(screen.getByRole('form', { name: 'New project' })).getByLabelText('Name'), { key: 'Escape' })
    expect(document.activeElement).toBe(invitation)
  })

  it('creating the first project while a filter hides it returns focus to the new project button', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    renderDashboard({
      [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [] }),
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })

    const invitation = await screen.findByRole('button', { name: 'Create your first project' })
    fireEvent.click(within(screen.getByRole('group', { name: 'Filter by status' })).getByRole('button', { name: 'Completed' }))
    fireEvent.click(invitation)
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))

    await screen.findByText('No project matches these filters.')
    expect(screen.queryByRole('button', { name: 'Create your first project' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New project' }))
  })

  it('the add-a-task invitation moves focus to the first new task form', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [projects[2]] }) })

    fireEvent.click(await screen.findByRole('button', { name: 'Add a task' }))
    const form = screen.getByRole('form', { name: 'New task in Empty project' })
    expect(document.activeElement).toBe(within(form).getByLabelText('Name'))
  })

  it('with every project filtered out, neither n nor the invitation leads to the new project form', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [projects[2]] }) })
    await screen.findByRole('heading', { level: 2, name: 'Empty project' })

    fireEvent.click(within(screen.getByRole('group', { name: 'Filter by status' })).getByRole('button', { name: 'Completed' }))
    expect(screen.getByText('No project matches these filters.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add a task' })).toBeNull()
    fireEvent.keyDown(document.body, { key: 'n' })
    expect(screen.queryByRole('form', { name: 'New project' })).toBeNull()
  })

  it('a search that matches nothing offers to clear it and clearing shows every project again', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const search = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search projects and tasks' })

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(projectHeadings()).toEqual([])
    expect(screen.getByText('No project matches these filters.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project'])
    expect(search.value).toBe('')
    expect(screen.queryByText('No project matches these filters.')).toBeNull()
  })

  it('clearing filters also clears the chosen project and the status chip', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const nav = within(screen.getByRole('navigation', { name: 'Project navigation' }))
    const chips = within(screen.getByRole('group', { name: 'Filter by status' }))

    fireEvent.click(nav.getByRole('button', { name: 'Garden plans' }))
    fireEvent.click(chips.getByRole('button', { name: 'Completed' }))
    expect(projectHeadings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(projectHeadings()).toEqual(['Home chores', 'Garden plans', 'Empty project'])
    expect(nav.getByRole('button', { name: 'All projects' }).getAttribute('aria-current')).toBe('true')
    expect(chips.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('deleting the chosen project goes back to all projects', async () => {
    renderDashboard({ [`DELETE ${apiUrl}/api/v1/projects/3`]: () => new Response(null, { status: 204 }) })
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const nav = within(screen.getByRole('navigation', { name: 'Project navigation' }))

    fireEvent.click(nav.getByRole('button', { name: 'Empty project' }))
    expect(projectHeadings()).toEqual(['Empty project'])
    fireEvent.click(screen.getByRole('button', { name: 'Delete Empty project' }))

    await waitFor(() => expect(projectHeadings()).toEqual(['Home chores', 'Garden plans']))
    expect(nav.getByRole('button', { name: 'All projects' }).getAttribute('aria-current')).toBe('true')
    expect(nav.queryByRole('button', { name: 'Empty project' })).toBeNull()
  })

  it('the new project form opens from the sidebar and closes on Escape or Cancel', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const open = within(screen.getByRole('navigation', { name: 'Project navigation' })).getByRole('button', {
      name: 'New project',
    })

    expect(screen.queryByRole('form', { name: 'New project' })).toBeNull()
    expect(open.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(open)
    const name = within(screen.getByRole('form', { name: 'New project' })).getByLabelText('Name')
    expect(open.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(name)
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(screen.queryByRole('form', { name: 'New project' })).toBeNull()
    expect(document.activeElement).toBe(open)

    fireEvent.click(open)
    fireEvent.click(within(screen.getByRole('form', { name: 'New project' })).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('form', { name: 'New project' })).toBeNull()
  })

  it('creating a project closes the new project form', async () => {
    const created = { id: 4, name: 'Reading list', description: 'Books to read this year and next', tasks: [] }
    renderDashboard({
      [`POST ${apiUrl}/api/v1/projects`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    fill(form, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(form).getByRole('button', { name: 'Create project' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Reading list' })).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'New project' })).toBeNull()
  })

  it('each project offers one add-task button that opens its task fields and Escape closes them', async () => {
    renderDashboard()
    const button = await screen.findByRole('button', { name: 'Add task to Home chores' })

    expect(screen.queryByRole('form', { name: 'New task in Home chores' })).toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    const name = within(screen.getByRole('form', { name: 'New task in Home chores' })).getByLabelText('Name')
    expect(document.activeElement).toBe(name)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(screen.queryByRole('form', { name: 'New task in Home chores' })).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it('a task added successfully closes its fields', async () => {
    const created = { id: 31, name: 'Water plants', description: 'Every other morning', status: 'not_started' }
    renderDashboard({
      [`POST ${apiUrl}/api/v1/projects/3/tasks`]: () => Response.json({ data: created }, { status: 201 }),
    })
    await openTaskForm('Empty project')
    const form = screen.getByRole('form', { name: 'New task in Empty project' })
    fill(form, 'Water plants', 'Every other morning')
    fireEvent.click(within(form).getByRole('button', { name: 'Add task' }))

    const task = await screen.findByRole('listitem', { name: 'Water plants' })
    expect(within(task).getByText('Not started', { selector: 'span' })).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'New task in Empty project' })).toBeNull()
  })

  it('n opens the task fields of the chosen project', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Project navigation' })).getByRole('button', { name: 'Garden plans' }))
    fireEvent.keyDown(document.body, { key: 'n' })
    const form = screen.getByRole('form', { name: 'New task in Garden plans' })
    expect(document.activeElement).toBe(within(form).getByLabelText('Name'))
  })
})

describe('Dashboard shell', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const sidebar = () => document.getElementById('dashboard-sidebar')!

  it('captions the project list "Projects" inside the project navigation', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const nav = within(screen.getByRole('navigation', { name: 'Project navigation' }))
    expect(nav.getByText('Projects', { selector: '.dashboard-caption' })).toBeTruthy()
  })

  it('opens the sidebar with the brand mark in its head, above New project', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const head = sidebar().querySelector('.dashboard-sidebar-head')
    const brand = within(head as HTMLElement).getByRole('link', { name: 'Pilot App' })
    expect(brand.querySelector('svg.brand-mark')).not.toBeNull()
    const newProject = within(sidebar()).getByRole('button', { name: 'New project' })
    expect(brand.compareDocumentPosition(newProject) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps New project, every project with its task count, the shortcuts hint and Sign out in the sidebar', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const side = within(sidebar())
    expect(side.getByRole('button', { name: 'New project' })).toBeTruthy()
    expect(side.getByRole('button', { name: 'All projects' })).toBeTruthy()
    expect(side.getByRole('button', { name: /^Home chores/ }).querySelector('.dashboard-count')?.textContent).toBe('2')
    expect(side.getByText('new task', { exact: false })).toBeTruthy()
    expect(side.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })

  it('puts the top bar and the search before the content', async () => {
    renderDashboard()
    const heading = await screen.findByRole('heading', { level: 1, name: 'Your projects' })
    const topbar = document.querySelector('.dashboard-topbar')!
    const search = screen.getByRole('searchbox', { name: 'Search projects and tasks' })
    expect(search.id).toBe('dashboard-search')
    expect(search.getAttribute('aria-keyshortcuts')).toBe('/')
    expect(topbar.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(search.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('main').contains(heading)).toBe(true)
    expect(screen.getByRole('main').contains(sidebar())).toBe(false)
  })

  it('shows the menu toggle as an icon button named "Projects menu" that switches to a close icon', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const menu = screen.getByRole('button', { name: 'Projects menu' })
    expect(menu.textContent).toBe('')
    expect(menu.getAttribute('aria-controls')).toBe('dashboard-sidebar')
    expect(menu.querySelector('svg.dashboard-icon-menu[aria-hidden="true"]')).not.toBeNull()
    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(menu.querySelector('svg.dashboard-icon-close[aria-hidden="true"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Projects menu' })).toBe(menu)
  })

  it('lays a scrim under the open drawer and removes it when Escape closes the drawer', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const menu = screen.getByRole('button', { name: 'Projects menu' })
    expect(document.querySelector('.dashboard-scrim')).toBeNull()
    fireEvent.click(menu)
    expect(sidebar().classList.contains('is-open')).toBe(true)
    expect(document.querySelector('.dashboard-scrim')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.dashboard-scrim')).toBeNull()
  })
})

describe('Dashboard cards and states', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const css = readFileSync(join(process.cwd(), 'src/routes/Dashboard.css'), 'utf8')
  const rule = (selector: string) => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? ''
  const before = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

  it("shows each task's status label as a chip beside its status icon, with the same text", async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    for (const [name, label, kind] of [
      ['Buy milk', 'Not started', 'todo'],
      ['Fix the door', 'Completed', 'done'],
      ['Plant roses', 'In progress', 'progress'],
    ]) {
      const row = screen.getByRole('listitem', { name })
      const chip = within(row).getByText(label, { selector: 'span' })
      expect(chip.classList.contains('dashboard-chip')).toBe(true)
      expect(chip.classList.contains(`dashboard-chip-${kind}`)).toBe(true)
      expect(before(row.querySelector('svg.landing-status')!, chip)).toBe(true)
    }
    expect(rule('.dashboard-chip-progress')).toContain('var(--color-status-progress-soft)')
    expect(rule('.dashboard-chip-done')).toContain('var(--color-status-done-soft)')
  })

  it('puts the status chips and the Task status select in one filter card before the projects', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const card = document.querySelector('.dashboard-filter-card')!
    expect(card.classList.contains('dashboard-card')).toBe(true)
    expect(within(card as HTMLElement).getByRole('group', { name: 'Filter by status' })).toBeTruthy()
    expect(within(card as HTMLElement).getByLabelText('Task status')).toBeTruthy()
    expect(before(card, screen.getByRole('list', { name: 'Projects' }))).toBe(true)
  })

  it('gives each project card a head with its name, Rename and Delete above its tasks and Add task', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    const card = screen.getByRole('listitem', { name: 'Home chores' })
    const head = within(card).getByRole('heading', { level: 2, name: 'Home chores' }).closest('.dashboard-project-head')!
    expect(head).not.toBeNull()
    expect(within(head as HTMLElement).getByRole('button', { name: 'Rename Home chores' })).toBeTruthy()
    expect(within(head as HTMLElement).getByRole('button', { name: 'Delete Home chores' })).toBeTruthy()
    expect(before(head, within(card).getByRole('listitem', { name: 'Buy milk' }))).toBe(true)
    expect(before(within(card).getByRole('listitem', { name: 'Fix the door' }), within(card).getByRole('button', { name: 'Add task to Home chores' }))).toBe(true)
  })

  it('shows the loading state as a status with a static ring and three placeholder cards', async () => {
    const { fetch } = renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => new Promise<Response>(() => {}) })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Loading your projects…')
    expect(status.querySelector('.dashboard-ring')?.getAttribute('aria-hidden')).toBe('true')
    const placeholders = status.querySelectorAll('.dashboard-card.dashboard-placeholder[aria-hidden="true"]')
    expect(placeholders).toHaveLength(3)
  })

  it('shows the empty-list guidance in a card with a drawn illustration and its button', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [] }) })
    const text = await screen.findByText('You have no projects yet. Start by creating your first project.')
    const card = text.closest('.dashboard-card.dashboard-state')!
    expect(card.querySelector('svg.dashboard-illustration[aria-hidden="true"]')).not.toBeNull()
    expect(within(card as HTMLElement).getByRole('button', { name: 'Create your first project' }).className).toContain('button-primary')
  })

  it('shows the first-task guidance in a card above the project cards', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => Response.json({ data: [projects[2]] }) })
    const text = await screen.findByText('Next, add a first task to your project.')
    const card = text.closest('.dashboard-card.dashboard-state')!
    expect(card.querySelector('svg.dashboard-illustration')).not.toBeNull()
    expect(within(card as HTMLElement).getByRole('button', { name: 'Add a task' })).toBeTruthy()
    expect(before(card, screen.getByRole('list', { name: 'Projects' }))).toBe(true)
  })

  it('shows the load failure as an error alert with an illustration and Retry in one card', async () => {
    renderDashboard({ [`GET ${apiUrl}/api/v1/projects`]: () => new Response('down', { status: 500 }) })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Could not load your projects. Try again later.')
    expect(alert.classList.contains('alert-error')).toBe(true)
    const card = alert.closest('.dashboard-card.dashboard-state')!
    expect(card.querySelector('svg.dashboard-illustration-error[aria-hidden="true"]')).not.toBeNull()
    expect(within(card as HTMLElement).getByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('shows no match in a card with an illustration and Clear filters', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search projects and tasks' }), { target: { value: 'zzz' } })
    const card = screen.getByText('No project matches these filters.').closest('.dashboard-card.dashboard-state')!
    expect(card.querySelector('svg.dashboard-illustration')).not.toBeNull()
    expect(within(card as HTMLElement).getByRole('button', { name: 'Clear filters' })).toBeTruthy()
  })

  it('shows a refused delete as an error alert inside the project card', async () => {
    renderDashboard({
      [`DELETE ${apiUrl}/api/v1/projects/1`]: () => Response.json({ errors: ['Project has tasks'] }, { status: 422 }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Home chores' }))
    const alert = await within(screen.getByRole('listitem', { name: 'Home chores' })).findByRole('alert')
    expect(alert.textContent).toBe('A project that still has tasks cannot be deleted, so it was kept.')
    expect(alert.classList.contains('alert-error')).toBe(true)
  })

  it('shows the new-project form as a card with a primary Create project button', async () => {
    renderDashboard()
    await screen.findByRole('heading', { level: 2, name: 'Home chores' })
    openNewProject()
    const form = screen.getByRole('form', { name: 'New project' })
    expect(form.classList.contains('dashboard-card')).toBe(true)
    expect(within(form).getByRole('button', { name: 'Create project' }).className).toContain('button-primary')
    expect(within(form).getByRole('button', { name: 'Cancel' }).className).toContain('button')
  })
})
