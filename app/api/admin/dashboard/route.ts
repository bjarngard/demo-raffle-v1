import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getAdminEntries } from '@/lib/admin-data'
import { getWeightSettings } from '@/lib/weight-settings'
import { getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession, getLatestEndedSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const [settings, submissionsOpen, currentSession] = await Promise.all([
      getWeightSettings(),
      getSubmissionsOpen(),
      getCurrentSession(),
    ])

    const [entries, lastEndedSession] = await Promise.all([
      currentSession
        ? getAdminEntries({
            sessionId: currentSession.id,
          })
        : Promise.resolve<Awaited<ReturnType<typeof getAdminEntries>>>([]),
      getLatestEndedSession(),
    ])

    return NextResponse.json({
      success: true,
      entries,
      settings,
      submissionsOpen,
      currentSession,
      lastEndedSession,
    })
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch admin dashboard data',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

