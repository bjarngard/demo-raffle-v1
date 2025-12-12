import { NextResponse } from 'next/server'
import { getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession } from '@/lib/session'
import { getLeaderboardEntries } from '@/lib/leaderboard-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Get top 20 entries with their win probability
 */
export async function GET() {
  const started = Date.now()

  try {
    const submissionsOpen = await getSubmissionsOpen()
    const currentSession = await getCurrentSession()
    console.log('[leaderboard] step=state', `${Date.now() - started}ms`)

    if (!currentSession) {
      console.log('[leaderboard] step=no-session', `${Date.now() - started}ms`)
      return NextResponse.json({
        submissionsOpen,
        totalEntries: 0,
        entries: [],
        sessionId: null,
      })
    }

    const { entries: leaderboardEntries, totalEntries } = await getLeaderboardEntries(currentSession.id)
    console.log('[leaderboard] step=data', `${Date.now() - started}ms`)

    console.log('[leaderboard] done', `${Date.now() - started}ms`)

    return NextResponse.json({
      submissionsOpen,
      totalEntries,
      entries: leaderboardEntries,
      sessionId: currentSession.id,
    })
  } catch (error) {
    console.error('Error in /api/leaderboard:', error)
    return NextResponse.json(
      {
        error: 'An error occurred while fetching leaderboard',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

