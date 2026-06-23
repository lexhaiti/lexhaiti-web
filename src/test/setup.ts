import '@testing-library/jest-dom/vitest'

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom only exposes Web Storage for a concrete document origin; the vitest
// config sets no jsdom `url`, so `window.localStorage` is undefined and any
// test that persists state (e.g. the language preference) crashes on it.
// Provide a minimal in-memory localStorage/sessionStorage when jsdom hasn't.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}

if (typeof window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
  })
  Object.defineProperty(window, 'sessionStorage', {
    value: new MemoryStorage(),
    configurable: true,
  })
}

afterEach(() => {
  cleanup()
  // Test isolation: clear persisted state so order can't leak between cases.
  // (e.g. the language switcher persists the choice in a cookie + localStorage;
  // a `localStorage.clear()` in a beforeEach alone misses the cookie.)
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; max-age=0; path=/`
  }
  window.localStorage?.clear()
  window.sessionStorage?.clear()
})
