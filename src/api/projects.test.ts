import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import contract from '../../docs/features/todolist/contracts/openapi.yaml?raw'
import { statusLabels, validateProject, validateTask } from './projects.ts'

const validDescription = 'Things to do around the house'

describe('validateProject', () => {
  it('a name outside 5 to 20 characters is blocked with the allowed length', () => {
    for (const name of ['a'.repeat(4), 'a'.repeat(21)]) {
      expect(validateProject({ name, description: validDescription })).toEqual({
        name: 'Name must be 5 to 20 characters.',
      })
    }
  })

  it('a description outside 20 to 120 characters is blocked with the allowed length', () => {
    for (const description of ['a'.repeat(19), 'a'.repeat(121)]) {
      expect(validateProject({ name: 'Home chores', description })).toEqual({
        description: 'Description must be 20 to 120 characters.',
      })
    }
  })

  it('a name and description at the limits pass', () => {
    expect(validateProject({ name: 'a'.repeat(5), description: 'a'.repeat(20) })).toEqual({})
    expect(validateProject({ name: 'a'.repeat(20), description: 'a'.repeat(120) })).toEqual({})
  })
  it("enforces the contract's Project name and description length bounds", () => {
    const { name, description } = parse(contract).components.schemas.Project.properties
    const valid = { name: 'a'.repeat(name.minLength), description: 'a'.repeat(description.minLength) }

    for (const length of [name.minLength, name.maxLength]) {
      expect(validateProject({ ...valid, name: 'a'.repeat(length) })).toEqual({})
    }
    for (const length of [name.minLength - 1, name.maxLength + 1]) {
      expect(validateProject({ ...valid, name: 'a'.repeat(length) })).toHaveProperty('name')
    }
    for (const length of [description.minLength, description.maxLength]) {
      expect(validateProject({ ...valid, description: 'a'.repeat(length) })).toEqual({})
    }
    for (const length of [description.minLength - 1, description.maxLength + 1]) {
      expect(validateProject({ ...valid, description: 'a'.repeat(length) })).toHaveProperty('description')
    }
  })
})

describe('statusLabels', () => {
  it("labels exactly the contract's task statuses", () => {
    expect(Object.keys(statusLabels).sort()).toEqual([...parse(contract).components.schemas.TaskStatus.enum].sort())
  })
})

describe('validateTask', () => {
  const valid = { name: 'Buy milk', description: 'Two litres of whole milk' }

  it('an empty or blank name is blocked with what is allowed', () => {
    for (const name of ['', '   ']) {
      expect(validateTask({ ...valid, name })).toEqual({ name: 'Name must not be empty.' })
    }
  })

  it('an empty or blank description is blocked with what is allowed', () => {
    for (const description of ['', '   ']) {
      expect(validateTask({ ...valid, description })).toEqual({ description: 'Description must not be empty.' })
    }
  })

  it('a status outside the three is blocked with the allowed statuses', () => {
    expect(validateTask({ status: 'archived' })).toEqual({
      status: 'Status must be Not started, In progress or Completed.',
    })
  })

  it('each of the three statuses passes', () => {
    for (const status of ['not_started', 'in_progress', 'completed']) expect(validateTask({ ...valid, status })).toEqual({})
  })

  it("enforces the contract's Task name and description minimum length and status enum", () => {
    const { schemas } = parse(contract).components
    const { name, description } = schemas.Task.properties
    expect(validateTask({ name: 'a'.repeat(name.minLength), description: 'a'.repeat(description.minLength) })).toEqual({})
    expect(validateTask({ name: 'a'.repeat(name.minLength - 1), description: 'a'.repeat(description.minLength - 1) })).toEqual({
      name: 'Name must not be empty.',
      description: 'Description must not be empty.',
    })
    for (const status of schemas.TaskStatus.enum) expect(validateTask({ status })).toEqual({})
  })

  it('the contract answers task create and status change with the saved task or a 422', () => {
    const { paths } = parse(contract)
    expect(Object.keys(paths['/api/v1/projects/{project_id}/tasks'].post.responses)).toEqual(
      expect.arrayContaining(['201', '422']),
    )
    expect(Object.keys(paths['/api/v1/projects/{project_id}/tasks/{id}'].put.responses)).toEqual(
      expect.arrayContaining(['200', '422']),
    )
  })
})
