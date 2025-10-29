/**
 * Mark that a user's demo has been played
 * This resets their cheer bits and gifted subs to prevent whales
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Reset cheer bits and gifted subs when demo is played
    // This prevents whales from constantly winning
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        totalCheerBits: 0,
        totalGiftedSubs: 0,
        lastUpdated: new Date(),
      },
    })

    // Recalculate weight after reset
    await recalculateUserWeight(userId)

    return NextResponse.json({
      success: true,
      message: 'Demo played - cheer bits and gifted subs reset',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        totalCheerBits: updatedUser.totalCheerBits,
        totalGiftedSubs: updatedUser.totalGiftedSubs,
        totalWeight: updatedUser.totalWeight,
      },
    })
  } catch (error: any) {
    console.error('Error in /api/demo-played:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Recalculate user weight with caps on subscriptions
 */
async function recalculateUserWeight(userId: string) {
  try {
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
  } catch (error) {
    console.error('Error recalculating user weight:', error)
  }
}

