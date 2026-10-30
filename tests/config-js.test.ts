import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const script = join(import.meta.dirname, '..', 'docker', '40-config-js.sh')

function run(env: Record<string, string>) {
  const out = join(mkdtempSync(join(tmpdir(), 'config-js-')), 'config.js')
  const result = spawnSync('sh', [script], {
    env: { PATH: process.env.PATH ?? '', CONFIG_JS_PATH: out, ...env },
    encoding: 'utf8',
  })
  return { ...result, out }
}

const ip = (...parts: number[]) => parts.join('.')
const privateDsn = `http://key@${ip(10, 8, 0, 5)}:8000/3`

const valid = {
  API_URL: 'https://api.example.test',
  SENTRY_DSN: 'https://key@errors.example.test/7',
  ENV_NAME: 'dev',
  GOOGLE_CLIENT_ID: 'client-id.apps.example.test',
  OAUTH_CLIENT_ID: 'web-client-uid',
  SUPPORT_EMAIL: 'support@example.test',
}

describe('docker/40-config-js.sh', () => {
  it('writes config.js from the container env, with APP_VERSION from KAMAL_VERSION', () => {
    const { status, out } = run({ ...valid, KAMAL_VERSION: 'sha-abc123' })
    expect(status).toBe(0)
    expect(readFileSync(out, 'utf8')).toBe(
      [
        'window.APP_CONFIG = {',
        '  API_URL: "https://api.example.test",',
        '  SENTRY_DSN: "https://key@api.example.test/7",',
        '  GOOGLE_CLIENT_ID: "client-id.apps.example.test",',
        '  OAUTH_CLIENT_ID: "web-client-uid",',
        '  SUPPORT_EMAIL: "support@example.test",',
        '  ENV_NAME: "dev",',
        '  APP_VERSION: "sha-abc123",',
        '};',
        '',
      ].join('\n'),
    )
  })

  it('uses APP_VERSION "local" outside Kamal', () => {
    const { status, out } = run(valid)
    expect(status).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain('  APP_VERSION: "local",\n')
  })

  it('serves an empty DSN when SENTRY_DSN is empty (Sentry off)', () => {
    const { status, out } = run({ ...valid, SENTRY_DSN: '' })
    expect(status).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain('  SENTRY_DSN: "",\n')
  })

  it('serves the server DSN on the API host, with the same key and project and no private address', () => {
    const { status, out } = run({ API_URL: 'https://dev.example.test', SENTRY_DSN: privateDsn, ENV_NAME: 'dev' })
    expect(status).toBe(0)
    const config = readFileSync(out, 'utf8')
    expect(config).toContain('  SENTRY_DSN: "https://key@dev.example.test/3",\n')
    expect(config).not.toContain(ip(10, 8, 0, 5))
    expect(config).not.toContain(':8000')
  })

  it('drops a DSN secret and any API_URL path', () => {
    const { status, out } = run({
      API_URL: 'https://dev.example.test/',
      SENTRY_DSN: `http://key:secret@${ip(10, 8, 0, 5)}:8000/3`,
      ENV_NAME: 'dev',
    })
    expect(status).toBe(0)
    const config = readFileSync(out, 'utf8')
    expect(config).toContain('  SENTRY_DSN: "https://key@dev.example.test/3",\n')
    expect(config).not.toContain('secret')
  })

  it.each([
    `http://${ip(10, 8, 0, 5)}`,
    `http://${ip(172, 20, 1, 1)}`,
    `http://${ip(192, 168, 1, 10)}`,
    `http://${ip(127, 0, 0, 1)}:3000`,
    `http://${ip(169, 254, 1, 1)}`,
    `http://${ip(100, 64, 0, 1)}`,
    `http://${ip(100, 127, 255, 1)}`,
    'http://localhost:3000',
    'http://LocalHost:3000',
  ])('refuses to serve a DSN on a private address (%s), without echoing it', (apiUrl) => {
    const { status, stderr, out } = run({ ...valid, API_URL: apiUrl, SENTRY_DSN: privateDsn })
    expect(status).not.toBe(0)
    expect(stderr).toContain('SENTRY_DSN would point browsers to a private address')
    expect(stderr).not.toContain(apiUrl.replace('http://', ''))
    expect(stderr).not.toContain(privateDsn)
    expect(existsSync(out)).toBe(false)
  })

  it.each(['http://localhost.:3000', 'http://LOCALHOST.', `http://${ip(10, 8, 0, 5)}.`])(
    'refuses a private host written with a trailing dot (%s)',
    (apiUrl) => {
      const { status, stderr, out } = run({ ...valid, API_URL: apiUrl })
      expect(status).not.toBe(0)
      expect(stderr).toContain('SENTRY_DSN would point browsers to a private address')
      expect(existsSync(out)).toBe(false)
    },
  )

  it('drops userinfo from API_URL, so the DSN has only the key before its host', () => {
    const { status, out } = run({ ...valid, API_URL: 'https://user:pass@dev.example.test' })
    expect(status).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain('  SENTRY_DSN: "https://key@dev.example.test/7",\n')
  })

  it('accepts a public host that starts like a private range', () => {
    const host = ip(172, 32, 1, 1)
    const { status, out } = run({ ...valid, API_URL: `https://${host}` })
    expect(status).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain(`  SENTRY_DSN: "https://key@${host}/7",\n`)
  })

  it.each([`${ip(10, 0, 0, 1)}.example.test`, `${ip(127, 0, 0, 1)}.example.test`, ip(100, 128, 0, 1)])(
    'accepts a public host that a private range only prefixes (%s)',
    (host) => {
      const { status, out } = run({ ...valid, API_URL: `https://${host}` })
      expect(status).toBe(0)
      expect(readFileSync(out, 'utf8')).toContain(`  SENTRY_DSN: "https://key@${host}/7",\n`)
    },
  )

  it('refuses an IPv6 literal API host and writes nothing', () => {
    const { status, out } = run({ ...valid, API_URL: 'http://[::1]:3000' })
    expect(status).not.toBe(0)
    expect(existsSync(out)).toBe(false)
  })

  it.each(['not-a-dsn', `http://key@${ip(10, 8, 0, 5)}:8000/`])(
    'rejects a SENTRY_DSN that is not a DSN (%s), without echoing it',
    (dsn) => {
      const { status, stderr, out } = run({ ...valid, SENTRY_DSN: dsn })
      expect(status).not.toBe(0)
      expect(stderr).toContain('SENTRY_DSN is not a DSN')
      expect(stderr).not.toContain(dsn)
      expect(existsSync(out)).toBe(false)
    },
  )

  it('accepts an unset GOOGLE_CLIENT_ID and OAUTH_CLIENT_ID (sign-in not configured)', () => {
    const { status, out } = run({ API_URL: valid.API_URL, ENV_NAME: valid.ENV_NAME })
    expect(status).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain('  GOOGLE_CLIENT_ID: "",\n  OAUTH_CLIENT_ID: "",\n')
  })

  it('accepts an unset SUPPORT_EMAIL (generic contact line)', () => {
    const { status, out } = run({ API_URL: valid.API_URL, ENV_NAME: valid.ENV_NAME })
    expect(status).toBe(0)
    expect(readFileSync(out, 'utf8')).toContain('  SUPPORT_EMAIL: "",\n')
  })

  it('fails without API_URL and writes nothing', () => {
    const { status, stderr, out } = run({ SENTRY_DSN: '', ENV_NAME: 'dev' })
    expect(status).not.toBe(0)
    expect(stderr).toContain('API_URL')
    expect(existsSync(out)).toBe(false)
  })

  it('fails without ENV_NAME and writes nothing', () => {
    const { status, stderr, out } = run({ API_URL: valid.API_URL })
    expect(status).not.toBe(0)
    expect(stderr).toContain('ENV_NAME')
    expect(existsSync(out)).toBe(false)
  })

  it.each([
    ['API_URL', 'https://x".example.test'],
    ['SENTRY_DSN', 'https://k@x/1<script>'],
    ['ENV_NAME', "dev'; alert(1)"],
    ['GOOGLE_CLIENT_ID', 'x"</script>'],
    ['OAUTH_CLIENT_ID', 'uid";alert(1)//'],
    ['SUPPORT_EMAIL', 'ops"@example.test<script>'],
  ])('rejects %s with characters unsafe in JS, without echoing the value', (name, value) => {
    const { status, stderr, out } = run({ ...valid, [name]: value })
    expect(status).not.toBe(0)
    expect(stderr).toContain(`${name} has invalid characters`)
    expect(stderr).not.toContain(value)
    expect(existsSync(out)).toBe(false)
  })
})
