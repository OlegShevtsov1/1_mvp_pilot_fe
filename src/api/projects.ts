import type { ApiClient, ApiRequest } from './client.ts'

export type TaskStatus = 'not_started' | 'in_progress' | 'completed'
export const statusLabels: Record<TaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}

export interface Task { id: number; name: string; description: string; status: TaskStatus }
export interface Project { id: number; name: string; description: string; tasks: Task[] }
export interface ProjectInput { name: string; description: string }
export type SaveErrors = Partial<Record<'name' | 'description' | 'status', string>>
export type SaveResult<T> = { kind: 'saved'; saved: T } | { kind: 'fields'; errors: SaveErrors } | { kind: 'failed' }
export type DeleteResult = 'deleted' | 'has-tasks' | 'failed'

/** How a server `422` full message is recognised as naming a field, and what the field allows. */
interface Refusal { field: keyof SaveErrors; matches: (text: string) => boolean; message: string }

// Contract `Project.name` and `Project.description` lengths, counted in characters; the prefix is how the
// server's `422` full messages name the field.
const fields = [
  { field: 'name', prefix: 'Name', min: 5, max: 20, message: 'Name must be 5 to 20 characters.' },
  { field: 'description', prefix: 'Description', min: 20, max: 120, message: 'Description must be 20 to 120 characters.' },
] as const
const projectRefusals: Refusal[] = fields.map(({ field, prefix, message }) => ({
  field,
  matches: (text) => text.startsWith(prefix),
  message,
}))

export function validateProject(input: ProjectInput): SaveErrors {
  const errors: SaveErrors = {}
  for (const { field, min, max, message } of fields) {
    const length = [...input[field]].length
    if (length < min || length > max) errors[field] = message
  }
  return errors
}

const taskMessages = {
  name: 'Name must not be empty.',
  description: 'Description must not be empty.',
  status: 'Status must be Not started, In progress or Completed.',
}
// Rails names the field first, except the enum's `ArgumentError`, which `Tasks::Update` answers as "'x' is not a
// valid status".
const taskRefusals: Refusal[] = [
  { field: 'name', matches: (text) => text.startsWith('Name'), message: taskMessages.name },
  { field: 'description', matches: (text) => text.startsWith('Description'), message: taskMessages.description },
  {
    field: 'status',
    matches: (text) => text.startsWith('Status') || text.endsWith('is not a valid status'),
    message: taskMessages.status,
  },
]

/** Checks only the fields given: a status change sends the status alone. */
export function validateTask(input: Partial<Record<keyof SaveErrors, string>>): SaveErrors {
  const errors: SaveErrors = {}
  if (input.name !== undefined && input.name.trim() === '') errors.name = taskMessages.name
  if (input.description !== undefined && input.description.trim() === '') errors.description = taskMessages.description
  if (input.status !== undefined && !(input.status in statusLabels)) errors.status = taskMessages.status
  return errors
}

function property(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null && key in body ? (body as Record<string, unknown>)[key] : null
}

/** Maps the messages of a `422 ErrorList` to the fields they name; any other message fails the save. */
function refused(body: unknown, refusals: Refusal[]): SaveResult<never> {
  const messages = property(body, 'errors')
  if (!Array.isArray(messages) || messages.length === 0) return { kind: 'failed' }
  const errors: SaveErrors = {}
  for (const text of messages) {
    const named = refusals.find(({ matches }) => typeof text === 'string' && matches(text))
    if (!named) return { kind: 'failed' }
    errors[named.field] = named.message
  }
  return { kind: 'fields', errors }
}

/** Sends a create or update; `savedStatus` is the contract's success answer, which carries the saved `data`. */
async function save<T>(
  api: ApiClient,
  path: string,
  request: ApiRequest,
  savedStatus: number,
  refusals: Refusal[],
): Promise<SaveResult<T>> {
  try {
    const response = await api.request(path, request)
    if (response.status === 422) return refused(await response.json(), refusals)
    const data = response.status === savedStatus ? property(await response.json(), 'data') : null
    return typeof data === 'object' && data !== null ? { kind: 'saved', saved: data as T } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/** Contract operation `listProjects`; `null` when the list could not be loaded. */
export async function listProjects(api: ApiClient, signal?: AbortSignal): Promise<Project[] | null> {
  try {
    const response = await api.request('/api/v1/projects', { signal })
    const data = response.status === 200 ? property(await response.json(), 'data') : null
    return Array.isArray(data) ? (data as Project[]) : null
  } catch {
    return null
  }
}

/** Contract operation `createProject`, or `updateProject` when an `id` is given. */
export function saveProject(api: ApiClient, { name, description }: ProjectInput, id?: number): Promise<SaveResult<Project>> {
  const request = { method: id === undefined ? 'POST' : 'PUT', json: { project: { name, description } } }
  return id === undefined
    ? save(api, '/api/v1/projects', request, 201, projectRefusals)
    : save(api, `/api/v1/projects/${id}`, request, 200, projectRefusals)
}

/** Contract operation `deleteProject`; its `422` means the project still has tasks, so the body is not read. */
export async function deleteProject(api: ApiClient, id: number): Promise<DeleteResult> {
  try {
    const { status } = await api.request(`/api/v1/projects/${id}`, { method: 'DELETE' })
    return status === 204 ? 'deleted' : status === 422 ? 'has-tasks' : 'failed'
  } catch {
    return 'failed'
  }
}

/** Contract operation `createTask`; the status is sent because the backend does not default it. */
export function createTask(api: ApiClient, projectId: number, { name, description }: ProjectInput): Promise<SaveResult<Task>> {
  const json = { task: { name, description, status: 'not_started' } }
  return save(api, `/api/v1/projects/${projectId}/tasks`, { method: 'POST', json }, 201, taskRefusals)
}

/** Contract operation `updateTask` with the status alone. */
export function changeTaskStatus(api: ApiClient, projectId: number, taskId: number, status: TaskStatus): Promise<SaveResult<Task>> {
  const json = { task: { status } }
  return save(api, `/api/v1/projects/${projectId}/tasks/${taskId}`, { method: 'PUT', json }, 200, taskRefusals)
}
