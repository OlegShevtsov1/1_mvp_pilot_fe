import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { checkoutWithZone, projectEnv, repoRoot, stepOutput } from './support.ts'

interface Step {
  id?: string
  name?: string
  uses?: string
  run?: string
  if?: string
  with?: Record<string, string>
}

interface Job {
  needs?: string | string[]
  if?: string
  environment?: string
  steps: Step[]
}

interface Workflow {
  on: Record<string, unknown>
  jobs: Record<string, Job>
}

const workflowPath = join(repoRoot, '.github', 'workflows', 'dev-deploy.yml')
const workflowText = readFileSync(workflowPath, 'utf8')
const workflow = parse(workflowText) as Workflow
const vpnUp = 'OlegShevtsov1/1_mvp_infra/.github/actions/vpn-up@env/dev'
const vpnDown = 'OlegShevtsov1/1_mvp_infra/.github/actions/vpn-down@env/dev'

function indexOf(steps: Step[], match: (step: Step) => boolean): number {
  const index = steps.findIndex(match)
  expect(index).toBeGreaterThanOrEqual(0)
  return index
}

function filesIn(dir: string): string[] {
  return readdirSync(join(repoRoot, dir)).map((file) => join(dir, file))
}

describe('Dev Deploy workflow', () => {
  it('runs after Front CI on develop and hotfix branches, and on demand', () => {
    expect(workflow.on.workflow_run).toEqual({
      workflows: ['Front CI'],
      types: ['completed'],
      branches: ['develop', 'hotfix/*'],
    })
    expect(workflow.on).toHaveProperty('workflow_dispatch')
  })

  it('names each automatic run after the commit it deploys', () => {
    const runName = /^run-name: (.+)$/m.exec(workflowText)?.[1] ?? ''
    expect(runName).toContain('workflow_run.head_sha')
    expect(runName).toContain('Dev Deploy sha-')
  })

  it('checks secrets first and needs the VPN action before deploying', () => {
    const preflight = workflow.jobs.preflight.steps
    expect(preflight[0].uses).toMatch(/^actions\/checkout@/)
    expect(preflight[1].run).toContain('deploy/preflight.sh dev')
    expect(workflow.jobs['vpn-up-check'].steps.map((step) => step.uses)).toEqual(
      expect.arrayContaining([vpnUp, vpnDown]),
    )
    expect(workflow.jobs.deploy.needs).toEqual(expect.arrayContaining(['preflight', 'vpn-up-check']))
  })

  it('holds the VPN only around the deploy and always releases it last', () => {
    const steps = workflow.jobs.deploy.steps
    const up = indexOf(steps, (step) => step.uses === vpnUp)
    const deploy = indexOf(steps, (step) => step.run?.includes('deploy/deploy.sh') ?? false)
    const build = indexOf(steps, (step) => step.uses?.startsWith('docker/build-push-action@') ?? false)
    expect(build).toBeLessThan(up)
    expect(up).toBeLessThan(deploy)
    expect(steps.at(-1)).toMatchObject({ uses: vpnDown, if: 'always()' })
  })

  it('passes the mirror VPN client inputs to the real vpn-up step and none to the guard', () => {
    const real = Object.entries(workflow.jobs)
      .filter(([name]) => name !== 'vpn-up-check')
      .flatMap(([name, job]) => job.steps.filter((step) => step.uses === vpnUp).map(() => name))
    expect(real).toEqual(['deploy'])

    const steps = workflow.jobs.deploy.steps
    const up = indexOf(steps, (step) => step.uses === vpnUp)
    const dns = indexOf(steps, (step) => step.id === 'dns')
    expect(dns).toBeLessThan(up)
    expect(Object.keys(steps[up].with ?? {})).toEqual(['ovpn', 'ci-vpn-ip', 'dev-host', 'dns-zones'])
    expect(steps[up].with).toEqual({
      ovpn: '${{ secrets.VPN_CI_OVPN }}',
      'ci-vpn-ip': '${{ secrets.CI_VPN_IP }}',
      'dev-host': '${{ secrets.DEV_HOST }}',
      'dns-zones': '${{ steps.dns.outputs.zones }}',
    })
    const zones = stepOutput(steps[dns].run ?? '')
    expect(zones).toBe(`zones=mvp.up.km.ua,${projectEnv().PROJECT_ZONE}`)
    expect(zones).toBe('zones=mvp.up.km.ua,pilot.up.km.ua')
    expect(() => stepOutput(steps[dns].run ?? '', checkoutWithZone('not a zone'))).toThrow(/invalid PROJECT_ZONE/)

    const guard = workflow.jobs['vpn-up-check'].steps.find((step) => step.uses === vpnUp)
    expect(guard).toMatchObject({ if: false, with: { ovpn: 'unused' } })
    expect(guard?.with).toEqual({ ovpn: 'unused' })
  })

  it('keeps expressions out of run scripts', () => {
    const runs = Object.values(workflow.jobs).flatMap((job) => job.steps.map((step) => step.run ?? ''))
    for (const run of runs) expect(run).not.toContain('${{')
  })

  it('names the project only in config/project.env', () => {
    const { PROJECT_NAME: name, PROJECT_ZONE: zone } = projectEnv()
    const files = [
      ...filesIn('.github/workflows'),
      ...filesIn('deploy'),
      ...filesIn('config').filter((file) => /^config\/deploy.*\.yml$/.test(file)),
    ]
    expect(files).toContain('config/deploy.dev.yml')
    const wholeWord = new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`, 'm')
    for (const file of files) {
      const text = readFileSync(join(repoRoot, file), 'utf8')
      expect(text, file).not.toMatch(wholeWord)
      expect(text, file).not.toContain(zone)
    }
  })

  it('keeps config/project.env to the public-safe name and zone', () => {
    expect(Object.keys(projectEnv())).toEqual(['PROJECT_NAME', 'PROJECT_ZONE'])
  })
})
