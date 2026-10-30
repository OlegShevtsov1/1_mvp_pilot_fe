import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { createApiClient } from '../api/client.ts'
import type { DeleteResult, Project, Task, TaskStatus } from '../api/projects.ts'
import {
  changeTaskStatus,
  createTask,
  deleteProject,
  listProjects,
  saveProject,
  statusLabels,
  validateTask,
} from '../api/projects.ts'
import { signOut } from '../auth/credentials.ts'
import type { TokenStore } from '../auth/tokenStore.ts'
import { type Status, StatusIcon } from './Brand.tsx'
import { BrandMark } from './BrandMark.tsx'
import './AuthForm.css'
import './Dashboard.css'
import './Landing.css'
import ProjectForm from './ProjectForm.tsx'
import { paths } from './paths.ts'

interface DashboardProps {
  apiUrl: string
  clientId: string
  store: TokenStore
}

const deleteRefusals: Record<Exclude<DeleteResult, 'deleted'>, string> = {
  'has-tasks': 'A project that still has tasks cannot be deleted, so it was kept.',
  failed: 'Could not delete the project. Try again.',
}

const statusChangeFailed = 'Could not change the status. Try again.'

const statusIcons: Record<TaskStatus, Status> = { not_started: 'todo', in_progress: 'progress', completed: 'done' }

const icons = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  folder: 'M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z',
  logout: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10',
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M16 16l4 4',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
}

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg className={`dashboard-icon dashboard-icon-${name}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={icons[name]} />
    </svg>
  )
}

/** The state cards' drawn illustrations: a new folder, a magnifier or an error mark on a soft disc; decorative only. */
function Illustration({ kind }: { kind: 'add' | 'search' | 'error' }) {
  return (
    <svg className={`dashboard-illustration dashboard-illustration-${kind}`} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <circle className="dashboard-illustration-disc" cx="48" cy="48" r="44" />
      {kind === 'add' && <path d="M26 38a4 4 0 0 1 4-4h11l4 4h21a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4zM48 46v12M42 52h12" />}
      {kind === 'search' && <path d="M44 30a14 14 0 1 0 0 28a14 14 0 1 0 0-28M54 54l12 12" />}
      {kind === 'error' && <path d="M48 28v26M48 66v.5" />}
    </svg>
  )
}

const focusField = (selector: string) => document.querySelector<HTMLElement>(selector)?.focus()

/** Focuses the first candidate that can take focus: a hidden or removed element silently refuses it. */
function focusFirstOf(candidates: (HTMLElement | null)[]) {
  candidates.some((candidate) => {
    candidate?.focus()
    return candidate !== null && document.activeElement === candidate
  })
}

const editable = 'input, textarea, select, [contenteditable="true"]'

/** Getting-started guidance for a list that loaded, until its first task exists. */
function guidance(projects: Project[]): string | null {
  if (projects.length === 0) return 'You have no projects yet. Start by creating your first project.'
  if (projects.every((project) => project.tasks.length === 0)) return 'Next, add a first task to your project.'
  return null
}

/** The sidebar choice, status and search a project must match to be shown. */
function matchesFilters(selected: number | null, status: TaskStatus | '', query: string) {
  const needle = query.trim().toLowerCase()
  const matches = (name: string) => name.toLowerCase().includes(needle)
  return (project: Project) =>
    (selected === null || project.id === selected) &&
    (!status || project.tasks.some((task) => task.status === status)) &&
    (!needle || matches(project.name) || project.tasks.some((task) => matches(task.name)))
}

// After a failed load, `projects` holds only what was created here, so it must not read as the full list.
const createdNowLabel = 'Projects created just now'

function Dashboard({ apiUrl, clientId, store }: DashboardProps) {
  const navigate = useNavigate()
  const [signedIn] = useState(() => store.read() !== null)
  const [api] = useState(() =>
    createApiClient({ apiUrl, clientId, store, onSignedOut: () => navigate(paths.signIn, { replace: true }) }),
  )
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [renaming, setRenaming] = useState<number | null>(null)
  const [deleteAlerts, setDeleteAlerts] = useState<Record<number, string>>({})
  const [taskAlerts, setTaskAlerts] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)
  const [attempt, setAttempt] = useState(0)
  const [composing, setComposing] = useState(false)
  const [addingTo, setAddingTo] = useState<number | null>(null)
  const composerOpener = useRef<HTMLElement | null>(null)
  const returnFocus = useRef(false)
  const hasProjects = Boolean(projects?.length)
  const shown = projects?.filter(matchesFilters(selected, status, query))
  const firstShown = shown?.[0]?.id

  // A form that is already open keeps its fields, so it only takes focus; a newly opened one focuses itself.
  const openComposer = (opener: HTMLElement | null) => {
    if (!composing) composerOpener.current = opener
    setComposing(true)
    focusField('#new-project-name')
    closeMenu()
  }
  const closeComposer = () => {
    returnFocus.current = true
    setComposing(false)
  }
  const openTask = (projectId: number) => {
    setAddingTo(projectId)
    focusField(`#project-${projectId}-task-name`)
  }
  const closeTask = (projectId: number) => {
    setAddingTo(null)
    focusField(`#project-${projectId}-add-task`)
  }
  // With projects, only a shown project's task form is a target: the new project form would turn a task into a project.
  const newTask = (opener: HTMLElement | null) => {
    if (!hasProjects) openComposer(opener)
    else if (firstShown !== undefined) openTask(firstShown)
  }

  useEffect(() => {
    if (!signedIn) return
    const controller = new AbortController()
    listProjects(api, controller.signal).then((loaded) => {
      if (controller.signal.aborted) return
      // A project created before the list arrived is kept unless the list already has it.
      setProjects((created) =>
        loaded ? [...loaded, ...(created ?? []).filter(({ id }) => !loaded.some((project) => project.id === id))] : created,
      )
      setLoadFailed(loaded === null)
    })
    return () => controller.abort()
  }, [api, signedIn, attempt])

  // Runs after the commit that closed the form, so an opener that the same update removed is no longer a candidate.
  useEffect(() => {
    if (composing || !returnFocus.current) return
    returnFocus.current = false
    // Below 48rem the sidebar is closed and hidden, so its button cannot take focus; the menu toggle stands in for it.
    focusFirstOf([
      composerOpener.current,
      document.querySelector<HTMLElement>('#dashboard-new-project'),
      document.querySelector<HTMLElement>('#dashboard-menu'),
    ])
  }, [composing])

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key === 'Escape') return closeMenu()
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest(editable)) return
      if (event.key === '/') {
        event.preventDefault()
        focusField('#dashboard-search')
      } else if (event.key === 'n') {
        event.preventDefault()
        newTask(null)
      }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  })

  if (!signedIn) return <Navigate to={paths.signIn} replace />

  const updateProject = (id: number, update: (project: Project) => Project) =>
    setProjects((current) => current?.map((project) => (project.id === id ? update(project) : project)) ?? null)

  const updateTasks = (projectId: number, update: (tasks: Task[]) => Task[]) =>
    updateProject(projectId, (project) => ({ ...project, tasks: update(project.tasks) }))

  const showRenamed = (saved: Project) => {
    updateProject(saved.id, () => saved)
    setRenaming(null)
  }

  async function remove(id: number) {
    const result = await deleteProject(api, id)
    if (result === 'deleted') {
      setProjects((current) => current?.filter((project) => project.id !== id) ?? null)
      setSelected((current) => (current === id ? null : current))
    } else {
      setDeleteAlerts((current) => ({ ...current, [id]: deleteRefusals[result] }))
    }
  }

  async function changeStatus(projectId: number, task: Task, next: TaskStatus) {
    const result = await changeTaskStatus(api, projectId, task.id, next)
    if (result.kind === 'saved') {
      updateTasks(projectId, (tasks) => tasks.map((shownTask) => (shownTask.id === task.id ? result.saved : shownTask)))
    }
    const alert = result.kind === 'saved' ? '' : result.kind === 'fields' ? result.errors.status : undefined
    setTaskAlerts((current) => ({ ...current, [task.id]: alert ?? statusChangeFailed }))
  }

  function signOutHere() {
    void signOut(api)
    store.clear()
    navigate(paths.signIn, { replace: true })
  }

  const choose = (id: number | null) => {
    setSelected(id)
    closeMenu()
  }

  const clearFilters = () => {
    setStatus('')
    setQuery('')
    setSelected(null)
  }

  const guide = projects && !loadFailed ? guidance(projects) : null
  const guideAction = !hasProjects ? 'Create your first project' : shown?.length ? 'Add a task' : null
  const brand = (
    <Link className="brand" to={paths.landing}>
      <BrandMark />
      Pilot App
    </Link>
  )

  return (
    <div className="dashboard">
      <aside id="dashboard-sidebar" className={menuOpen ? 'dashboard-sidebar is-open' : 'dashboard-sidebar'}>
        <div className="dashboard-sidebar-head">{brand}</div>
        <nav className="dashboard-sidebar-body" aria-label="Project navigation">
          <button
            type="button"
            id="dashboard-new-project"
            className="button button-primary dashboard-wide"
            aria-expanded={composing}
            onClick={(event) => openComposer(event.currentTarget)}
          >
            <Icon name="plus" />
            New project
          </button>
          <p className="dashboard-caption">Projects</p>
          <ul className="dashboard-nav">
            <li>
              <button type="button" aria-current={selected === null} onClick={() => choose(null)}>
                <Icon name="grid" />
                All projects
              </button>
            </li>
            {(projects ?? []).map((project) => (
              <li key={project.id}>
                <button type="button" aria-current={selected === project.id} onClick={() => choose(project.id)}>
                  <Icon name="folder" />
                  <span className="dashboard-nav-name">{project.name}</span>
                  <span className="dashboard-count" aria-hidden="true">
                    {project.tasks.length}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="dashboard-sidebar-foot">
          <p className="dashboard-shortcuts">
            <kbd>n</kbd> new task <kbd>/</kbd> search
          </p>
          <button type="button" className="button dashboard-wide" onClick={signOutHere}>
            <Icon name="logout" />
            Sign out
          </button>
        </div>
      </aside>
      {menuOpen && <div className="dashboard-scrim" aria-hidden="true" />}
      <div className="dashboard-body">
        <header className="dashboard-topbar">
          <button
            type="button"
            id="dashboard-menu"
            className="dashboard-toggle"
            aria-label="Projects menu"
            aria-expanded={menuOpen}
            aria-controls="dashboard-sidebar"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          {brand}
        </header>
        <div className="dashboard-search">
          <Icon name="search" />
          <input
            type="search"
            id="dashboard-search"
            placeholder="Search"
            aria-label="Search projects and tasks"
            aria-keyshortcuts="/"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd aria-hidden="true">/</kbd>
        </div>
        <main className="dashboard-main">
          <h1>Your projects</h1>
          <div className="dashboard-card dashboard-filter-card">
            <div className="dashboard-chips" role="group" aria-label="Filter by status">
              {Object.entries({ '': 'All', ...statusLabels }).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value as TaskStatus | '')}>
                  {label}
                </button>
              ))}
            </div>
            <div className="dashboard-filter">
              <label htmlFor="task-status">Task status</label>
              <select id="task-status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | '')}>
                <option value="">All statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {guide && (
            <div className="dashboard-card dashboard-state">
              <Illustration kind="add" />
              <p>{guide}</p>
              {guideAction && (
                <button type="button" className="button button-primary" onClick={(event) => newTask(event.currentTarget)}>
                  {guideAction}
                </button>
              )}
            </div>
          )}
          {composing && (
            <ProjectForm
              className="dashboard-card"
              label="New project"
              submitLabel="Create project"
              idPrefix="new-project"
              autoFocus
              save={(input) => saveProject(api, input)}
              onSaved={(created) => {
                setProjects((current) => [...(current ?? []), created])
                closeComposer()
              }}
              onCancel={closeComposer}
            />
          )}
          {loadFailed && (
            <div className="dashboard-card dashboard-state">
              <Illustration kind="error" />
              <p className="alert alert-error" role="alert">
                Could not load your projects. Try again later.
              </p>
              <button type="button" className="button" onClick={() => setAttempt((count) => count + 1)}>
                <Icon name="refresh" />
                Retry
              </button>
            </div>
          )}
          {!shown && !loadFailed && (
            <div className="dashboard-skeleton" role="status">
              <p className="dashboard-loading">
                <span className="dashboard-ring" aria-hidden="true" />
                Loading your projects…
              </p>
              {[1, 2, 3].map((row) => (
                <div key={row} className="dashboard-card dashboard-placeholder" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          )}
          {loadFailed && shown && shown.length > 0 && <p>{createdNowLabel}</p>}
          {shown && (
            <ul className="project-list" aria-label={loadFailed ? createdNowLabel : 'Projects'}>
              {shown.map((project) => (
                <li key={project.id} className="dashboard-card dashboard-project" aria-label={project.name}>
                  <div className="dashboard-project-head">
                    {renaming === project.id ? (
                      <ProjectForm
                        label={`Rename ${project.name}`}
                        submitLabel="Save"
                        idPrefix={`project-${project.id}`}
                        initial={{ name: project.name, description: project.description }}
                        save={(input) => saveProject(api, input, project.id)}
                        onSaved={showRenamed}
                        onCancel={() => setRenaming(null)}
                      />
                    ) : (
                      <div className="dashboard-project-title">
                        <h2>{project.name}</h2>
                        <p>{project.description}</p>
                      </div>
                    )}
                    <div className="dashboard-actions">
                      <button type="button" className="button" aria-label={`Rename ${project.name}`} onClick={() => setRenaming(project.id)}>
                        <Icon name="edit" />
                        Rename
                      </button>
                      <button
                        type="button"
                        className="button dashboard-danger"
                        aria-label={`Delete ${project.name}`}
                        onClick={() => remove(project.id)}
                      >
                        <Icon name="trash" />
                        Delete
                      </button>
                    </div>
                  </div>
                  {deleteAlerts[project.id] && (
                    <p className="alert alert-error" role="alert">
                      {deleteAlerts[project.id]}
                    </p>
                  )}
                  <ul>
                    {project.tasks.map((task) => (
                      <li key={task.id} className="task-row" aria-label={task.name}>
                        <StatusIcon status={statusIcons[task.status]} />
                        <span className="task-name">{task.name}</span>{' '}
                        <span className={`dashboard-chip dashboard-chip-${statusIcons[task.status]}`}>{statusLabels[task.status]}</span>
                        <span className="dashboard-actions">
                          {(Object.keys(statusLabels) as TaskStatus[])
                            .filter((next) => next !== task.status)
                            .map((next) => (
                              <button
                                key={next}
                                type="button"
                                className="button"
                                aria-label={`Mark ${task.name} ${statusLabels[next].toLowerCase()}`}
                                onClick={() => changeStatus(project.id, task, next)}
                              >
                                Mark {statusLabels[next].toLowerCase()}
                              </button>
                            ))}
                        </span>
                        {taskAlerts[task.id] && (
                          <p className="alert alert-error" role="alert">
                            {taskAlerts[task.id]}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="task-composer">
                    <button
                      type="button"
                      id={`project-${project.id}-add-task`}
                      aria-label={`Add task to ${project.name}`}
                      aria-expanded={addingTo === project.id}
                      onClick={() => openTask(project.id)}
                    >
                      <Icon name="plus" />
                      Add task
                    </button>
                    {addingTo === project.id && (
                      <ProjectForm
                        label={`New task in ${project.name}`}
                        submitLabel="Add task"
                        idPrefix={`project-${project.id}-task`}
                        validate={validateTask}
                        autoFocus
                        save={(input) => createTask(api, project.id, input)}
                        onSaved={(created) => {
                          updateTasks(project.id, (tasks) => [...tasks, created])
                          closeTask(project.id)
                        }}
                        onCancel={() => closeTask(project.id)}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {shown?.length === 0 && projects?.length !== 0 && (
            <div className="dashboard-card dashboard-state">
              <Illustration kind="search" />
              <p>No project matches these filters.</p>
              <button type="button" className="button button-primary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default Dashboard
