import { existsSync, writeFileSync } from 'node:fs'
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

function check(env: Partial<typeof good> & { REPO?: string; CHANGELOG_FILE?: string } = {}, cwd?: string) {
  const path = `${bin}:${process.env.PATH}`
  return runScript('scripts/pr-conventions.sh', [], { PATH: path, REPO: 'owner/repo', ...good, ...env }, cwd)
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
  describe('release PRs', () => {
    const section = [
      'Minimum backend version: v0.3.0',
      '',
      '### Added',
      '',
      '- Login form with `remember me`.',
      '- Logout button.',
    ].join('\n')
    const changelogText = [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '### Added',
      '',
      '## [1.2.0] - 2026-10-22',
      '',
      section,
      '',
      '## [1.1.0] - 2026-10-01',
      '',
      'Minimum backend version: v0.2.0',
      '',
      '### Fixed',
      '',
      '- Crash on start.',
      '',
    ].join('\n')
    const older = 'Minimum backend version: v0.2.0\n\n### Fixed\n\n- Crash on start.'
    const release = {
      HEAD_REF: 'develop',
      BASE_REF: 'main',
      PR_TITLE: 'PILOT-7: Release v1.2.0',
    }
    let changelog: string

    function writeChangelog(text: string) {
      changelog = join(tempDir('pr-conventions-changelog-'), 'CHANGELOG.md')
      writeFileSync(changelog, text)
    }

    function checkRelease(env: Parameters<typeof check>[0] = {}) {
      return check({ ...release, CHANGELOG_FILE: changelog, ...env })
    }

    beforeEach(() => writeChangelog(changelogText))

    it('passes a release PR whose body has ## Changelog followed by the [X.Y.Z] section', () => {
      const result = checkRelease({ PR_BODY: `Release v1.2.0.\n\n## Changelog\n\n${section}\n\nType: chore\n` })
      expect(result.status, result.stdout + result.stderr).toBe(0)
      expect(result.stdout).toContain('pr-conventions: ok')
    })

    it('reads CHANGELOG.md of the working directory, the merge result in CI, by default', () => {
      const dir = tempDir('pr-conventions-checkout-')
      writeFileSync(join(dir, 'CHANGELOG.md'), changelogText)
      const body = `## Changelog\n\n${section}\n\nType: chore\n`
      expect(check({ ...release, PR_BODY: body }, dir).status).toBe(0)
      expect(check({ ...release, PR_BODY: `## Changelog\n\n${older}\n\nType: chore\n` }, dir).status).toBe(1)
    })

    it('passes a suffixed heading with the blank lines dropped and a later section', () => {
      const compact = section.split('\n').filter((line) => line !== '').join('\n')
      const body = `Release.\n\n## Changelog (v1.2.0)\n${compact}\n\n## After merge\n\n- Tag it.\n\nType: chore\n`
      const result = checkRelease({ PR_BODY: body })
      expect(result.status, result.stdout + result.stderr).toBe(0)
    })

    it('passes a release body edited on the web with CRLF line ends', () => {
      const body = `## Changelog\n\n${section}\n\nType: chore\n`.replaceAll('\n', '\r\n')
      const result = checkRelease({ PR_BODY: body })
      expect(result.status, result.stdout + result.stderr).toBe(0)
    })

    it('rejects a release PR without a ## Changelog heading', () => {
      const result = checkRelease({ PR_BODY: `Release v1.2.0.\n\n${section}\n\nType: chore\n` })
      expect(result.status).toBe(1)
      expect(result.stdout).toContain("'## Changelog' heading")
      expect(result.stdout).toContain('[1.2.0]')
    })

    it('rejects a heading that only starts with ## Changelog', () => {
      const result = checkRelease({ PR_BODY: `## Changelogs\n\n${section}\n\nType: chore\n` })
      expect(result.status).toBe(1)
      expect(result.stdout).toContain("'## Changelog' heading")
    })

    it.each([
      ['only part of the section', section.split('\n').slice(0, 5).join('\n')],
      ['the section of another version', older],
      ['nothing', ''],
    ])('rejects a ## Changelog that carries %s', (_, text) => {
      const result = checkRelease({ PR_BODY: `## Changelog\n\n${text}\n\nType: chore\n` })
      expect(result.status).toBe(1)
      expect(result.stdout).toContain("'## Changelog' heading")
    })

    it('rejects a release PR whose version has no section in CHANGELOG.md', () => {
      const result = checkRelease({
        PR_TITLE: 'PILOT-7: Release v9.9.9',
        PR_BODY: `## Changelog\n\n${section}\n\nType: chore\n`,
      })
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('non-empty section [9.9.9] in CHANGELOG.md')
    })

    it('rejects a release PR whose section is empty', () => {
      writeChangelog('# Changelog\n\n## [1.2.0] - 2026-10-22\n\n## [1.1.0] - 2026-10-01\n\n- Old.\n')
      const result = checkRelease({ PR_BODY: '## Changelog\n\nType: chore\n' })
      expect(result.status).toBe(1)
      expect(result.stdout).toContain('non-empty section [1.2.0] in CHANGELOG.md')
    })

    it('names the changelog error together with a broken Type line in one run', () => {
      const result = checkRelease({ PR_BODY: 'Release v1.2.0.\n' })
      expect(result.status).toBe(1)
      const lines = errors(result.stdout)
      expect(lines).toHaveLength(2)
      expect(lines[0]).toContain('Type: line')
      expect(lines[1]).toContain("'## Changelog' heading")
    })

    // Every release has its own card; PILOT-0 is only for card-less chores (decision 91). The body
    // carries the [1.2.0] section, so the card is the only rule the release title breaks.
    const complete = `## Changelog\n\n${section}\n\nType: chore\n`

    it.each([
      ['PILOT-0: Release v1.2.0', 'develop', 'main'],
      ['PILOT-0: Release 1.2.0 changelog', 'archon/task-factory-1792086449826', 'develop'],
      ['PILOT-00: Release v1.2.0', 'develop', 'main'],
    ])('rejects the card-less release title %j from %s into %s', (title, head, base) => {
      const result = checkRelease({ PR_TITLE: title, HEAD_REF: head, BASE_REF: base, PR_BODY: complete })
      expect(result.status).toBe(1)
      expect(errors(result.stdout)).toHaveLength(1)
      expect(result.stdout).toContain('decision 91')
      expect(result.stdout).toContain('PILOT-<n>: Release vX.Y.Z')
    })

    it.each(['PILOT-0: Sync main (abc1234)', 'PILOT-12: Release v1.2.0'])(
      'accepts the title %j from develop into main',
      (title) => {
        const result = checkRelease({ PR_TITLE: title, PR_BODY: complete })
        expect(result.status, result.stdout + result.stderr).toBe(0)
      },
    )

    it.each([
      ['PILOT-171: Release 0.2.0 changelog', 'develop'],
      ['PILOT-7: Release v1.2.0 notes', 'main'],
      [good.PR_TITLE, 'develop'],
    ])('does not apply to the title %j', (title, base) => {
      const result = check({
        BASE_REF: base,
        PR_TITLE: title,
        CHANGELOG_FILE: join(tempDir('pr-conventions-none-'), 'CHANGELOG.md'),
      })
      expect(result.status, result.stdout + result.stderr).toBe(0)
      expect(result.stdout).toContain('pr-conventions: ok (branch, title, Type line)\n')
    })
  })
})
