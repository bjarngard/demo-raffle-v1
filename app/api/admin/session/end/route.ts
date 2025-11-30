import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getCurrentSession, endCurrentSession } from '@/lib/session'
import { applyCarryOverForSession } from '@/lib/carry-over'

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

    let resetWeights = false
    try {
      const body = await request.json()
      if (typeof body?.resetWeights === 'boolean') {
        resetWeights = body.resetWeights
      }
    } catch {
      // optional body
    }

    const currentSession = await getCurrentSession()

    if (!currentSession) {
      return NextResponse.json(
        { success: false, error: 'No active session to end.' },
        { status: 400 }
      )
    }

    const carryOver = await applyCarryOverForSession(currentSession.id, resetWeights)
    const endedSession = await endCurrentSession()

    return NextResponse.json({
      success: true,
      session: endedSession,
      carryOver,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to end session'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
