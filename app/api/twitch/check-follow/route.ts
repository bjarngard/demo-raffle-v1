import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ensureUser } from '@/lib/user'
import { evaluateFollowStatus } from '@/lib/follow-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Check if logged-in user follows the channel
export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await ensureUser(session.user)
    // Gatekeeping (A): consult Twitch-evaluated status, treating unknown as non-blocking cache.
    const followStatus = await evaluateFollowStatus({
      id: user.id,
      twitchId: user.twitchId,
      isFollower: user.isFollower,
    })

    return NextResponse.json({
      success: true,
      status: followStatus.status,
      isFollower: followStatus.isFollower,
      reason: followStatus.reason ?? null,
      source: followStatus.source,
    })
  } catch (error) {
    console.error('Error checking follow status:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check follow status',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

