/**
 * Draw lock helper.
 *
 * NOTE: This helper does not guarantee exclusivity across serverless instances.
 * All draw-related Prisma operations must be idempotent and resilient to concurrency.
 */
export function acquireDrawLock(): boolean {
  return true
}

export function releaseDrawLock(): void {
  // no-op
}

