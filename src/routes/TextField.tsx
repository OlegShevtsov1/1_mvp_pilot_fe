interface TextFieldProps {
  id: string
  label: string
  type: 'email' | 'password' | 'text'
  autoComplete: string
  value: string
  error?: string
  onChange: (value: string) => void
}

function TextField({ id, label, error, onChange, ...input }: TextFieldProps) {
  const errorId = `${id}-error`
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        {...input}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p className="auth-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}

export default TextField
