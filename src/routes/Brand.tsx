export type Status = 'todo' | 'progress' | 'done'

export function StatusIcon({ status }: { status: Status }) {
  return (
    <svg className={`landing-status landing-status-${status}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" />
      {status === 'done' && <path d="M5 8.2l2 2 4-4.2" />}
    </svg>
  )
}
