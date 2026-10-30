import type { ReactNode } from 'react'
import './Legal.css'
import { SiteFooterBar, SiteHeader } from './SiteChrome.tsx'

const effective = '29 October 2026'

interface LegalProps {
  /** The deployment's public contact address (SUPPORT_EMAIL); empty names the operator instead. */
  contact: string
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="landing legal palette-landing">
      <SiteHeader />
      <main>
        <article className="legal-text" aria-labelledby="legal-title">
          <h1 id="legal-title">{title}</h1>
          <p className="legal-date">Effective {effective}.</p>
          {children}
        </article>
      </main>
      <SiteFooterBar />
    </div>
  )
}

function Contact({ email }: { email: string }) {
  if (!email) return 'contact the operator of this deployment'
  return (
    <>
      email <a href={`mailto:${email}`}>{email}</a>
    </>
  )
}

export function Privacy({ contact }: LegalProps) {
  return (
    <LegalPage title="Privacy policy">
      <h2>Who runs this service</h2>
      <p>
        Pilot Todolist, shown on this site as Pilot App, is an MVP and demo service for personal projects and tasks. It
        is run by the operator of this deployment.
      </p>

      <h2>What we store and why</h2>
      <p>We store only what the service needs to work:</p>
      <ul>
        <li>Your email address, to identify your account and sign you in.</li>
        <li>
          Your password, kept only as a hash and never as the password itself, to check it when you sign in. Signing in
          with Google cancels the password of the account with the same email.
        </li>
        <li>
          When you sign in with Google: your Google account identifier and email address, received from Google after
          Google confirms the email, to link Google to your account.
        </li>
        <li>
          The projects and tasks you create (names, descriptions and statuses), so you can manage them. Only you can see
          them.
        </li>
        <li>
          Sign-in tokens for each device you sign in on, with their expiry: an access token lasts one hour and is
          renewed with a refresh token that ends after 30 days without use or when you sign out on that device. Your
          browser keeps them in its local storage.
        </li>
        <li>
          Counters of failed sign-ins and sign-ups per network address, to refuse more than 10 failed sign-ins a minute
          or 5 sign-ups an hour from one address.
        </li>
      </ul>

      <h2>Error reports</h2>
      <p>
        When the app hits an error in your browser, it sends a report through this service&apos;s own server to a
        self-hosted error tracker, GlitchTip; your browser never contacts the tracker directly. A report may contain the
        error message and where in the app&apos;s code it happened, the page address, your browser, operating system,
        language and time zone, the app version and environment, and the recent steps in the app that led to it, such
        as pages opened, buttons clicked and requests made. The app also tells the tracker when a visit starts, so the
        share of visits with errors can be counted. Reports are used only to find and fix faults. The server removes
        passwords and sign-in tokens from its own reports.
      </p>

      <h2>Who we share data with</h2>
      <p>
        We do not sell your data or share it with anyone for advertising. Google is used only for sign-in: where Google
        sign-in is offered, the sign-in and sign-up pages load Google&apos;s sign-in button from Google, and choosing it
        is covered by Google&apos;s own privacy policy.
      </p>

      <h2>How long we keep data</h2>
      <p>
        Access tokens expire after one hour, and refresh tokens after 30 days without use; signing out ends the tokens
        of that device. A daily cleanup deletes expired and revoked tokens once they are 30 days old. Your account, its
        projects and its tasks are kept until the account is deleted.
      </p>

      <h2>Access and deletion</h2>
      <p>
        There is no way to delete an account in the app yet. To ask for a copy of your data, or for your account and
        all its projects and tasks to be deleted, <Contact email={contact} />.
      </p>

      <h2>Changes to this policy</h2>
      <p>Any change to this policy is published on this page with a new effective date.</p>
    </LegalPage>
  )
}

export function Terms({ contact }: LegalProps) {
  return (
    <LegalPage title="Terms of use">
      <h2>The service</h2>
      <p>
        Pilot Todolist, shown on this site as Pilot App, is an MVP and demo service. It is provided as is, as a demo,
        without warranties of any kind.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Use the service for your own projects and tasks. Do not abuse it: do not try to reach other people&apos;s data,
        do not overload or attack it, and do not scrape it with automated tools. Respect the rate limits; requests above
        them are refused.
      </p>

      <h2>Accounts</h2>
      <p>Accounts used for abuse may be removed, together with their projects and tasks.</p>

      <h2>Contact</h2>
      <p>
        For questions about these terms, <Contact email={contact} />.
      </p>
    </LegalPage>
  )
}
