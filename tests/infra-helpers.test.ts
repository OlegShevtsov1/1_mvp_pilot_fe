import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { repoRoot, stepOutput } from './support.ts'

interface Step {
  id?: string
  name?: string
  uses?: string
  run?: string
  if?: string
  with?: Record<string, unknown>
  env?: Record<string, string>
}

interface Job {
  steps?: Step[]
}

interface Workflow {
  jobs: Record<string, Job>
}

const workflowsDir = join(repoRoot, '.github', 'workflows')
const workflows = Object.fromEntries(
  readdirSync(workflowsDir)
    .filter((file) => file.endsWith('.yml'))
    .map((file) => {
      const text = readFileSync(join(workflowsDir, file), 'utf8')
      return [file, { text, workflow: parse(text) as Workflow }]
    }),
)

const sharedActions = ['vpn-up', 'vpn-down', 'notify-telegram']
const localActions = sharedActions.map((name) => `./infra-helpers/.github/actions/${name}`)
const guardedWorkflows = ['dev-deploy.yml', 'kamal-deploy.yml', 'kamal-manage.yml']

const allSteps = Object.values(workflows).flatMap(({ workflow }) =>
  Object.values(workflow.jobs).flatMap((job) => job.steps ?? []),
)
const isCheckout = (step: Step) => step.uses?.startsWith('actions/checkout@') ?? false
const isInfraCheckout = (step: Step) => step.with?.path === 'infra-helpers'
const usesInfraHelper = (step: Step) => step.uses?.startsWith('./infra-helpers/') ?? false

function jobsUsingInfraHelpers(): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const [file, { workflow }] of Object.entries(workflows)) {
    const jobs = Object.entries(workflow.jobs)
      .filter(([, job]) => (job.steps ?? []).some(usesInfraHelper))
      .map(([name]) => name)
    if (jobs.length > 0) found[file] = jobs.sort()
  }
  return found
}

function stepsOf(file: string, job: string): Step[] {
  return workflows[file].workflow.jobs[job].steps ?? []
}

describe('shared CI actions of 1_mvp_infra', () => {
  it('references no shared action of 1_mvp_infra remotely', () => {
    for (const step of allSteps) {
      const uses = step.uses ?? ''
      if (!uses.startsWith('./infra-helpers/')) expect(uses).not.toMatch(/1_mvp_infra\//)
    }
    for (const [file, { text }] of Object.entries(workflows)) {
      expect(text, file).not.toMatch(/1_mvp_infra\/\.github\/actions\/[^\s]*@/)
    }
  })

  it('uses only the three shared actions from the checkout', () => {
    for (const step of allSteps.filter(usesInfraHelper)) expect(localActions).toContain(step.uses)
    expect(jobsUsingInfraHelpers()).toEqual({
      'dev-deploy.yml': ['deploy', 'notify'],
      'develop-guard.yml': ['alert'],
      'kamal-deploy.yml': ['deploy', 'notify', 'release-watch'],
      'kamal-manage.yml': ['manage', 'notify'],
      'main-guard.yml': ['alert'],
      'release.yml': ['notify'],
    })
  })

  it('checks out 1_mvp_infra before any shared action, and nothing checks out over it', () => {
    for (const [file, jobs] of Object.entries(jobsUsingInfraHelpers())) {
      for (const job of jobs) {
        const where = `${file} ${job}`
        const steps = stepsOf(file, job)
        expect(steps.filter(isInfraCheckout), where).toHaveLength(1)
        const infra = steps.findIndex(isInfraCheckout)
        const ownCheckout = isCheckout(steps[0]) && !steps[0].with?.repository && !steps[0].with?.path
        expect(infra, where).toBe(ownCheckout ? 1 : 0)
        steps.forEach((step, index) => {
          if (usesInfraHelper(step)) expect(index, where).toBeGreaterThan(infra)
          if (index > infra && isCheckout(step)) expect(step.with?.path, where).toBeDefined()
        })
      }
    }
  })

  it("checks out the owner's 1_mvp_infra at env/dev with INFRA_READ_TOKEN, sparse and without stored credentials", () => {
    const pins = new Set(allSteps.filter(isCheckout).map((step) => step.uses))
    expect(pins.size).toBe(1)
    const infraCheckouts = allSteps.filter(isInfraCheckout)
    expect(infraCheckouts).toHaveLength(13)
    for (const step of infraCheckouts) {
      expect(step.uses).toBe([...pins][0])
      const options = step.with ?? {}
      expect(options.repository).toBe('${{ github.repository_owner }}/1_mvp_infra')
      expect(options.ref).toBe('env/dev')
      expect(options.token).toBe('${{ secrets.INFRA_READ_TOKEN }}')
      expect(options['persist-credentials']).toBe(false)
      const sparse = String(options['sparse-checkout'] ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      expect(sparse).toEqual(['.github/actions', 'scripts', 'host'])
      expect(options).not.toHaveProperty('sparse-checkout-cone-mode')
    }
  })

  it.each(guardedWorkflows)('%s guards the checkout before deploying: token, checkout, three action.yml files', (file) => {
    const steps = stepsOf(file, 'vpn-up-check')
    const infra = steps.findIndex(isInfraCheckout)
    expect(infra).toBeGreaterThan(0)
    expect(steps.filter((step) => step.uses).map((step) => step.uses)).toEqual([steps[infra].uses])
    expect(steps[infra].id).toBe('infra')

    const tokenCheck = steps
      .slice(0, infra)
      .find((step) => step.env?.INFRA_READ_TOKEN === '${{ secrets.INFRA_READ_TOKEN }}')
    expect(tokenCheck?.run).toContain('::error::')
    expect(tokenCheck?.run).toContain('INFRA_READ_TOKEN')

    const checkoutFailed = steps.find((step) => step.if?.includes("steps.infra.outcome == 'failure'"))
    expect(checkoutFailed?.run).toContain('INFRA_READ_TOKEN')

    const actionsCheck = steps.slice(infra + 1).find((step) => step.run?.includes('action.yml'))
    for (const word of [...sharedActions, 'INFRA_READ_TOKEN']) expect(actionsCheck?.run).toContain(word)
  })

  it.each(guardedWorkflows)('%s reports a failed guard as the shared CI actions stage', (file) => {
    const compose = stepsOf(file, 'notify').find((step) => step.id === 'message')
    const text = stepOutput(compose?.run ?? '', repoRoot, {
      GUARD: 'success',
      PREFLIGHT: 'success',
      VPN_CHECK: 'failure',
      DEPLOY: 'skipped',
      MANAGE: 'skipped',
      ACTION: 'reboot',
      RUN_URL: 'https://example.test/run',
    })
    expect(text).toContain('failed at guard (shared CI actions): https://example.test/run')
    expect(text).not.toContain('vpn-up availability')
  })

  it.each([
    ['dev-deploy.yml', 'deploy/preflight.sh dev'],
    ['kamal-deploy.yml', 'deploy/prod_preflight.sh'],
    ['kamal-manage.yml', 'deploy/prod_preflight.sh'],
  ])('%s requires INFRA_READ_TOKEN in its preflight', (file, script) => {
    const step = stepsOf(file, 'preflight').find((candidate) => candidate.run?.includes(script))
    expect(step?.run).toContain('INFRA_READ_TOKEN')
    expect(Object.keys(step?.env ?? {})).toContain('INFRA_READ_TOKEN')
  })

  it('keeps the checked-out helpers out of the Docker build context', () => {
    const lines = readFileSync(join(repoRoot, '.dockerignore'), 'utf8').split('\n').map((line) => line.trim())
    expect(lines).toContain('infra-helpers')
  })
})
