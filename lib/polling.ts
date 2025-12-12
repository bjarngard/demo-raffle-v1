/**
 * Jitter helper to soften thundering herd on polling.
 */
export function withJitter(baseMs: number, factor = 0.3): number {
  const delta = baseMs * factor
  const min = baseMs - delta
  const max = baseMs + delta
  return Math.round(min + Math.random() * (max - min))
}


