/**
 * Rate limiting helper.
 *
 * NOTE: This is a no-op in production because Vercel serverless instances
 * do not share in-memory state. Downstream callers must remain idempotent.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count += 1
  rateLimitMap.set(key, record)
  return true
}

