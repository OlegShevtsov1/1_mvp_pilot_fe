// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())

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
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())

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
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())

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

    await vi.waitFor(() => expect(projectHeadings()).toEqual(['Home chores', 'Garden plans']))
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

    const projectForm = screen.getByRole('form', { name: 'New project' })
    fill(projectForm, 'Reading list', 'Books to read this year and next')
    fireEvent.click(within(projectForm).getByRole('button', { name: 'Create project' }))
    expect(await screen.findByText(firstTask)).toBeTruthy()
    expect(screen.queryByText(firstProject)).toBeNull()

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
})
