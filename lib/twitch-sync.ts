import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { getBroadcasterAccessToken } from './twitch-oauth'
import { checkUserFollowsChannel, getUserSubscription } from './twitch-api'
import { calculateUserWeight } from './weight-settings'

/**
 * Twitch sync overview (source of truth for user Twitch state → DB → weight engine)
 * - Syncs: follower status, subscriber status + months (tier/months via Helix subscription), keeps totalSubs in sync.
 * - Flags/fields: relies on user.needsResync (EventSub dirties), user.lastTwitchSyncAt (staleness), and an internal cooldown.
 * - Callers: /api/weight/me (lazy, gated), /api/twitch/sync (manual force), sign-in/auth flows indirectly via needsResync.
 */

// Sync cadence controls
export const USER_TWITCH_SYNC_COOLDOWN_MS = 60_000
export const SYNC_STALE_AFTER_MS = 10 * 60 * 1000

export type UserTwitchSyncResult = {
  user: User
  updated: boolean
  reason?: string
}

export type TwitchSyncTrigger =
  | 'needsResync'
  | 'missing_last_sync'
  | 'stale'
  | 'manual'
  | 'cooldown_bypass'
  | 'unknown'

export function getTwitchSyncTrigger(user: Pick<User, 'needsResync' | 'lastTwitchSyncAt'>): TwitchSyncTrigger | null {
  if (user.needsResync) return 'needsResync'
  const lastSync = user.lastTwitchSyncAt?.getTime() ?? 0
  if (!lastSync) return 'missing_last_sync'
  if (Date.now() - lastSync > SYNC_STALE_AFTER_MS) return 'stale'
  return null
}

export function shouldSyncTwitch(user: Pick<User, 'needsResync' | 'lastTwitchSyncAt'>): boolean {
  return getTwitchSyncTrigger(user) !== null
}

/**
 * Reconcile a single user with Twitch (the source of truth) based on their
 * current needsResync flag and the internal cooldown.
 */
export async function syncUserFromTwitch(
  userId: string,
  options?: { force?: boolean; trigger?: TwitchSyncTrigger }
): Promise<UserTwitchSyncResult> {
  const started = Date.now()
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!existingUser) {
    throw new Error('USER_NOT_FOUND')
  }

  if (!existingUser.twitchId) {
    return { user: existingUser, updated: false, reason: 'missing_twitch_id' }
  }

  const lastSyncMs = existingUser.lastTwitchSyncAt?.getTime() ?? 0
  const withinCooldown = Boolean(lastSyncMs) && Date.now() - lastSyncMs < USER_TWITCH_SYNC_COOLDOWN_MS
  const trigger = options?.trigger ?? getTwitchSyncTrigger(existingUser) ?? (options?.force ? 'cooldown_bypass' : 'unknown')

  if (!options?.force && !existingUser.needsResync && withinCooldown) {
    console.log('[twitch-sync] done status=skip trigger=cooldown user=%s %dms', existingUser.id, Date.now() - started)
    return { user: existingUser, updated: false, reason: 'cooldown' }
  }

  let broadcasterToken: string
  try {
    console.log('[twitch-sync] start trigger=%s user=%s', trigger, existingUser.id)
    broadcasterToken = await getBroadcasterAccessToken()
  } catch (error) {
    console.error('Failed to fetch broadcaster token for Twitch sync', {
      userId: existingUser.id,
      error,
    })
    try {
      const cleared = await prisma.user.update({
        where: { id: existingUser.id },
        data: { needsResync: false },
      })
      return { user: cleared, updated: false, reason: 'missing_broadcaster_token' }
    } catch (updateError) {
      console.error('Failed to clear needsResync after broadcaster token error', {
        userId: existingUser.id,
        error: updateError,
      })
      return { user: existingUser, updated: false, reason: 'missing_broadcaster_token' }
    }
  }

  try {
    const followResult = await checkUserFollowsChannel(existingUser.twitchId, broadcasterToken)
    let isFollower = existingUser.isFollower
    let syncReason: string | undefined

    if (followResult.status === 'following') {
      isFollower = true
    } else if (followResult.status === 'not_following') {
      isFollower = false
    } else if (followResult.status === 'unknown') {
      syncReason = followResult.reason ?? 'follow_status_unknown'
    }

    const subscription = await getUserSubscription(existingUser.twitchId, broadcasterToken)
    let isSubscriber = existingUser.isSubscriber
    let subMonths = existingUser.subMonths

    if (subscription) {
      if (subscription.isSubscriber) {
        isSubscriber = true
        subMonths = subscription.subMonths
      } else {
        isSubscriber = false
        subMonths = 0
      }
    } else {
      console.warn('[syncUserFromTwitch] subscription_fallback', {
        userId: existingUser.id,
        twitchId: existingUser.twitchId,
        reason: 'subscription_lookup_failed',
      })
    }

    console.log(
      '[syncUserFromTwitch] user=%s follower=%s subscriber=%s subMonths=%d reason=%s',
      existingUser.id,
      isFollower,
      isSubscriber,
      subMonths,
      syncReason ?? 'none'
    )

    const totalWeight = await calculateUserWeight({
      isSubscriber,
      subMonths,
      resubCount: existingUser.resubCount,
      totalCheerBits: existingUser.totalCheerBits,
      totalDonations: existingUser.totalDonations,
      totalGiftedSubs: existingUser.totalGiftedSubs,
      carryOverWeight: existingUser.carryOverWeight,
    })

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        isFollower,
        isSubscriber,
        subMonths,
        totalSubs: subMonths,
        totalWeight,
        currentWeight: totalWeight - existingUser.carryOverWeight,
        lastUpdated: new Date(),
        lastActive: new Date(),
        needsResync: false,
        lastTwitchSyncAt: new Date(),
      },
    })

    console.log(
      '[twitch-sync] done status=success trigger=%s user=%s %dms reason=%s',
      trigger,
      updatedUser.id,
      Date.now() - started,
      syncReason ?? 'none'
    )

    return {
      user: updatedUser,
      updated: true,
      reason: syncReason,
    }
  } catch (error) {
    console.error('Error syncing user from Twitch API', { userId: existingUser.id, error })
    console.log(
      '[twitch-sync] done status=error trigger=%s user=%s %dms message=%s',
      trigger,
      existingUser.id,
      Date.now() - started,
      error instanceof Error ? error.message : 'unknown_error'
    )
    try {
      const cleared = await prisma.user.update({
        where: { id: existingUser.id },
        data: { needsResync: false },
      })
      return {
        user: cleared,
        updated: false,
        reason: error instanceof Error ? error.message : 'unknown_error',
      }
    } catch (updateError) {
      console.error('Failed to clear needsResync after Twitch sync error:', updateError)
      return {
        user: existingUser,
        updated: false,
        reason: error instanceof Error ? error.message : 'unknown_error',
      }
    }
  }
}

