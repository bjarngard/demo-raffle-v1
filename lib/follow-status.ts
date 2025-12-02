import { prisma } from './prisma'
import { getBroadcasterAccessToken } from './twitch-oauth'
import { checkUserFollowsChannel } from './twitch-api'

export type FollowStatusValue = 'following' | 'not_following' | 'unknown'

export type FollowStatusResult = {
  status: FollowStatusValue
  isFollower: boolean
  source: 'live' | 'cache'
  reason?: string
}

type FollowedUserSnapshot = {
  id: string
  twitchId: string
  isFollower: boolean
}

export async function evaluateFollowStatus(
  user: FollowedUserSnapshot,
  options?: { broadcasterToken?: string }
): Promise<FollowStatusResult> {
  if (!user?.twitchId) {
    return {
      status: 'unknown',
      isFollower: user?.isFollower ?? false,
      source: 'cache',
      reason: 'missing_twitch_id',
    }
  }

  let broadcasterToken = options?.broadcasterToken || null
  if (!broadcasterToken) {
    try {
      broadcasterToken = await getBroadcasterAccessToken()
    } catch {
      return {
        status: 'unknown',
        isFollower: user.isFollower,
        source: 'cache',
        reason: 'missing_broadcaster_token',
      }
    }
  }

  const followResult = await checkUserFollowsChannel(user.twitchId, broadcasterToken)
  if (followResult.status === 'unknown') {
    return {
      status: 'unknown',
      isFollower: user.isFollower,
      source: 'cache',
      reason: followResult.reason ?? 'twitch_api_error',
    }
  }

  const isFollower = followResult.status === 'following'
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isFollower,
      lastActive: new Date(),
    },
  })

  return {
    status: followResult.status,
    isFollower,
    source: 'live',
  }
}

