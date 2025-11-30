import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { applyCarryOverForSession } from '@/lib/carry-over'
import { getCurrentSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    const { sessionId, resetWeights = false } = body || {}

    let targetSessionId = sessionId as string | undefined
    if (!targetSessionId) {
      const currentSession = await getCurrentSession()
      if (!currentSession) {
        return NextResponse.json(
          { success: false, error: 'No active session found. Provide sessionId to run carry-over manually.', errorCode: 'NO_ACTIVE_SESSION' },
          { status: 400 }
        )
      }
      targetSessionId = currentSession.id
    }

    const result = await applyCarryOverForSession(targetSessionId, resetWeights)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('Error carrying over weights:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to carry over weights',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

