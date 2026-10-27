import { Link } from 'react-router'
import './Landing.css'
import { paths } from './paths.ts'

type Status = 'todo' | 'progress' | 'done'

const previewProjects = ['Website launch', 'Home move', 'Reading list']
const previewTasks: [string, Status][] = [
  ['Write the launch copy', 'done'],
  ['Review the pricing page', 'progress'],
  ['Plan the launch email', 'todo'],
  ['Collect first feedback', 'todo'],
]

const features = [
  {
    title: 'Projects that stay tidy',
    text: 'Create, rename and delete projects; each one keeps its own tasks.',
    icon: 'M4 6h16M4 12h16M4 18h10',
  },
  {
    title: 'Three clear statuses',
    text: 'Move every task from not started to in progress to completed.',
    icon: 'M5 12l4 4L19 6',
  },
  {
    title: 'Filter by status',
    text: 'Show only the projects with tasks in the status you care about now.',
    icon: 'M4 5h16l-6 8v5l-4 2v-7z',
  },
]

function signInFeature(google: boolean) {
  return {
    title: google ? 'Sign in your way' : 'Sign in with email',
    text: google
      ? 'Use your Google account or an email and password; your projects stay yours.'
      : 'Use your email and password; your projects stay yours.',
    icon: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
  }
}

type Start = { to: string; label: string }

const emailStarts: [Start, Start] = [
  { to: paths.signUp, label: 'Sign up' },
  { to: paths.signIn, label: 'Sign in' },
]

const starts: Record<'hero' | 'final', Record<'google' | 'email', [Start, Start]>> = {
  hero: {
    google: [
      { to: paths.signIn, label: 'Continue with Google' },
      { to: paths.signUp, label: 'Sign up with email and password' },
    ],
    email: emailStarts,
  },
  final: {
    google: [
      { to: paths.signIn, label: 'Start with Google' },
      { to: paths.signUp, label: 'Create an account with email' },
    ],
    email: emailStarts,
  },
}

function Landing({ google }: { google: boolean }) {
  const variant = google ? 'google' : 'email'
  return (
    <div className="landing">
      <header className="landing-header">
        <Link className="landing-brand" to={paths.landing}>
          <Logo />
          Pilot App
        </Link>
        <Link className="landing-start landing-start-secondary" to={paths.signIn}>
          Sign in
        </Link>
      </header>
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <h1 id="landing-title">Every project and every task in one calm place</h1>
          <p className="landing-lead">
            Pilot App keeps your personal projects and their tasks in one place: create a project, add tasks and move
            each one from not started to done.
          </p>
          <Starts starts={starts.hero[variant]} />
          <Preview />
        </section>
        <section className="landing-features" aria-labelledby="landing-features-title">
          <h2 id="landing-features-title">Everything a personal plan needs</h2>
          <div className="landing-feature-grid">
            {[...features, signInFeature(google)].map(({ title, text, icon }) => (
              <article className="landing-feature" key={title}>
                <svg className="landing-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d={icon} />
                </svg>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-final" aria-labelledby="landing-final-title">
          <h2 id="landing-final-title">Start your first project in a minute</h2>
          <Starts starts={starts.final[variant]} />
        </section>
      </main>
    </div>
  )
}

function Starts({ starts: [primary, secondary] }: { starts: [Start, Start] }) {
  return (
    <div className="landing-starts">
      <Link className="landing-start landing-start-primary" to={primary.to}>
        {primary.label}
      </Link>
      <Link className="landing-start landing-start-secondary" to={secondary.to}>
        {secondary.label}
      </Link>
    </div>
  )
}

function Logo() {
  return (
    <svg className="landing-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="20" height="20" rx="6" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  )
}

function StatusIcon({ status }: { status: Status }) {
  return (
    <svg className={`landing-status landing-status-${status}`} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6" />
      {status === 'done' && <path d="M5 8.2l2 2 4-4.2" />}
    </svg>
  )
}

/** A decorative mock of the dashboard; it is hidden from assistive technology and loads no real projects or tasks. */
function Preview() {
  return (
    <div className="landing-preview" aria-hidden="true">
      <div className="landing-preview-body">
        <div className="landing-preview-sidebar">
          <p>Projects</p>
          {previewProjects.map((name, index) => (
            <p className={index === 0 ? 'landing-preview-project is-active' : 'landing-preview-project'} key={name}>
              {name}
            </p>
          ))}
        </div>
        <div className="landing-preview-main">
          <p className="landing-preview-title">{previewProjects[0]}</p>
          {previewTasks.map(([name, status]) => (
            <p className="landing-preview-task" key={name}>
              <StatusIcon status={status} />
              {name}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Landing
