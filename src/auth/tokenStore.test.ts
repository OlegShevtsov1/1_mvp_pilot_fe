// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { createTokenStore } from './tokenStore.ts'

const pair = { accessToken: 'a1', refreshToken: 'r1' }

describe('createTokenStore', () => {
  beforeEach(() => localStorage.clear())

  it('keeps a saved pair and forgets it on clear', () => {
    const store = createTokenStore()
    store.save(pair)
    expect(store.read()).toEqual(pair)
    store.clear()
    expect(store.read()).toBeNull()
  })

  it('reads nothing from a corrupted or foreign value', () => {
    const store = createTokenStore()
    localStorage.setItem('pilot.tokens', 'not json')
    expect(store.read()).toBeNull()
    localStorage.setItem('pilot.tokens', '{"accessToken":1}')
    expect(store.read()).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    const blocked = createTokenStore(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    const failing = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    const broken = createTokenStore(() => ({ getItem: failing, setItem: failing, removeItem: failing }) as unknown as Storage)
    for (const store of [blocked, broken]) {
      expect(store.read()).toBeNull()
      expect(() => store.save(pair)).not.toThrow()
      expect(() => store.clear()).not.toThrow()
    }
  })

  it('keeps a pair that storage refused for this page', () => {
    const failing = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    const store = createTokenStore(() => ({ getItem: failing, setItem: failing, removeItem: failing }) as unknown as Storage)
    store.save(pair)
    expect(store.read()).toEqual(pair)
    store.clear()
    expect(store.read()).toBeNull()
  })

  it('reads a pair another tab saved', () => {
    const store = createTokenStore()
    store.save(pair)
    const rotated = { accessToken: 'a2', refreshToken: 'r2' }
    createTokenStore().save(rotated)
    expect(store.read()).toEqual(rotated)
  })

  it('reads storage again once a save succeeds after a refused one', () => {
    let full = true
    const store = createTokenStore(() => {
      if (full) throw new DOMException('full', 'QuotaExceededError')
      return localStorage
    })
    store.save(pair)
    full = false
    const rotated = { accessToken: 'a2', refreshToken: 'r2' }
    store.save(rotated)
    expect(store.read()).toEqual(rotated)
  })
})
