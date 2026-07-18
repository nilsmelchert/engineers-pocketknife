/**
 * Local, privacy-friendly progress tracking: a set of completed module paths
 * persisted in localStorage, with a tiny external-store hook for React.
 */

import { useSyncExternalStore } from 'react'

const KEY = 'pk-progress'
const listeners = new Set<() => void>()

let cache: string = localStorage.getItem(KEY) ?? '[]'

function read(): Set<string> {
  try {
    return new Set(JSON.parse(cache) as string[])
  } catch {
    return new Set()
  }
}

function write(set: Set<string>): void {
  cache = JSON.stringify([...set])
  localStorage.setItem(KEY, cache)
  listeners.forEach((l) => l())
}

export function toggleCompleted(path: string): void {
  const set = read()
  if (set.has(path)) set.delete(path)
  else set.add(path)
  write(set)
}

export function isCompleted(path: string): boolean {
  return read().has(path)
}

/** Reactive snapshot of the completed-set serialization. */
export function useProgress(): Set<string> {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => cache,
  )
  try {
    return new Set(JSON.parse(snap) as string[])
  } catch {
    return new Set()
  }
}
