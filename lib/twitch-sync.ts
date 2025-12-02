import type { User } from '@prisma/client'
import { prisma } from './prisma'
import { getBroadcasterAccessToken } from './twitch-oauth'
import { checkUserFollowsChannel, getUserSubscription } from './twitch-api'
import { calculateUserWeight } from './weight-settings'

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
  if (!options?.force && lastUpdatedMs && Date.now() - lastUpdatedMs < USER_TWITCH_SYNC_COOLDOWN_MS) {
    return { user: existingUser, updated: false, reason: 'cooldown' }
  }

  let broadcasterToken: string
  try {
    broadcasterToken = await getBroadcasterAccessToken()
  } catch (error) {
    console.error('Failed to fetch broadcaster token for Twitch sync:', error)
    return { user: existingUser, updated: false, reason: 'missing_broadcaster_token' }
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
    const isSubscriber = subscription?.isSubscriber ?? false
    const subMonths = subscription?.subMonths ?? 0

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
      },
    })

    return {
      user: updatedUser,
      updated: true,
      reason: syncReason,
    }
  } catch (error) {
    console.error('Error syncing user from Twitch API:', error)
    return {
      user: existingUser,
      updated: false,
      reason: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}

