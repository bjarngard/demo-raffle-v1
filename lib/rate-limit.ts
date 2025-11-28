/**
 * Rate limiting helper.
 *
 * NOTE: This is a no-op in production because Vercel serverless instances
 * do not share in-memory state. Downstream callers must remain idempotent.
 */
export function checkRateLimit(): boolean {
  return true
}

