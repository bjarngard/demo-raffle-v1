import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { startNewSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession()
    if (!adminSession) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    let name: string | undefined
    try {
      const body = await request.json()
      if (body && typeof body.name === 'string' && body.name.trim().length > 0) {
        name = body.name.trim()
      }
    } catch {
      // optional body
    }

    const session = await startNewSession(name)

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start session'
    const status = message === 'ACTIVE_SESSION_EXISTS' ? 400 : 500
    return NextResponse.json(
      { success: false, error: message },
      { status }
    )
  }
}
