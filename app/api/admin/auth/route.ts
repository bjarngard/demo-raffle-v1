/**
 * Admin authentication endpoint
 * POST: Login with token, sets cookie
 * DELETE: Logout, clears cookie
 */
import { NextRequest, NextResponse } from 'next/server'
import { setAdminTokenCookie, clearAdminTokenCookie, verifyAdminToken } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    const { env } = await import('@/lib/env')
    const expectedToken = env.ADMIN_TOKEN

    if (token !== expectedToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Set cookie
    await setAdminTokenCookie(token)

    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
    })
  } catch (error: any) {
    console.error('Error in admin auth:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await clearAdminTokenCookie()

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error: any) {
    console.error('Error in admin logout:', error)
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = await verifyAdminToken(request)

    return NextResponse.json({
      authenticated: isAuthenticated,
    })
  } catch (error: any) {
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    )
  }
}

