import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { checkoutWithZone, repoRoot, stepOutput } from './support.ts'

interface Step {
  id?: string
  uses?: string
  run?: string
  env?: Record<string, string>
}

interface Workflow {
  on: Record<string, unknown>
  jobs: Record<string, { if?: string; 'runs-on'?: string; steps: Step[] }>
}

const workflowPath = join(repoRoot, '.github', 'workflows', 'dev-journey.yml')
const workflowText = readFileSync(workflowPath, 'utf8')
const workflow = parse(workflowText) as Workflow
const journey = Object.values(workflow.jobs)[0]
const scripts = (JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> })
  .scripts

function listed(project: string): string {
  return execFileSync('npx', ['playwright', 'test', '--list', `--project=${project}`], {
    cwd: repoRoot,
    env: { ...process.env, E2E_BASE_URL: 'https://example.invalid' },
    encoding: 'utf8',
  })
}

describe('Dev Journey workflow', () => {
  it('runs after a successful Dev Deploy and on demand, not on pull requests', () => {
    expect(workflow.on.workflow_run).toEqual({ workflows: ['Dev Deploy'], types: ['completed'] })
    expect(workflow.on).toHaveProperty('workflow_dispatch')
    expect(workflow.on).not.toHaveProperty('pull_request')
    expect(journey.if).toContain("github.event_name == 'workflow_dispatch'")
    expect(journey.if).toContain("github.event.workflow_run.conclusion == 'success'")
  })

  it('runs on the configured runner without secrets or the VPN', () => {
    expect(journey['runs-on']).toBe("${{ vars.RUNS_ON || 'ubuntu-latest' }}")
    expect(workflowText).not.toContain('secrets.')
    expect(workflowText).not.toContain('vpn-up')
  })

  it('runs the journey against the dev app Dev Deploy deploys to', () => {
    const target = journey.steps.find((step) => step.id === 'target')
    expect(stepOutput(target?.run ?? '')).toBe('url=https://app.dev.pilot.up.km.ua')
    expect(stepOutput(target?.run ?? '', checkoutWithZone('other.example'))).toBe('url=https://app.dev.other.example')
    const run = journey.steps.find((step) => step.run === 'npm run e2e:journey')
    expect(run?.env?.E2E_BASE_URL).toBe('${{ steps.target.outputs.url }}')
  })
})

describe('Playwright projects', () => {
  it('keeps the journey out of npm run e2e and runs only it in npm run e2e:journey', () => {
    expect(scripts.e2e).toBe('playwright test --project=chromium')
    expect(scripts['e2e:journey']).toBe('playwright test --project=journey')
    expect(listed('journey')).toContain('journey.spec.ts')
    const plain = listed('chromium')
    expect(plain).not.toContain('journey.spec.ts')
    expect(plain).toContain('landing.spec.ts')
  }, 60_000)
})
