import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
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

/** Getting-started guidance for a list that loaded, until its first task exists. */
function guidance(projects: Project[]): string | null {
  if (projects.length === 0) return 'You have no projects yet. Start by creating your first project.'
  if (projects.every((project) => project.tasks.length === 0)) return 'Next, add a first task to your project.'
  return null
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
  }, [api, signedIn])

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

  const guide = projects && !loadFailed ? guidance(projects) : null
  const shown = status ? projects?.filter((project) => project.tasks.some((task) => task.status === status)) : projects

  return (
    <main className="page dashboard">
      <h1>Your projects</h1>
      <button type="button" onClick={signOutHere}>
        Sign out
      </button>
      {guide && <p className="dashboard-guide">{guide}</p>}
      <ProjectForm
        label="New project"
        submitLabel="Create project"
        idPrefix="new-project"
        save={(input) => saveProject(api, input)}
        onSaved={(created) => setProjects((current) => [...(current ?? []), created])}
      />
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
      {loadFailed && (
        <p className="auth-alert" role="alert">
          Could not load your projects. Try again later.
        </p>
      )}
      {!shown && !loadFailed && <p>Loading your projects…</p>}
      {loadFailed && shown && shown.length > 0 && <p>{createdNowLabel}</p>}
      {shown && (
        <ul className="project-list" aria-label={loadFailed ? createdNowLabel : 'Projects'}>
          {shown.map((project) => (
            <li key={project.id} aria-label={project.name}>
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
                <>
                  <h2>{project.name}</h2>
                  <p>{project.description}</p>
                </>
              )}
              <ul>
                {project.tasks.map((task) => (
                  <li key={task.id} aria-label={task.name}>
                    <span>{task.name}</span> <span>{statusLabels[task.status]}</span>
                    {(Object.keys(statusLabels) as TaskStatus[])
                      .filter((next) => next !== task.status)
                      .map((next) => (
                        <button
                          key={next}
                          type="button"
                          aria-label={`Mark ${task.name} ${statusLabels[next].toLowerCase()}`}
                          onClick={() => changeStatus(project.id, task, next)}
                        >
                          Mark {statusLabels[next].toLowerCase()}
                        </button>
                      ))}
                    {taskAlerts[task.id] && (
                      <p className="auth-alert" role="alert">
                        {taskAlerts[task.id]}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <ProjectForm
                label={`New task in ${project.name}`}
                submitLabel="Add task"
                idPrefix={`project-${project.id}-task`}
                validate={validateTask}
                save={(input) => createTask(api, project.id, input)}
                onSaved={(created) => updateTasks(project.id, (tasks) => [...tasks, created])}
              />
              {deleteAlerts[project.id] && (
                <p className="auth-alert" role="alert">
                  {deleteAlerts[project.id]}
                </p>
              )}
              <button type="button" aria-label={`Rename ${project.name}`} onClick={() => setRenaming(project.id)}>
                Rename
              </button>
              <button type="button" aria-label={`Delete ${project.name}`} onClick={() => remove(project.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default Dashboard
