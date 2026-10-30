interface TextFieldProps {
  id: string
  label: string
  type: 'email' | 'password' | 'text'
  autoComplete: string
  autoFocus?: boolean
  value: string
  error?: string
  onChange: (value: string) => void
}

/** The circled exclamation mark of field messages and alerts; decorative, the text says it all. */
export function AlertIcon() {
  return (
    <svg className="auth-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  )
}

function TextField({ id, label, error, onChange, ...input }: TextFieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        name={id}
        {...input}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p className="auth-field-error" id={errorId}>
          <AlertIcon />
          {error}
        </p>
      )}
    </div>
  )
}

export default TextField
