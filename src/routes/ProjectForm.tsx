import { type FormEvent, useState } from 'react'
import { type ProjectInput, type SaveErrors, type SaveResult, validateProject } from '../api/projects.ts'
import './AuthForm.css'
import TextField from './TextField.tsx'

interface ProjectFormProps<T> {
  label: string
  idPrefix: string
  submitLabel: string
  initial?: ProjectInput
  save: (input: ProjectInput) => Promise<SaveResult<T>>
  onSaved: (saved: T) => void
  validate?: (input: ProjectInput) => SaveErrors
  onCancel?: () => void
}

const empty: ProjectInput = { name: '', description: '' }
const fields = [
  { field: 'name', label: 'Name' },
  { field: 'description', label: 'Description' },
] as const

function ProjectForm<T>({
  label,
  idPrefix,
  submitLabel,
  initial = empty,
  save,
  onSaved,
  onCancel,
  validate = validateProject,
}: ProjectFormProps<T>) {
  const [input, setInput] = useState<ProjectInput>(initial)
  const [errors, setErrors] = useState<SaveErrors>({})
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFailed(false)
    const invalid = validate(input)
    setErrors(invalid)
    if (Object.keys(invalid).length > 0) return
    setPending(true)
    const result = await save(input)
    setPending(false)
    if (result.kind === 'saved') {
      setInput(initial)
      onSaved(result.saved)
    } else if (result.kind === 'fields') {
      setErrors(result.errors)
    } else {
      setFailed(true)
    }
  }

  return (
    <form className="auth-form" aria-label={label} noValidate onSubmit={submit}>
      {fields.map(({ field, label }) => (
        <TextField
          key={field}
          id={`${idPrefix}-${field}`}
          label={label}
          type="text"
          autoComplete="off"
          value={input[field]}
          error={errors[field]}
          onChange={(value) => setInput((current) => ({ ...current, [field]: value }))}
        />
      ))}
      {failed && (
        <p className="auth-alert" role="alert">
          Something went wrong. Try again.
        </p>
      )}
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}

export default ProjectForm
