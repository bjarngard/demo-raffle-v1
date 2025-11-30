import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { entryStateExclusion, getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Get top 20 entries with their win probability
 */
export async function GET() {
  try {
    const submissionsOpen = await getSubmissionsOpen()
    const currentSession = await getCurrentSession()

    if (!currentSession) {
      return NextResponse.json({
        submissionsOpen,
        totalEntries: 0,
        entries: [],
        sessionId: null,
      })
    }

    const entries = await prisma.entry.findMany({
      where: {
        sessionId: currentSession.id,
        isWinner: false,
        ...entryStateExclusion,
      },
      include: {
        user: {
          select: {
            totalWeight: true,
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const totalWeight = entries.reduce((sum, entry) => {
      const weight = entry.user?.totalWeight || 1.0
      return sum + weight
    }, 0)

    const entriesWithProbability = entries
      .map((entry) => {
        const weight = entry.user?.totalWeight || 1.0
        const probability = totalWeight > 0 ? (weight / totalWeight) * 100 : 0

        return {
          id: entry.id,
          name: entry.name || entry.user?.displayName || entry.user?.username || 'Unknown',
          weight,
          probability,
        }
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20)

    return NextResponse.json({
      submissionsOpen,
      totalEntries: entries.length,
      entries: entriesWithProbability,
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

