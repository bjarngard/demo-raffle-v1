import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getAdminEntries, getCarryOverUsersForSession } from '@/lib/admin-data'
import { getWeightSettings } from '@/lib/weight-settings'
import { getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession, getLatestEndedSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()

  try {
    const session = await requireAdminSession()
    console.log('[admin/dashboard] step=auth', `${Date.now() - started}ms`)
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
    console.log('[admin/dashboard] step=meta', `${Date.now() - started}ms`)

    const [entries, lastEndedSession] = await Promise.all([
      currentSession
        ? getAdminEntries({
            sessionId: currentSession.id,
          })
        : Promise.resolve<Awaited<ReturnType<typeof getAdminEntries>>>([]),
      getLatestEndedSession(),
    ])
    console.log('[admin/dashboard] step=data', `${Date.now() - started}ms`)

    const carryOverUsers =
      currentSession || !lastEndedSession
        ? []
        : await getCarryOverUsersForSession(lastEndedSession.id, 200)

    console.log('[admin/dashboard] done', `${Date.now() - started}ms`)

    return NextResponse.json({
      success: true,
      entries,
      settings,
      submissionsOpen,
      currentSession,
      lastEndedSession,
      carryOverUsers,
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

