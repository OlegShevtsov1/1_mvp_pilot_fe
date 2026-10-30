import { BrandMark } from './routes/BrandMark.tsx'

/** A browser window with an error badge, drawn in our own code; decorative only. */
function CrashIllustration() {
  return (
    <svg className="crash-illustration" viewBox="0 0 280 200" aria-hidden="true" focusable="false">
      <rect className="crash-window" x="30" y="20" width="220" height="150" rx="12" />
      <rect className="crash-window-bar" x="31" y="21" width="218" height="26" rx="11" />
      <circle className="crash-window-dot" cx="50" cy="34" r="4" />
      <circle className="crash-window-dot" cx="64" cy="34" r="4" />
      <circle className="crash-window-dot" cx="78" cy="34" r="4" />
      <rect className="crash-window-line" x="56" y="66" width="90" height="10" rx="5" />
      <rect className="crash-window-line" x="56" y="86" width="130" height="10" rx="5" />
      <rect className="crash-window-line" x="56" y="106" width="70" height="10" rx="5" />
      <circle className="crash-badge" cx="200" cy="130" r="36" />
      <path className="crash-badge-mark" d="M200 112v22M200 147v.5" />
    </svg>
  )
}

// Renders in Sentry.ErrorBoundary outside the router, so the brand is not a link and no action is offered.
export default function ErrorFallback({ reported }: { reported: boolean }) {
  return (
    <div className="page crash">
      <header className="page-header">
        <span className="brand">
          <BrandMark />
          Pilot App
        </span>
      </header>
      <main className="crash-main">
        <CrashIllustration />
        <p className="crash-message" role="alert">
          Something went wrong.
          {reported && (
            <>
              {' '}
              <span className="crash-message-detail">The error was reported.</span>
            </>
          )}
        </p>
      </main>
    </div>
  )
}
