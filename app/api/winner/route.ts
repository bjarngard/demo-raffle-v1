import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { entryStateExclusion } from '@/lib/submissions-state'
import { getCurrentSession, getLatestEndedSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const currentSession = await getCurrentSession()
    let winner = await findLatestWinner(currentSession?.id)

    if (!winner) {
      const lastSession = await getLatestEndedSession()
      winner = await findLatestWinner(lastSession?.id)
    }

    return NextResponse.json({ winner: winner ?? null }, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in /api/winner:', error)
    
    // Return JSON even on error
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching the winner',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
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

async function findLatestWinner(sessionId?: string | null) {
  if (!sessionId) return null

  return prisma.entry.findFirst({
    where: {
      sessionId,
      isWinner: true,
      ...entryStateExclusion,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      name: true,
    },
  })
}

