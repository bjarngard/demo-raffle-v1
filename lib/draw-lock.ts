/**
 * Simple in-memory draw lock (dev fallback)
 * Production should use Redis SETNX or similar
 */
const activeDraws = new Set<string>()

export function acquireDrawLock(sessionId: string): boolean {
  if (activeDraws.has(sessionId)) return false
  activeDraws.add(sessionId)
  setTimeout(() => activeDraws.delete(sessionId), 30000) // 30s timeout
  return true
}

export function releaseDrawLock(sessionId: string): void {
  activeDraws.delete(sessionId)
}

