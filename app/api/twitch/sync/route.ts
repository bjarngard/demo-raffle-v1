import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { User } from '@prisma/client'
import { syncUserFromTwitch } from '@/lib/twitch-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Weight/Twitch sync (B): explicit force-sync bypasses cooldown for manual refresh.
    const { user, updated, reason } = await syncUserFromTwitch(session.user.id, {
      force: true,
      trigger: 'manual',
    })

    return NextResponse.json({
      success: true,
      updated,
      reason,
      user: serializeUser(user),
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

function serializeUser(user: User) {
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
