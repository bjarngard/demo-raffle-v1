import type { User } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { describeWeightBreakdown, getWeightSettings } from '@/lib/weight-settings'
import { ensureUser } from '@/lib/user'
import { syncUserFromTwitch } from '@/lib/twitch-sync'
import { getUserDisplayName } from '@/lib/user-display-name'

const STALE_WEIGHT_MAX_AGE_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Surface the viewer's canonical raffle weight. EventSub flags users via
 * needsResync; this route optionally refreshes them from Twitch before
 * returning cached state to the frontend.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureUser(session.user)

  let resolvedUser: User | null = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!resolvedUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // EventSub marks dirty users (needsResync); also refresh stale cache entries.
  const now = Date.now()
  const lastUpdatedMs = resolvedUser.lastUpdated?.getTime() ?? 0
  const isStale = !lastUpdatedMs || now - lastUpdatedMs > STALE_WEIGHT_MAX_AGE_MS
  const syncTrigger = resolvedUser.needsResync ? 'event' : isStale ? 'stale' : null

  if (syncTrigger) {
    try {
      const syncResult = await syncUserFromTwitch(resolvedUser.id)
      if (syncResult.updated) {
        resolvedUser = syncResult.user
      }
    } catch (error) {
      console.error('Lazy Twitch sync failed in /api/weight/me:', {
        userId: resolvedUser.id,
        trigger: syncTrigger,
        error,
      })
    }
  }

  const breakdown = await describeWeightBreakdown({
    isSubscriber: resolvedUser.isSubscriber,
    subMonths: resolvedUser.subMonths,
    resubCount: resolvedUser.resubCount,
    totalCheerBits: resolvedUser.totalCheerBits,
    totalDonations: resolvedUser.totalDonations,
    totalGiftedSubs: resolvedUser.totalGiftedSubs,
    carryOverWeight: resolvedUser.carryOverWeight,
  })

  const settings = await getWeightSettings()

  const effectiveDisplayName = getUserDisplayName(resolvedUser)
  const effectiveUsername =
    (resolvedUser.username ?? '').trim() ||
    (resolvedUser.displayName ?? '').trim() ||
    (resolvedUser.twitchId ?? '').trim() ||
    resolvedUser.id

  return NextResponse.json({
    user: {
      id: resolvedUser.id,
      username: effectiveUsername,
      displayName: effectiveDisplayName,
      isFollower: resolvedUser.isFollower,
      isSubscriber: resolvedUser.isSubscriber,
      subMonths: resolvedUser.subMonths,
      resubCount: resolvedUser.resubCount,
      totalCheerBits: resolvedUser.totalCheerBits,
      totalDonations: resolvedUser.totalDonations,
      totalGiftedSubs: resolvedUser.totalGiftedSubs,
      carryOverWeight: resolvedUser.carryOverWeight,
      totalWeight: breakdown.totalWeight,
    },
    breakdown,
    settings,
  })
}

