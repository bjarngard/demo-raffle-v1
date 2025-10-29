import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { checkUserFollowsChannel, getUserSubscription } from '@/lib/twitch-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sync user's Twitch data in real-time
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { accounts: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const account = user.accounts.find((acc) => acc.provider === 'twitch')

    if (!account?.access_token) {
      return NextResponse.json(
        { error: 'Twitch account not linked' },
        { status: 400 }
      )
    }

    // Fetch latest data from Twitch API (including follow status)
    const updates = await fetchTwitchData(account.access_token, user.twitchId)

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...updates,
        lastUpdated: new Date(),
        lastActive: new Date(),
      },
    })

    // Recalculate weight
    const weight = await calculateWeight(updatedUser)

    const finalUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        totalWeight: weight,
        currentWeight: weight - updatedUser.carryOverWeight,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: finalUser.id,
        username: finalUser.username,
        displayName: finalUser.displayName,
        isFollower: finalUser.isFollower,
        isSubscriber: finalUser.isSubscriber,
        subMonths: finalUser.subMonths,
        totalCheerBits: finalUser.totalCheerBits,
        totalDonations: finalUser.totalDonations,
        resubCount: finalUser.resubCount,
        totalGiftedSubs: finalUser.totalGiftedSubs,
        totalWeight: finalUser.totalWeight,
        carryOverWeight: finalUser.carryOverWeight,
      },
    })
  } catch (error: any) {
    console.error('Error syncing Twitch data:', error)
    return NextResponse.json(
      { error: 'Failed to sync Twitch data', details: error.message },
      { status: 500 }
    )
  }
}

async function fetchTwitchData(accessToken: string, twitchUserId: string) {
  // Check if user follows the channel using broadcaster token
  // GET /helix/channels/followers?broadcaster_id=<id>&user_id=<id>
  // Scope: moderator:read:followers (uses broadcaster token internally)
  const isFollower = await checkUserFollowsChannel(twitchUserId)

  // Get subscription info using broadcaster token
  // GET /helix/subscriptions?broadcaster_id=<id>&user_id=<id>
  // Scope: channel:read:subscriptions (uses broadcaster token internally)
  const subscription = await getUserSubscription(twitchUserId)
  const isSubscriber = subscription?.isSubscriber || false
  const subMonths = subscription?.subMonths || 0

  return {
    isFollower,
    isSubscriber,
    subMonths,
    totalSubs: subMonths,
  }
}

async function calculateWeight(user: any): Promise<number> {
  const { calculateUserWeight } = await import('@/lib/weight-settings')
  
  return await calculateUserWeight({
    isSubscriber: user.isSubscriber,
    subMonths: user.subMonths,
    resubCount: user.resubCount,
    totalCheerBits: user.totalCheerBits,
    totalDonations: user.totalDonations,
    totalGiftedSubs: user.totalGiftedSubs,
    carryOverWeight: user.carryOverWeight,
  })
}

