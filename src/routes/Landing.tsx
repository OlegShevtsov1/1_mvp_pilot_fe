import { Link } from 'react-router'
import { type Status, StatusIcon } from './Brand.tsx'
import './Landing.css'
import { SiteFooterBar, SiteHeader } from './SiteChrome.tsx'
import { paths } from './paths.ts'

const previewProjects = ['Website launch', 'Home move', 'Reading list']
const previewTasks: [string, Status][] = [
  ['Write the launch copy', 'done'],
  ['Review the pricing page', 'progress'],
  ['Plan the launch email', 'todo'],
  ['Collect first feedback', 'todo'],
]
const chipLabels: Record<Status, string> = { done: 'Completed', progress: 'In progress', todo: 'Not started' }

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

const steps = [
  ['Create a project', 'Give it a name and, if you like, a short description.'],
  ['Add its tasks', 'Every new task starts as not started.'],
  ['Move them to done', 'Mark a task in progress, then completed, and filter to see what is left.'],
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
    <div className="landing palette-landing">
      <SiteHeader />
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <p className="landing-badge">
            <span className="landing-badge-dot" />
            Personal projects and tasks
          </p>
          <h1 id="landing-title" className="landing-title">
            Every project and every task in one calm place
          </h1>
          <p className="landing-lead">
            Pilot App keeps your personal projects and their tasks in one place: create a project, add tasks and move
            each one from not started to done.
          </p>
          <Starts starts={starts.hero[variant]} />
          <Preview />
        </section>
        <section className="landing-features" aria-labelledby="landing-features-title">
          <p className="landing-eyebrow">Features</p>
          <h2 id="landing-features-title">Everything a personal plan needs</h2>
          <p className="landing-sub">Projects, tasks and three statuses. Nothing you have to set up first.</p>
          <div className="landing-feature-grid">
            {[...features, signInFeature(google)].map(({ title, text, icon }) => (
              <article className="landing-feature" key={title}>
                <span className="landing-icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d={icon} />
                  </svg>
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-steps" aria-labelledby="landing-steps-title">
          <p className="landing-eyebrow">How it works</p>
          <h2 id="landing-steps-title">From a first idea to done in three steps</h2>
          <div className="landing-step-grid">
            {steps.map(([title, text], index) => (
              <article className="landing-step" key={title}>
                <p className="landing-step-number" aria-hidden="true">
                  0{index + 1}
                </p>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-final" aria-labelledby="landing-final-title">
          <h2 id="landing-final-title">Start your first project in a minute</h2>
          <p className="landing-sub">Your projects and tasks are visible only to you.</p>
          <Starts starts={starts.final[variant]} />
        </section>
      </main>
      <SiteFooterBar />
    </div>
  )
}

function Starts({ starts: [primary, secondary] }: { starts: [Start, Start] }) {
  return (
    <div className="landing-starts">
      <Link className="button landing-start landing-start-primary" to={primary.to}>
        {primary.label}
      </Link>
      <Link className="button landing-start landing-start-secondary" to={secondary.to}>
        {secondary.label}
      </Link>
    </div>
  )
}

/** A decorative mock of the dashboard over a glowing orb; hidden from assistive technology, it loads no real data. */
function Preview() {
  return (
    <div className="landing-preview" aria-hidden="true">
      <div className="landing-orb" />
      <div className="landing-ring" />
      <div className="landing-preview-window">
        <div className="landing-preview-bar">
          <span />
          <span />
          <span />
        </div>
        <div className="landing-preview-body">
          <div className="landing-preview-sidebar">
            <p className="landing-preview-caption">Projects</p>
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
                <span className="landing-preview-name">{name}</span>
                <span className={`landing-chip landing-chip-${status}`}>{chipLabels[status]}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Landing
