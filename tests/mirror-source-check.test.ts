import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { runScript, tempDir, writeMirrorSource } from './support.ts'

const tag = 'v0.2.0'
const source = 'b'.repeat(40)
const other = 'd'.repeat(40)
let file: string

function check(args: string[] = [tag, source]) {
  return runScript('deploy/mirror_source_check.sh', args, { MIRROR_SOURCE_FILE: file })
}

beforeEach(() => {
  file = join(tempDir('mirror-source-'), 'MIRROR_SOURCE.json')
  writeMirrorSource(file, [
    { tag: 'v0.1.0', primary_sha: other },
    { tag, primary_sha: source },
  ])
})

describe('deploy/mirror_source_check.sh', () => {
  it('accepts a release tag whose primary commit is the given source_sha', () => {
    const result = check()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toBe(`version=sha-${source}\nsource_sha=${source}\n`)
  })

  it('refuses a source_sha that differs from the recorded primary commit', () => {
    const result = check([tag, other])
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(source.slice(0, 7))
    expect(result.stderr).toContain(other.slice(0, 7))
    expect(result.stderr).toContain('Nothing was deployed.')
  })

  it('refuses a tag that publish-mirror has not recorded', () => {
    const result = check(['v0.3.0', source])
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('v0.3.0')
    expect(result.stderr).toContain('Nothing was deployed.')
  })

  it('refuses when the tag is recorded twice', () => {
    writeMirrorSource(file, [
      { tag, primary_sha: source, mirror_sha: 'c'.repeat(40) },
      { tag, primary_sha: source, mirror_sha: 'e'.repeat(40) },
    ])
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
  })

  it.each([null, 'not json', '{"tags":{}}'])('refuses a missing or malformed MIRROR_SOURCE.json (%j)', (content) => {
    if (content === null) file = join(tempDir('mirror-source-'), 'MIRROR_SOURCE.json')
    else writeFileSync(file, content)
    const result = check()
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('MIRROR_SOURCE.json')
  })

  it.each([
    ['v0.2', source],
    ['', source],
    [tag, ''],
    [tag, 'abc'],
    [tag, `sha-${source}`],
    [tag, 'B'.repeat(40)],
  ])('refuses the malformed tag %j or source_sha %j', (badTag, badSource) => {
    const result = check([badTag, badSource])
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
  })
})
