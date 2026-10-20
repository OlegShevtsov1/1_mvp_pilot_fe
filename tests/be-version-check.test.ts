import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { calls, fakeCommand, projectEnv, repoRoot, runScript, tempDir, writeMirrorSource } from './support.ts'

const { PROJECT_ZONE: zone } = projectEnv()
const beSha = '7'.repeat(40)
const beMirrorSourceUrl = 'https://raw.githubusercontent.com/OlegShevtsov1/1_mvp_pilot_be/main/MIRROR_SOURCE.json'
let bin: string
let health: string
let minimum: string
let beMirrorSource: string

function fakeGh(body: string) {
  fakeCommand(bin, 'gh', `printf '%s' "\${GH_TOKEN:-}" > "${bin}/gh.token"\n${body}`)
}

function check(env: Record<string, string> = {}) {
  return runScript('deploy/be_version_check.sh', [], {
    PATH: `${bin}:${process.env.PATH}`,
    MIN_BE_VERSION_FILE: minimum,
    BE_REPO: 'owner/be',
    BE_REPO_TOKEN: 'be-token',
    ...env,
  })
}

beforeEach(() => {
  bin = tempDir('be-version-')
  health = join(bin, 'health.json')
  minimum = join(bin, 'min-be-version')
  writeFileSync(minimum, 'v0.2.0\n')
  beMirrorSource = join(bin, 'be-mirror-source.json')
  writeFileSync(health, JSON.stringify({ status: 'ok', release: beSha }))
  fakeCommand(
    bin,
    'curl',
    `case "\${@: -1}" in
  https://${zone}/health) cat "${health}" ;;
  ${beMirrorSourceUrl}) [ -f "${beMirrorSource}" ] || exit 22; cat "${beMirrorSource}" ;;
  *) exit 22 ;;
esac`,
  )
  fakeGh('echo ahead')
})

describe('deploy/be_version_check.sh with BE_REPO_TOKEN on the primary', () => {
  it('passes when the backend on prod is newer than the minimum', () => {
    const result = check()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(`backend on prod ${beSha.slice(0, 7)} contains v0.2.0`)
    expect(calls(bin, 'gh')[0]).toContain(`repos/owner/be/compare/v0.2.0...${beSha}`)
  })

  it('passes when the backend on prod is exactly the minimum', () => {
    fakeGh('echo identical')
    expect(check().status).toBe(0)
  })

  it.each(['behind', 'diverged'])('refuses a backend that is %s the minimum, explaining the release order', (status) => {
    fakeGh(`echo ${status}`)
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`backend on prod (${beSha.slice(0, 7)}) is older than v0.2.0`)
    expect(result.stderr).toContain('Release order is backend first')
    expect(result.stderr).toContain('Nothing was deployed.')
  })

  it('refuses when GitHub cannot compare (the minimum tag does not exist)', () => {
    fakeGh('echo "gh: Not Found (HTTP 404)" >&2; exit 1')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Nothing was deployed.')
  })

  it('refuses when the backend health reports no release sha', () => {
    writeFileSync(health, JSON.stringify({ status: 'ok' }))
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('backend /health reports no release sha')
    expect(calls(bin, 'gh')).toEqual([])
  })

  it('refuses when the backend health does not answer', () => {
    fakeCommand(bin, 'curl', 'exit 7')
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`https://${zone}/health`)
    expect(calls(bin, 'gh')).toEqual([])
  })

  it.each(['0.2.0', 'v0.2', ''])('refuses a malformed minimum %j, naming the file', (value) => {
    writeFileSync(minimum, `${value}\n`)
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(minimum)
    expect(calls(bin, 'curl')).toEqual([])
  })

  it('reads the backend repository with BE_REPO_TOKEN without printing it', () => {
    const result = check({ BE_REPO_TOKEN: 'TOKEN-SENTINEL', GH_TOKEN: 'own-repo-token' })
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(join(bin, 'gh.token'), 'utf8')).toBe('TOKEN-SENTINEL')
    expect(result.stdout + result.stderr).not.toContain('TOKEN-SENTINEL')
  })

  it('declares the minimum backend version of this release in deploy/min-be-version', () => {
    const result = runScript('deploy/be_version_check.sh', [], {
      PATH: `${bin}:${process.env.PATH}`,
      BE_REPO: 'owner/be',
      BE_REPO_TOKEN: 'be-token',
    })
    expect(result.status, result.stderr).toBe(0)
    const declared = readFileSync(join(repoRoot, 'deploy', 'min-be-version'), 'utf8').trim()
    expect(calls(bin, 'gh')[0]).toContain(`compare/${declared}...${beSha}`)
  })
})

describe('deploy/be_version_check.sh through the public backend mirror', () => {
  beforeEach(() => {
    writeMirrorSource(beMirrorSource, [
      { tag: 'v0.1.0', primary_sha: '1'.repeat(40) },
      { tag: 'v0.2.0', primary_sha: beSha },
    ])
  })

  it('asks the public backend mirror without a token when BE_REPO_TOKEN is absent', () => {
    const result = check({ BE_REPO_TOKEN: '' })
    expect(result.status, result.stderr).toBe(0)
    expect(calls(bin, 'gh')).toEqual([])
    expect(calls(bin, 'curl').join('\n')).toContain(beMirrorSourceUrl)
    expect(result.stdout).toContain(`backend on prod ${beSha.slice(0, 7)} is v0.2.0`)
  })

  it('uses the public mirror in mirror mode even with a token', () => {
    const result = check({ MIRROR: 'true', BE_REPO_TOKEN: 'x' })
    expect(result.status, result.stderr).toBe(0)
    expect(calls(bin, 'gh')).toEqual([])
    expect(calls(bin, 'curl').join('\n')).toContain(beMirrorSourceUrl)
  })

  it("passes when the prod backend's tag equals the minimum", () => {
    expect(check({ MIRROR: 'true' }).status).toBe(0)
  })

  it("passes when the prod backend's tag is newer in version order", () => {
    writeMirrorSource(beMirrorSource, [{ tag: 'v0.10.0', primary_sha: beSha }])
    const result = check({ MIRROR: 'true' })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('v0.10.0')
  })

  it('takes the highest of several tags recorded for the same backend release', () => {
    writeMirrorSource(beMirrorSource, [
      { tag: 'v0.3.0', primary_sha: beSha },
      { tag: 'v0.9.0', primary_sha: beSha },
    ])
    writeFileSync(minimum, 'v0.5.0\n')
    const result = check({ MIRROR: 'true' })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('v0.9.0')
  })

  it('refuses a prod backend whose tag is older than the minimum', () => {
    writeFileSync(minimum, 'v0.10.0\n')
    const result = check({ MIRROR: 'true' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`backend on prod (${beSha.slice(0, 7)}, v0.2.0) is older than v0.10.0`)
    expect(result.stderr).toContain('Release order is backend first')
    expect(result.stderr).toContain('Nothing was deployed.')
  })

  it('refuses a prod backend release that MIRROR_SOURCE.json does not list', () => {
    writeMirrorSource(beMirrorSource, [{ tag: 'v0.3.0', primary_sha: '1'.repeat(40) }])
    const result = check({ MIRROR: 'true' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(beSha.slice(0, 7))
    expect(result.stderr).toContain('Release order is backend first')
    expect(result.stderr).toContain('Nothing was deployed.')
  })

  it('refuses when MIRROR_SOURCE.json cannot be read', () => {
    rmSync(beMirrorSource)
    const result = check({ MIRROR: 'true' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(beMirrorSourceUrl)
    expect(result.stderr).toContain('Nothing was deployed.')
  })

  it.each(['{"tags":"x"}', 'not json'])('refuses a malformed MIRROR_SOURCE.json %j', (content) => {
    writeFileSync(beMirrorSource, content)
    const result = check({ MIRROR: 'true' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Nothing was deployed.')
  })
})
