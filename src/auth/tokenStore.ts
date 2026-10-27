export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface TokenStore {
  read(): TokenPair | null
  save(pair: TokenPair): void
  clear(): void
}

const key = 'pilot.tokens'

export function isTokenPair(value: unknown): value is TokenPair {
  if (typeof value !== 'object' || value === null) return false
  const { accessToken, refreshToken } = value as Record<string, unknown>
  return typeof accessToken === 'string' && accessToken !== '' && typeof refreshToken === 'string' && refreshToken !== ''
}

/** The pair in a token answer (`access_token`, `refresh_token`), or null when the answer has none. */
export function tokenPairFrom(body: unknown): TokenPair | null {
  if (typeof body !== 'object' || body === null) return null
  const { access_token: accessToken, refresh_token: refreshToken } = body as Record<string, unknown>
  const pair = { accessToken, refreshToken }
  return isTokenPair(pair) ? pair : null
}

/**
 * Keeps the token pair in localStorage (ADR-0006). Storage can be blocked, full or hold a foreign value; none of
 * that throws: a pair that cannot be saved lasts for this page only.
 */
export function createTokenStore(storage: () => Storage = () => window.localStorage): TokenStore {
  // Only a pair storage refused lives here; otherwise storage stays the source, so a pair another tab saved is read.
  let unsaved: TokenPair | null = null

  return {
    read() {
      if (unsaved) return unsaved
      try {
        const value: unknown = JSON.parse(storage().getItem(key) ?? 'null')
        return isTokenPair(value) ? { accessToken: value.accessToken, refreshToken: value.refreshToken } : null
      } catch {
        return null
      }
    },
    save(pair) {
      try {
        storage().setItem(key, JSON.stringify(pair))
        unsaved = null
      } catch {
        unsaved = pair
      }
    },
    clear() {
      unsaved = null
      try {
        storage().removeItem(key)
      } catch {
        // Nothing readable is stored when storage is unavailable.
      }
    },
  }
}
