import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { repoRoot } from './support.ts'

// This repository's own settings of the AI review, kept on top of the 1_mvp_sdlc fe template (PILOT-369).
// The tests/ai-review-*.test.ts files are copies of the template's and stay parity files, so
// these properties are guarded here.

interface Step {
  uses?: string
  with?: Record<string, string | number | boolean>
}

interface Workflow {
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean }
  jobs: Record<string, { steps: Step[] }>
}

const workflow = parse(
  readFileSync(join(repoRoot, '.github', 'workflows', 'ai-review.yml'), 'utf8'),
) as Workflow
const steps = Object.values(workflow.jobs).flatMap((job) => job.steps)

describe('ai-review.yml, this repository’s settings', () => {
  it('cancels the review of an earlier push', () => {
    expect(workflow.concurrency?.['cancel-in-progress']).toBe(true)
  })

  it('checks out the PR head without persisting credentials', () => {
    const head = steps.filter((step) => String(step.with?.ref ?? '').includes('pull_request.head.sha'))
    expect(head).toHaveLength(1)
    expect(head[0].uses).toBe('actions/checkout@v7')
    expect(head[0].with?.['persist-credentials']).toBe(false)
  })

  it('reviews with Claude Sonnet 5.5', () => {
    const review = steps.filter((step) => step.uses === 'anthropics/claude-code-action@v1')
    expect(review).toHaveLength(1)
    expect(String(review[0].with?.claude_args ?? '')).toMatch(/^\s*--model claude-sonnet-5-5\s*$/m)
  })
})
