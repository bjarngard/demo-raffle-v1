import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Update weights based on Twitch data
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { streamId } = await request.json()

    // Get all users with Twitch data
    const users = await prisma.user.findMany({
      where: {
        lastActive: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Active in last 24 hours
        },
      },
    })

    const updatedUsers = []
    const { calculateUserWeight } = await import('@/lib/weight-settings')

    for (const user of users) {
      // Calculate weight based on Twitch engagement using database settings
      const weight = await calculateUserWeight({
        isSubscriber: user.isSubscriber,
        subMonths: user.subMonths,
        resubCount: user.resubCount,
        totalCheerBits: user.totalCheerBits,
        totalDonations: user.totalDonations,
        totalGiftedSubs: user.totalGiftedSubs,
        carryOverWeight: user.carryOverWeight,
      })

      // Update user with calculated weight
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          currentWeight: weight - user.carryOverWeight, // Current weight without carry-over
          totalWeight: weight,
          lastUpdated: new Date(),
        },
      })

      updatedUsers.push({
        id: updatedUser.id,
        username: updatedUser.username,
        totalWeight: updatedUser.totalWeight,
      })
    }

    return NextResponse.json({
      success: true,
      updated: updatedUsers.length,
      users: updatedUsers,
    })
  } catch (error: any) {
    console.error('Error updating weights:', error)
    return NextResponse.json(
      { error: 'Failed to update weights', details: error.message },
      { status: 500 }
    )
  }
}

