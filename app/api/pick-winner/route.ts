import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { Prisma } from '@prisma/client'
import { entryStateExclusion } from '@/lib/submissions-state'
import { getCurrentSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Type for entry with optional user relation
type EntryWithUser = {
  id: number
  userId: string | null
  name: string
  email: string | null
  demoLink: string | null
  createdAt: Date
  isWinner: boolean
  streamId: string | null
  user: {
    id: string
    totalWeight: number
    displayName: string
    username: string
  } | null
}

export async function POST() {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const currentSession = await getCurrentSession()
    if (!currentSession) {
      return NextResponse.json(
        { success: false, error: 'No active session. Start a session before picking a winner.' },
        { status: 400 }
      )
    }

    const entries = (await prisma.entry.findMany({
      where: {
        sessionId: currentSession.id,
        isWinner: false,
        ...entryStateExclusion,
      },
      include: {
        user: true,
      },
    })) as unknown as EntryWithUser[]

    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No participants available to choose from' },
        { status: 400 }
      )
    }

    const winner = selectWeightedWinner(entries)
    const totalWeight = entries.reduce((sum, e) => sum + (e.user?.totalWeight || 1.0), 0)
    const seed = Math.random()

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const freshEntry = await tx.entry.findUnique({
        where: { id: winner.id },
        include: { user: true },
      })

      if (!freshEntry || freshEntry.isWinner) {
        throw new Error('Entry already processed')
      }

      const updatedEntry = await tx.entry.update({
        where: { id: winner.id },
        data: { isWinner: true },
      })

      if (freshEntry.userId) {
        await tx.user.update({
          where: { id: freshEntry.userId },
          data: {
            totalCheerBits: 0,
            totalGiftedSubs: 0,
            lastUpdated: new Date(),
          },
        })
      }

      return updatedEntry
    }, { timeout: 5000 })

    if (winner.userId) {
      await recalculateUserWeight(winner.userId)
    }

    const spinList = entries
      .filter(e => e.id !== winner.id)
      .map(e => ({ name: e.name, weight: e.user?.totalWeight || 1.0 }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20)

    return NextResponse.json({
      success: true,
      winner: {
        id: result.id,
        name: result.name,
        email: result.email,
        userId: winner.userId,
        weight: winner.user?.totalWeight || 1.0,
      },
      spinList,
      seed,
      totalWeight,
      message: 'Cheer bits and gifted subs reset for winner',
    })
  } catch (error) {
    console.error('Error in /api/pick-winner:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred while picking the winner' },
      { status: 500 }
    )
  }
}

// Weighted random selection function
function selectWeightedWinner(entries: EntryWithUser[]) {
  // Calculate total weight
  const totalWeight = entries.reduce((sum, entry) => {
    const weight = entry.user?.totalWeight || 1.0
    return sum + weight
  }, 0)

  // Generate random number between 0 and totalWeight
  let random = Math.random() * totalWeight

  // Find the winner based on weighted probability
  for (const entry of entries) {
    const weight = entry.user?.totalWeight || 1.0
    random -= weight
    if (random <= 0) {
      return entry
    }
  }

  // Fallback to last entry (shouldn't happen, but just in case)
  return entries[entries.length - 1]
}

/**
 * Recalculate user weight with caps to prevent whales
 */
async function recalculateUserWeight(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) return

  const { calculateUserWeight } = await import('@/lib/weight-settings')
  
  const weight = await calculateUserWeight({
    isSubscriber: user.isSubscriber,
    subMonths: user.subMonths,
    resubCount: user.resubCount,
    totalCheerBits: user.totalCheerBits,
    totalDonations: user.totalDonations,
    totalGiftedSubs: user.totalGiftedSubs,
    carryOverWeight: user.carryOverWeight,
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentWeight: weight - user.carryOverWeight,
      totalWeight: weight,
    },
  })
}

