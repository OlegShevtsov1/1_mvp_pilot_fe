import { Link } from 'react-router'
import { BrandMark } from './BrandMark.tsx'
import './Landing.css'
import './SiteChrome.css'
import { paths } from './paths.ts'

export function SiteHeader() {
  return (
    <header className="landing-header">
      <div className="landing-header-bar">
        <Link className="brand" to={paths.landing}>
          <BrandMark />
          Pilot App
        </Link>
        <Link className="button landing-start landing-start-secondary" to={paths.signIn}>
          Sign in
        </Link>
      </div>
    </header>
  )
}

/** A nav rather than a <footer>: the dev debug footer is the page's only contentinfo landmark. */
export function SiteFooter() {
  return (
    <nav className="site-footer" aria-label="Legal">
      <Link to={paths.privacy}>Privacy policy</Link>
      <Link to={paths.terms}>Terms of use</Link>
    </nav>
  )
}

/** The landing and legal pages' footer: the brand as text beside the legal links. */
export function SiteFooterBar() {
  return (
    <div className="site-footer-bar">
      <span className="brand">
        <BrandMark />
        Pilot App
      </span>
      <SiteFooter />
    </div>
  )
}
