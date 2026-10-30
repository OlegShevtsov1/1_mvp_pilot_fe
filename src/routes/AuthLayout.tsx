import type { ReactNode } from 'react'
import { Link } from 'react-router'
import './AuthForm.css'
import { BrandMark } from './BrandMark.tsx'
import { SiteFooter } from './SiteChrome.tsx'
import { AlertIcon } from './TextField.tsx'
import { paths } from './paths.ts'

interface AuthLayoutProps {
  title: string
  /** The link to the other auth screen, shown in the card head. */
  switchLink: ReactNode
  /** Google's sign-in button when it is offered; the "or with email" divider shows only with it. */
  google?: ReactNode
  children: ReactNode
}

/** Sign-up and sign-in: the brand at the top left, one centred card, the way back and the legal links below it. */
export function AuthLayout({ title, switchLink, google, children }: AuthLayoutProps) {
  return (
    <div className="auth">
      <svg className="auth-wave" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M0 120 C 260 40 520 220 820 150 S 1280 60 1440 110 V260 H0z" />
        <path d="M0 190 C 300 120 620 260 940 200 S 1300 150 1440 180 V260 H0z" />
      </svg>
      <header className="auth-header">
        <Link className="brand" to={paths.landing}>
          <BrandMark />
          Pilot App
        </Link>
      </header>
      <main className="auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-head">
            <h1 id="auth-title">{title}</h1>
            {switchLink}
          </div>
          {google && (
            <>
              <div className="auth-google">{google}</div>
              <p className="auth-divider">or with email</p>
            </>
          )}
          {children}
        </section>
        <Link className="link auth-back" to={paths.landing}>
          <svg className="auth-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to the start
        </Link>
        <SiteFooter />
      </main>
    </div>
  )
}

export function AuthAlert({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  return (
    <p className={`alert alert-${tone}`} role="alert">
      <AlertIcon />
      <span>{children}</span>
    </p>
  )
}
