import { NextResponse } from 'next/server'

import { entryStateExclusion, getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [submissionsOpen, currentSession] = await Promise.all([
      getSubmissionsOpen(),
      getCurrentSession(),
    ])

    const hasActiveSession = Boolean(currentSession)
    const sessionId = currentSession?.id ?? null

    let lastEntryAt: string | null = null

    if (currentSession) {
      const lastEntry = await prisma.entry.aggregate({
        where: {
          sessionId: currentSession.id,
          ...entryStateExclusion,
        },
        _max: {
          createdAt: true,
        },
      })

      lastEntryAt = lastEntry._max.createdAt
        ? lastEntry._max.createdAt.toISOString()
        : null
    }

    return NextResponse.json({
      submissionsOpen,
      hasActiveSession,
      sessionId,
      lastEntryAt,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[status] failed to load status', error)
    return NextResponse.json({ error: 'Failed to load status' }, { status: 500 })
  }
}

