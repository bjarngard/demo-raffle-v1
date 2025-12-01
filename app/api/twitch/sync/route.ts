import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { checkUserFollowsChannel, getUserSubscription } from '@/lib/twitch-api'
import { getBroadcasterAccessToken } from '@/lib/twitch-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TwitchSyncUpdate = {
  isFollower: boolean
  isSubscriber: boolean
  subMonths: number
  totalSubs: number
}

type WeightSource = {
  isSubscriber: boolean
  subMonths: number
  resubCount: number
  totalCheerBits: number
  totalDonations: number
  totalGiftedSubs: number
  carryOverWeight: number
}

type SerializeUserSource = WeightSource & {
  id: string
  username: string | null
  displayName: string | null
  isFollower: boolean
  totalWeight: number
}

// Sync user's Twitch data in real-time
const USER_SYNC_COOLDOWN_MS = 60 * 1000

export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { accounts: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    const account = user.accounts.find((acc) => acc.provider === 'twitch')

    if (!account?.access_token) {
      return NextResponse.json(
        { success: false, error: 'Twitch account not linked' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (user.lastUpdated && now.getTime() - user.lastUpdated.getTime() < USER_SYNC_COOLDOWN_MS) {
      return NextResponse.json({
        success: true,
        user: serializeUser(user),
        skipped: true,
        message: 'Sync skipped due to cooldown',
      })
    }

    const broadcasterToken = await getBroadcasterAccessToken()

    const updates = await fetchTwitchData(broadcasterToken, user.twitchId)

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
      user: serializeUser(finalUser),
    })
  } catch (error) {
    console.error('Error syncing Twitch data:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync Twitch data',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

async function fetchTwitchData(broadcasterToken: string, twitchUserId: string): Promise<TwitchSyncUpdate> {
  // Check if user follows the channel using broadcaster token
  // GET /helix/channels/followers?broadcaster_id=<id>&user_id=<id>
  // Scope: moderator:read:followers (uses broadcaster token internally)
  const isFollower = await checkUserFollowsChannel(twitchUserId, broadcasterToken)

  // Get subscription info using broadcaster token
  // GET /helix/subscriptions?broadcaster_id=<id>&user_id=<id>
  // Scope: channel:read:subscriptions (uses broadcaster token internally)
  const subscription = await getUserSubscription(twitchUserId, broadcasterToken)
  const isSubscriber = subscription?.isSubscriber || false
  const subMonths = subscription?.subMonths || 0

  return {
    isFollower,
    isSubscriber,
    subMonths,
    totalSubs: subMonths,
  }
}

function serializeUser(user: SerializeUserSource) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    isFollower: user.isFollower,
    isSubscriber: user.isSubscriber,
    subMonths: user.subMonths,
    totalCheerBits: user.totalCheerBits,
    totalDonations: user.totalDonations,
    resubCount: user.resubCount,
    totalGiftedSubs: user.totalGiftedSubs,
    totalWeight: user.totalWeight,
    carryOverWeight: user.carryOverWeight,
  }
}
async function calculateWeight(user: WeightSource): Promise<number> {
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

