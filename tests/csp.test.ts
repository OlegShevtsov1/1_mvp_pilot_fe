import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repoRoot } from './support.ts'

const nginx = readFileSync(join(repoRoot, 'nginx.conf'), 'utf8')
const apiUrl = 'https://api.example.test'
const google = 'https://accounts.google.com/gsi/'

/** The policy nginx sends, with ${API_URL} filled in as the container does at start, as directive → sources. */
function policy(): Map<string, string[]> {
  const match = nginx.match(/set \$content_security_policy "([^"]*)";/)
  expect(match, 'set $content_security_policy').not.toBeNull()
  const text = match![1].replaceAll('${API_URL}', apiUrl)
  return new Map(
    text
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name, ...sources]) => [name, sources]),
  )
}

function location(match: string): string {
  const start = nginx.indexOf(`location ${match} {`)
  expect(start, `location ${match}`).toBeGreaterThanOrEqual(0)
  return nginx.slice(start, nginx.indexOf('}', start))
}

describe('nginx Content-Security-Policy', () => {
  it("allows scripts only from the app and Google's sign-in script, never inline", () => {
    const csp = policy()
    expect(csp.get('script-src')).toEqual(["'self'", `${google}client`])
    expect(csp.get('default-src')).toEqual(["'self'"])
    for (const sources of csp.values()) {
      for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", "'strict-dynamic'", '*']) {
        expect(sources).not.toContain(unsafe)
      }
    }
  })

  it('permits only the app origin, the API and Google', () => {
    const csp = policy()
    for (const [name, sources] of csp) {
      for (const source of sources) {
        const allowed =
          ["'self'", "'none'"].includes(source) ||
          source.startsWith(google) ||
          (source === 'data:' && name === 'img-src') ||
          (source === apiUrl && name === 'connect-src')
        expect(allowed, `${name} ${source}`).toBe(true)
      }
    }
    expect(csp.get('connect-src')).toContain(apiUrl)
    expect(csp.get('frame-src')).toEqual([google])
    expect(csp.get('object-src')).toEqual(["'none'"])
    expect(csp.get('frame-ancestors')).toEqual(["'none'"])
    expect(csp.get('base-uri')).toEqual(["'self'"])
  })

  it('sends the policy on every HTML answer', () => {
    for (const match of ['/', '= /index.html']) {
      expect(location(match)).toContain('add_header Content-Security-Policy $content_security_policy always;')
    }
  })

  it('fills in the API origin when the container starts', () => {
    const dockerfile = readFileSync(join(repoRoot, 'Dockerfile'), 'utf8')
    expect(dockerfile).toContain('COPY nginx.conf /etc/nginx/templates/default.conf.template')
    expect(nginx.match(/\$\{[^}]*\}/g)).toEqual(['${API_URL}'])
  })
})
