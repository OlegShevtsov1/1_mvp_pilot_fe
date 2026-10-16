import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { calls, fakeCommand, runScript, tempDir } from './support.ts'

const good = {
  BASE_REF: 'develop',
  HEAD_REF: 'feature/PILOT-12-add-login',
  PR_TITLE: 'PILOT-12: Add login',
  PR_BODY: 'What and why\n\nType: feat\n',
}
let bin: string

function check(env: Partial<typeof good> & { REPO?: string } = {}) {
  return runScript('scripts/pr-conventions.sh', [], {
    PATH: `${bin}:${process.env.PATH}`,
    REPO: 'owner/repo',
    ...good,
    ...env,
  })
}

function errors(stdout: string): string[] {
  return stdout.split('\n').filter((line) => line.startsWith('::error::pr-conventions:'))
}

beforeEach(() => {
  bin = tempDir('pr-conventions-')
  fakeCommand(bin, 'gh', 'echo 1')
})

describe('scripts/pr-conventions.sh', () => {
  it('passes a feature branch, a PILOT title and one Type line', () => {
    const result = check()
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('pr-conventions: ok')
    expect(calls(bin, 'gh')[0]).toContain('repos/owner/repo/git/matching-refs/heads/develop')
  })

  it.each([
    ['hotfix/PILOT-3-fix-crash', 'main'],
    ['archon/task-factory-1792086449826', 'develop'],
    ['archon/task-factory-test', 'develop'],
    ['develop', 'main'],
  ])('accepts the branch %s into %s', (head, base) => {
    const result = check({ HEAD_REF: head, BASE_REF: base })
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })

  it.each([
    ['wip-test', 'develop'],
    ['feature/PILOT-12-Add_Login', 'develop'],
    ['feature/pilot-12-add-login', 'develop'],
    ['feature/add-login', 'develop'],
    ['develop', 'develop'],
    ['main', 'develop'],
  ])('rejects the branch %s into %s', (head, base) => {
    const result = check({ HEAD_REF: head, BASE_REF: base })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('::error::pr-conventions: branch')
  })

  it.each(['feat: add login', 'PILOT-12:'])('rejects the title %j', (title) => {
    const result = check({ PR_TITLE: title })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('PR title must match ^PILOT-[0-9]+: .+$')
  })

  it('rejects a body without a Type line', () => {
    const result = check({ PR_BODY: 'What and why\n' })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('exactly one Type: line')
    expect(result.stdout).toContain('found 0')
  })

  it('rejects a body with two Type lines', () => {
    const result = check({ PR_BODY: 'What\n\nType: feat\nType: fix\n' })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('found 2')
  })

  it('rejects a Type outside the allowed list', () => {
    const result = check({ PR_BODY: 'What\n\nType: feature\n' })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('Type: line must be one of feat, fix, chore, docs, refactor, test, ci')
  })

  it('accepts a body edited on the web with CRLF line ends', () => {
    const result = check({ PR_BODY: 'What\r\n\r\nType: fix\r\n' })
    expect(result.status, result.stdout + result.stderr).toBe(0)
  })

  it('names every violated rule in one run', () => {
    const result = check({ HEAD_REF: 'wip-test', PR_TITLE: 'wip', PR_BODY: '' })
    expect(result.status).toBe(1)
    const lines = errors(result.stdout)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('branch')
    expect(lines[1]).toContain('PR title')
    expect(lines[2]).toContain('Type: line')
  })

  it('does not apply before the develop branch exists', () => {
    fakeCommand(bin, 'gh', 'echo 0')
    const result = check({ HEAD_REF: 'wip-test', PR_TITLE: 'wip' })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('not applicable')
  })

  it('fails closed when GitHub answers with an error', () => {
    fakeCommand(bin, 'gh', 'exit 1')
    const result = check()
    expect(result.status).toBe(2)
  })

  it('treats the pull request text as data', () => {
    const marker = join(tempDir('pr-conventions-pwned-'), 'pwned')
    const result = check({
      PR_TITLE: `PILOT-1: $(touch ${marker})`,
      PR_BODY: `\`touch ${marker}\`\n\nType: fix\n`,
    })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(existsSync(marker)).toBe(false)
  })

  it('refuses a malformed repository without calling GitHub', () => {
    const result = check({ REPO: 'owner/repo; x' })
    expect(result.status).toBe(2)
    expect(calls(bin, 'gh')).toEqual([])
  })
})
