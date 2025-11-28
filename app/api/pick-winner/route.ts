import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/admin-auth'
import { acquireDrawLock, releaseDrawLock } from '@/lib/draw-lock'

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

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const isAuthenticated = await verifyAdminToken(request)

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    // Concurrency lock (single global lock for draws)
    const lockKey = 'draw:global'
    if (!acquireDrawLock(lockKey)) {
      return NextResponse.json(
        { success: false, error: 'Draw already in progress', code: 'CONFLICT' },
        { status: 409 }
      )
    }

    try {
      // Get all participants who are not winners with their user weights
      // Note: Using type assertion due to Prisma TypeScript type inference limitations
      const entries = (await prisma.entry.findMany({
        where: {
          isWinner: false,
        },
        include: {
          user: true, // Get all user fields (we only need totalWeight, but Prisma requires full include)
        },
      })) as unknown as EntryWithUser[]

      if (entries.length === 0) {
        releaseDrawLock(lockKey)
        return NextResponse.json(
          { success: false, error: 'No participants available to choose from' },
          { status: 400 }
        )
      }

      // Select winner using weighted random selection
      const winner = selectWeightedWinner(entries)
      const totalWeight = entries.reduce((sum, e) => sum + (e.user?.totalWeight || 1.0), 0)
      const seed = Math.random() // Store for deterministic client animation

      // Update winner in database (transaction)
      const updatedWinner = await prisma.$transaction(async (tx) => {
        const entry = await tx.entry.update({
          where: { id: winner.id },
          data: { isWinner: true },
        })
        if (winner.userId) {
          // @ts-ignore - Prisma transaction type inference issue
          await tx.user.update({
            where: { id: winner.userId },
            data: {
              totalCheerBits: 0,
              totalGiftedSubs: 0,
              lastUpdated: new Date(),
            },
          })
        }
        return entry
      })

      // Recalculate weight after reset
      if (winner.userId) {
        await recalculateUserWeight(winner.userId)
      }

      // Generate spin list for animation (top entries, excluding winner for cleaner animation)
      const spinList = entries
        .filter(e => e.id !== winner.id) // Exclude winner from spin list
        .map(e => ({ name: e.name, weight: e.user?.totalWeight || 1.0 }))
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 20)

      releaseDrawLock(lockKey)
      return NextResponse.json({
        success: true,
        winner: {
          id: updatedWinner.id,
          name: updatedWinner.name,
          email: updatedWinner.email,
          userId: winner.userId,
          weight: winner.user?.totalWeight || 1.0,
        },
        spinList,
        seed,
        totalWeight,
        message: 'Cheer bits and gifted subs reset for winner',
      })
    } catch (error) {
      releaseDrawLock(lockKey)
      throw error
    }
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
  // @ts-ignore - Prisma type inference issue
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

  // @ts-ignore - Prisma type inference issue
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentWeight: weight - user.carryOverWeight,
      totalWeight: weight,
    },
  })
}

