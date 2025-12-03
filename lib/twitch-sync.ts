import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { getBroadcasterAccessToken } from './twitch-oauth'
import { checkUserFollowsChannel, getUserSubscription } from './twitch-api'
import { calculateUserWeight } from './weight-settings'

// Canonical bridge: Twitch → normalized DB → weight engine.
export const USER_TWITCH_SYNC_COOLDOWN_MS = 60_000

export type UserTwitchSyncResult = {
  user: User
  updated: boolean
  reason?: string
}

export async function syncUserFromTwitch(
  userId: string,
  options?: { force?: boolean }
): Promise<UserTwitchSyncResult> {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!existingUser) {
    throw new Error('USER_NOT_FOUND')
  }

  if (!existingUser.twitchId) {
    return { user: existingUser, updated: false, reason: 'missing_twitch_id' }
  }

  const lastUpdatedMs = existingUser.lastUpdated?.getTime() ?? 0
  const withinCooldown = Boolean(lastUpdatedMs) && Date.now() - lastUpdatedMs < USER_TWITCH_SYNC_COOLDOWN_MS

  if (!options?.force && !existingUser.needsResync && withinCooldown) {
    return { user: existingUser, updated: false, reason: 'cooldown' }
  }

  let broadcasterToken: string
  try {
    broadcasterToken = await getBroadcasterAccessToken()
  } catch (error) {
    console.error('Failed to fetch broadcaster token for Twitch sync:', error)
    try {
      const cleared = await prisma.user.update({
        where: { id: existingUser.id },
        data: { needsResync: false },
      })
      return { user: cleared, updated: false, reason: 'missing_broadcaster_token' }
    } catch (updateError) {
      console.error('Failed to clear needsResync after broadcaster token error:', updateError)
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
      isSubscriber = subscription.isSubscriber
      subMonths = subscription.subMonths
    }

    console.log(
      '[syncUserFromTwitch] userId=%s follower=%s subscriber=%s subMonths=%d reason=%s',
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
      },
    })

    console.log(
      '[syncUserFromTwitch] persisted userId=%s subscriber=%s subMonths=%d',
      updatedUser.id,
      updatedUser.isSubscriber,
      updatedUser.subMonths
    )

    return {
      user: updatedUser,
      updated: true,
      reason: syncReason,
    }
  } catch (error) {
    console.error('Error syncing user from Twitch API:', error)
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

