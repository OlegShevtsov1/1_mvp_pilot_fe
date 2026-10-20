import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { calls, commit, fakeCommand, git, gitRepo, runScript, tempDir } from './support.ts'

let bin: string
let repo: string

beforeEach(() => {
  bin = tempDir('tdd-check-bin-')
  repo = gitRepo('tdd-check-repo-')
  commit(repo, 'chore: base', { 'README.md': 'base\n', 'src/app.ts': 'export const a = 1\n' })
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
  git(repo, 'checkout', '-q', '-b', 'pr')
  fakeCommand(
    bin,
    'npm',
    `git rev-parse HEAD >> "${bin}/npm.where"
case $1 in
  ci) exit 0 ;;
  test) exit "\${NPM_TEST_EXIT:-1}" ;;
esac`,
  )
  fakeCommand(bin, 'gh')
})

function tddCheck(env: Record<string, string> = {}) {
  return runScript(
    'scripts/tdd-check.sh',
    [],
    {
      PATH: `${bin}:${process.env.PATH}`,
      BASE_REF: 'main',
      HEAD_SHA: git(repo, 'rev-parse', 'HEAD'),
      REPO: 'owner/repo',
      ...env,
    },
    repo,
  )
}

function npmRanAt(): string[] {
  try {
    return readFileSync(join(bin, 'npm.where'), 'utf8').trim().split('\n')
  } catch {
    return []
  }
}

describe('scripts/tdd-check.sh', () => {
  it.each([
    ['README.md', 'changed\n'],
    ['.github/workflows/x.yml', 'name: x\n'],
    ['scripts/README.md', '# notes\n'],
    ['src/notes.md', '# notes\n'],
    ['docs/runbook.md', '# runbook\n'],
  ])('does not apply when only %s changed', (path, content) => {
    commit(repo, 'docs: no code', { [path]: content })
    const result = tddCheck()
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('not applicable')
    expect(calls(bin, 'npm')).toEqual([])
    expect(calls(bin, 'gh')).toEqual([])
  })

  it('still applies when code and Markdown change together', () => {
    commit(repo, 'feat(x): code and notes', { 'src/app.ts': 'export const a = 2\n', 'README.md': 'changed\n' })
    const result = tddCheck()
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('first commit must start with test(')
  })

  it('does not apply when the only commit not on main changes no code', () => {
    git(repo, 'update-ref', 'refs/remotes/origin/develop', 'HEAD')
    const hotfix = commit(repo, 'fix(x): hotfix', { 'src/app.ts': 'export const a = 2\n' })
    git(repo, 'update-ref', 'refs/remotes/origin/main', hotfix)
    commit(repo, 'docs: update readme', { 'README.md': 'changed\n' })
    const result = tddCheck({ BASE_REF: 'develop', HEAD_REF: 'feature/PILOT-1-x' })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('not applicable (no code')
    expect(calls(bin, 'npm')).toEqual([])
    expect(calls(bin, 'gh')).toEqual([])
  })

  it('is not applicable to the release PR develop → main', () => {
    commit(repo, 'PILOT-92: Dev Deploy guard (#20)', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck({ HEAD_REF: 'develop' })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('not applicable (release PR develop → main)')
    expect(calls(bin, 'npm')).toEqual([])
    expect(calls(bin, 'gh')).toEqual([])
  })

  it('still requires test( first on a feature PR into main', () => {
    commit(repo, 'PILOT-92: Dev Deploy guard (#20)', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck({ HEAD_REF: 'feature/PILOT-1-x' })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('first commit must start with test(')
  })

  it('still checks a PR from develop into a base other than main', () => {
    git(repo, 'update-ref', 'refs/remotes/origin/develop', 'HEAD')
    commit(repo, 'feat(x): code first', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck({ HEAD_REF: 'develop', BASE_REF: 'develop' })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('first commit must start with test(')
  })

  it('passes a back-merge whose commits are all on main', () => {
    git(repo, 'update-ref', 'refs/remotes/origin/develop', 'HEAD')
    const hotfix = commit(repo, 'fix(x): hotfix', { 'src/app.ts': 'export const a = 2\n' })
    git(repo, 'update-ref', 'refs/remotes/origin/main', hotfix)
    const result = tddCheck({ BASE_REF: 'develop', HEAD_REF: 'main' })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('every commit is already on main')
    expect(calls(bin, 'npm')).toEqual([])
    expect(calls(bin, 'gh')).toEqual([])
  })

  it('checks only the commits that are not on main yet', () => {
    git(repo, 'update-ref', 'refs/remotes/origin/develop', 'HEAD')
    const hotfix = commit(repo, 'fix(x): hotfix', { 'src/app.ts': 'export const a = 2\n' })
    git(repo, 'update-ref', 'refs/remotes/origin/main', hotfix)
    const red = commit(repo, 'test(x): failing test', { 'src/a.test.ts': 'red\n' })
    commit(repo, 'feat(x): code', { 'src/app.ts': 'export const a = 3\n' })
    const result = tddCheck({ BASE_REF: 'develop' })
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(npmRanAt()).toEqual([red, red])
    const gh = calls(bin, 'gh')
    expect(gh).toHaveLength(1)
    expect(gh[0]).toContain(`statuses/${red}`)
  })

  it('refuses to run when origin/main is missing', () => {
    git(repo, 'update-ref', 'refs/remotes/origin/develop', 'HEAD')
    commit(repo, 'test(x): failing test', { 'src/a.test.ts': 'red\n' })
    commit(repo, 'feat(x): code', { 'src/app.ts': 'export const a = 2\n' })
    git(repo, 'update-ref', '-d', 'refs/remotes/origin/main')
    const result = tddCheck({ BASE_REF: 'develop' })
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('origin/main')
    expect(calls(bin, 'npm')).toEqual([])
    expect(calls(bin, 'gh')).toEqual([])
  })

  it('requires the first commit to be the test( commit', () => {
    commit(repo, 'feat(x): code first', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck()
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('::error::')
    expect(result.stdout).toContain('first commit must start with test(')
    expect(result.stdout).toContain('feat(x): code first')
  })

  it.each([
    'src/a/b.test.ts',
    'src/App.test.tsx',
    'tests/x.test.ts',
    'bin/x.test.sh',
    'deploy/lib.test.sh',
    'scripts/a/b.test.sh',
    'docker/x.test.sh',
  ])(
    'rejects a feat( commit that changes the test %s',
    (testFile) => {
      commit(repo, 'test(x): failing test', { [testFile]: 'expect(1).toBe(2)\n' })
      commit(repo, 'feat(x): make it pass', { 'src/app.ts': 'export const a = 2\n', [testFile]: 'weakened\n' })
      const result = tddCheck()
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('tests changed between the test commit and the feat/fix commit')
      expect(result.stdout).toContain(testFile)
      expect(calls(bin, 'npm')).toEqual([])
    },
  )

  it('requires a feat( or fix( commit after the test commit', () => {
    commit(repo, 'test(x): failing test', { 'src/a.test.ts': 'red\n' })
    commit(repo, 'chore(x): code', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck()
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('no feat( or fix( commit')
  })

  it('fails when the tests pass at the test commit', () => {
    commit(repo, 'test(x): not really failing', { 'src/a.test.ts': 'green\n' })
    commit(repo, 'fix(x): code', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck({ NPM_TEST_EXIT: '0' })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('tests pass at the test commit (not RED)')
    expect(calls(bin, 'gh')).toEqual([])
  })

  it('reproduces RED at the test commit and records it as a failing status there', () => {
    const red = commit(repo, 'test(x): failing test', { 'src/a.test.ts': 'red\n' })
    commit(repo, 'feat(x): code', { 'src/app.ts': 'export const a = 2\n' })
    commit(repo, 'refactor(x): tidy', { 'src/app.ts': 'export const a = 2 // tidy\n' })
    const result = tddCheck()
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(calls(bin, 'npm')).toEqual(['ci', 'test'])
    expect(npmRanAt()).toEqual([red, red])
    const gh = calls(bin, 'gh')
    expect(gh).toHaveLength(1)
    expect(gh[0]).toContain(`api -X POST repos/owner/repo/statuses/${red}`)
    expect(gh[0]).toContain('state=failure')
    expect(gh[0]).toContain('context=tdd-check/red')
    expect(git(repo, 'worktree', 'list')).not.toContain(red.slice(0, 7))
  })

  it('fails when the RED status cannot be recorded', () => {
    const red = commit(repo, 'test(x): failing test', { 'src/a.test.ts': 'red\n' })
    commit(repo, 'feat(x): code', { 'src/app.ts': 'export const a = 2\n' })
    fakeCommand(bin, 'gh', 'exit 1')
    const result = tddCheck()
    expect(result.status).toBe(2)
    expect(result.stderr).toContain(`could not record the RED status on ${red.slice(0, 7)}`)
  })

  it('ignores merge commits from main', () => {
    const red = commit(repo, 'test(x): failing test', { 'src/a.test.ts': 'red\n' })
    git(repo, 'checkout', '-q', 'main')
    const moved = commit(repo, 'chore: main moved', { 'other.md': 'x\n' })
    git(repo, 'update-ref', 'refs/remotes/origin/main', moved)
    git(repo, 'checkout', '-q', 'pr')
    git(repo, 'merge', '-q', '--no-ff', '--no-edit', 'main')
    commit(repo, 'feat(x): code', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck()
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(calls(bin, 'gh')[0]).toContain(`statuses/${red}`)
  })

  it.each([
    ['BASE_REF', { BASE_REF: '' }],
    ['HEAD_SHA', { HEAD_SHA: '' }],
    ['REPO', { REPO: '' }],
    ['a malformed HEAD_SHA', { HEAD_SHA: 'abc; rm -rf /' }],
  ])('refuses to run without %s', (_, env) => {
    commit(repo, 'feat(x): code', { 'src/app.ts': 'export const a = 2\n' })
    const result = tddCheck(env)
    expect(result.status).toBe(2)
    expect(calls(bin, 'npm')).toEqual([])
    expect(calls(bin, 'gh')).toEqual([])
  })
})
