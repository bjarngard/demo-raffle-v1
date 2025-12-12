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
  const started = Date.now()

  const session = await auth()
  console.log('[weight/me] step=auth', `${Date.now() - started}ms`)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureUser(session.user)
  console.log('[weight/me] step=ensure-user', `${Date.now() - started}ms`)

  let resolvedUser: User | null = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  console.log('[weight/me] step=db-user', `${Date.now() - started}ms`)

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
      console.log('[weight/me] step=twitch-sync', `${Date.now() - started}ms`, 'trigger', syncTrigger)
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
  console.log('[weight/me] step=breakdown', `${Date.now() - started}ms`)

  const settings = await getWeightSettings()
  console.log('[weight/me] step=settings', `${Date.now() - started}ms`)

  const effectiveDisplayName = getUserDisplayName(resolvedUser)
  const effectiveUsername =
    (resolvedUser.username ?? '').trim() ||
    (resolvedUser.displayName ?? '').trim() ||
    (resolvedUser.twitchId ?? '').trim() ||
    resolvedUser.id

  console.log('[weight/me] done', `${Date.now() - started}ms`)

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

