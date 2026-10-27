import type { TokenPair, TokenStore } from './tokenStore.ts'

export function memoryStore(): TokenStore & { pair: TokenPair | null } {
  return {
    pair: null,
    read() {
      return this.pair
    },
    save(next) {
      this.pair = next
    },
    clear() {
      this.pair = null
    },
  }
}
