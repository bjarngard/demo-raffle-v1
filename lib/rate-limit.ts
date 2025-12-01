// lib/rate-limit.ts

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export type RateLimitResult = {
  success: boolean
  message?: string
}

/**
 * Simple in-memory rate limiter.
 *
 * key:         unique key for what you are limiting, e.g. "demo_submit_ip:1.2.3.4"
 * maxRequests: how many calls are allowed within the window
 * windowMs:    time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  // First call or expired window -> reset
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true }
  }

  // Already at or above limit
  if (record.count >= maxRequests) {
    return {
      success: false,
      message: 'Rate limit exceeded',
    }
  }

  // Increment and allow
  record.count += 1
  rateLimitMap.set(key, record)
  return { success: true }
}
