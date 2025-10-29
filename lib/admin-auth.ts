/**
 * Admin authentication helpers with cookie-based token storage
 */
import { cookies } from 'next/headers'
import { env } from './env'

const ADMIN_TOKEN_COOKIE = 'admin_token'
const ADMIN_TOKEN_MAX_AGE = 60 * 60 * 24 // 24 hours

/**
 * Verify admin token from request (supports both cookie and Authorization header)
 * Note: ARCHITECTURE.md doesn't specify Twitch admin session check (double gate),
 * only ADMIN_TOKEN validation is implemented per current architecture.
 */
export async function verifyAdminToken(request: Request): Promise<boolean> {
  const expectedToken = env.ADMIN_TOKEN

  // Try cookie first (more secure)
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value

  // Fallback to Authorization header
  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = authHeader?.replace('Bearer ', '') || undefined

  // Fallback to query param (for backwards compatibility)
  const url = new URL(request.url)
  const tokenFromQuery = url.searchParams.get('token') || undefined

  const adminToken = tokenFromCookie || tokenFromHeader || tokenFromQuery

  return adminToken === expectedToken
}

/**
 * Get admin token from request (for use in API routes)
 */
export async function getAdminToken(request: Request): Promise<string | null> {
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value

  if (tokenFromCookie) return tokenFromCookie

  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = authHeader?.replace('Bearer ', '')

  if (tokenFromHeader) return tokenFromHeader

  const url = new URL(request.url)
  return url.searchParams.get('token')
}

/**
 * Set admin token cookie (server-side)
 */
export async function setAdminTokenCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_TOKEN_MAX_AGE,
    path: '/',
  })
}

/**
 * Clear admin token cookie (server-side)
 */
export async function clearAdminTokenCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_TOKEN_COOKIE)
}

