/**
 * Twitch API helpers using official Helix endpoints
 * Based on official Twitch API documentation
 */
import { env } from './env'
import { getBroadcasterAccessToken } from './twitch-oauth'
import { maskSuffix } from './mask'

const TWITCH_CLIENT_ID = env.TWITCH_CLIENT_ID
const BROADCASTER_ID = env.TWITCH_BROADCASTER_ID

// Cache broadcaster token to avoid duplicate fetches within a single event loop
let broadcasterTokenCache: { token: string; expiresAt: number } | null = null
const apiDebugEnabled = process.env.WEIGHT_SYNC_DEBUG === '1'
const logThrottleMs = 60_000
const logSeen = new Map<string, number>()
const throttledError = (key: string, payload: Record<string, unknown>) => {
  const now = Date.now()
  const last = logSeen.get(key) ?? 0
  if (now - last < logThrottleMs) return
  logSeen.set(key, now)
  console.error('[twitch-api]', payload)
}

type TwitchUserProfile = {
  id: string
  login: string
  display_name: string
  email?: string | null
  profile_image_url?: string | null
}

async function resolveBroadcasterToken(providedToken?: string): Promise<string> {
  if (providedToken) {
    return providedToken
  }

  const now = Date.now()
  if (broadcasterTokenCache && broadcasterTokenCache.expiresAt > now) {
    return broadcasterTokenCache.token
  }

  const token = await getBroadcasterAccessToken()
  // Cache token for 30 seconds to avoid repeated DB lookups
  broadcasterTokenCache = {
    token,
    expiresAt: now + 30 * 1000,
  }
  return token
}

export type FollowApiResult = {
  status: 'following' | 'not_following' | 'unknown'
  reason?: string
}

/**
 * Check if a user follows the broadcaster channel
 * GET https://api.twitch.tv/helix/channels/followers?broadcaster_id=<id>&user_id=<id>
 * Scope: moderator:read:followers (broadcaster-token)
 */
export async function checkUserFollowsChannel(
  userId: string | null,
  broadcasterToken?: string
): Promise<FollowApiResult> {
  if (!userId) {
    return { status: 'unknown', reason: 'missing_user_id' }
  }

  try {
    const token = await resolveBroadcasterToken(broadcasterToken)

    const response = await fetch(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${BROADCASTER_ID}&user_id=${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': TWITCH_CLIENT_ID,
        },
      }
    )

    const responseText = await response.text()
    
    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'not_following' }
      }
      if (response.status === 401) {
        throttledError('follow:401', {
          endpoint: 'follow',
          userId: maskSuffix(userId),
          status: response.status,
          reason: 'unauthorized',
        })
        return { status: 'unknown', reason: 'unauthorized' }
      }
      if (response.status >= 500) {
        throttledError(`follow:${response.status}`, {
          endpoint: 'follow',
          userId: maskSuffix(userId),
          status: response.status,
          reason: 'http_error',
        })
      } else if (apiDebugEnabled) {
        console.error('Twitch API error checking follow:', response.status, responseText)
      }
      return { status: 'unknown', reason: `http_${response.status}` }
    }

    if (!responseText || responseText.trim().length === 0) {
      return { status: 'unknown', reason: 'empty_response' }
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse follow response:', responseText)
      return { status: 'unknown', reason: 'invalid_json' }
    }
    const follows = Boolean(data.data && data.data.length > 0)
    return { status: follows ? 'following' : 'not_following' }
  } catch (error) {
    console.error('Error checking follow status:', error)
    return { status: 'unknown', reason: 'network_error' }
  }
}

export type UserSubscription = {
  isSubscriber: boolean
  subMonths: number
  tier: string | null
  isGift: boolean
} | null

/**
 * Get user's subscription info to broadcaster channel
 * GET https://api.twitch.tv/helix/subscriptions?broadcaster_id=<id>&user_id=<id>
 * Scope: channel:read:subscriptions (broadcaster-token)
 * Returns: user_id, tier, is_gift, cumulative_months, etc.
 */
export async function getUserSubscription(userId: string | null, broadcasterToken?: string): Promise<UserSubscription> {
  if (!userId) {
    return null
  }

  type HelixBroadcasterSubscription = {
    broadcaster_id: string
    broadcaster_login: string
    broadcaster_name: string
    gifter_id: string | null
    gifter_login: string | null
    gifter_name: string | null
    is_gift: boolean
    plan_name: string
    tier: string
    user_id: string
    user_name: string
    user_login: string
  }

  type HelixBroadcasterSubscriptionResponse = {
    data?: HelixBroadcasterSubscription[]
    total?: number
    points?: number
  }

  const url = new URL('https://api.twitch.tv/helix/subscriptions')
  url.searchParams.set('broadcaster_id', BROADCASTER_ID)
  url.searchParams.set('user_id', userId)

  try {
    const token = await resolveBroadcasterToken(broadcasterToken)

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    })

    const responseText = await response.text()

    const notSubscribedResponse =
      response.status === 404 ||
      (response.status === 400 && /not\s+subscribed|user\s+does\s+not\s+have/i.test(responseText))

    if (!response.ok) {
      if (notSubscribedResponse) {
        if (apiDebugEnabled) {
          console.log('[getUserSubscription] not_subscribed', {
            userId: maskSuffix(userId),
            broadcasterId: maskSuffix(BROADCASTER_ID),
            status: response.status,
          })
        }
        return {
          isSubscriber: false,
          subMonths: 0,
          tier: null,
          isGift: false,
        }
      }

      if (response.status === 401 || response.status === 403) {
        throttledError(`subscription:${response.status}`, {
          endpoint: 'subscription',
          userId: maskSuffix(userId),
          status: response.status,
          reason: 'unauthorized',
        })
        return null
      }

      if (response.status === 429) {
        throttledError('subscription:429', {
          endpoint: 'subscription',
          userId: maskSuffix(userId),
          status: response.status,
          reason: 'rate_limited',
        })
        return null
      }

      if (response.status >= 500) {
        throttledError(`subscription:${response.status}`, {
          endpoint: 'subscription',
          userId: maskSuffix(userId),
          status: response.status,
          reason: 'http_error',
        })
      } else if (apiDebugEnabled) {
        console.error('[getUserSubscription] helix_error', {
          userId: maskSuffix(userId),
          broadcasterId: maskSuffix(BROADCASTER_ID),
          status: response.status,
          url: url.toString(),
          body: responseText,
          reason: 'http_error',
        })
      }
      return null
    }

    if (!responseText || responseText.trim().length === 0) {
      if (apiDebugEnabled) {
        console.error('[getUserSubscription] helix_error', {
          userId: maskSuffix(userId),
          broadcasterId: maskSuffix(BROADCASTER_ID),
          status: response.status,
          url: url.toString(),
          reason: 'empty_body',
        })
      }
      return null
    }

    let data: HelixBroadcasterSubscriptionResponse
    try {
      data = JSON.parse(responseText) as HelixBroadcasterSubscriptionResponse
    } catch {
      if (apiDebugEnabled) {
        console.error('[getUserSubscription] helix_error', {
          userId: maskSuffix(userId),
          broadcasterId: maskSuffix(BROADCASTER_ID),
          status: response.status,
          url: url.toString(),
          reason: 'invalid_json',
          body: responseText,
        })
      }
      return null
    }

    const subscription = data.data && data.data.length > 0 ? data.data[0] : null

    if (!subscription) {
      if (apiDebugEnabled) {
        console.log('[getUserSubscription] not_subscribed', {
          userId: maskSuffix(userId),
          broadcasterId: maskSuffix(BROADCASTER_ID),
          reason: 'no_data',
        })
      }
      return {
        isSubscriber: false,
        subMonths: 0,
        tier: null,
        isGift: false,
      }
    }

    const normalized: UserSubscription = {
      isSubscriber: true,
      subMonths: 0,
      tier: subscription.tier ?? null,
      isGift: Boolean(subscription.is_gift),
    }

    if (apiDebugEnabled) {
      console.log('[getUserSubscription] success', {
        userId: maskSuffix(userId),
        broadcasterId: maskSuffix(BROADCASTER_ID),
        tier: normalized.tier,
        isGift: normalized.isGift,
      })
    }

    return normalized
  } catch (error) {
    if (apiDebugEnabled) {
      console.error('[getUserSubscription] helix_error', {
        userId: maskSuffix(userId),
        broadcasterId: maskSuffix(BROADCASTER_ID),
        url: url.toString(),
        reason: 'network_error',
        error,
      })
    }
    return null
  }
}

/**
 * Get user info from Twitch API
 */
export async function getUserInfo(accessToken: string): Promise<TwitchUserProfile> {
  const response = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  })

  const responseText = await response.text()
  
  if (!response.ok) {
    console.error('Failed to fetch Twitch user data:', response.status, responseText)
    throw new Error(`Failed to fetch Twitch user data: ${response.status}`)
  }

  if (!responseText || responseText.trim().length === 0) {
    throw new Error('Empty response from Twitch users endpoint')
  }

  let data: { data?: TwitchUserProfile[] }
  try {
    data = JSON.parse(responseText) as { data?: TwitchUserProfile[] }
  } catch {
    console.error('Failed to parse user data response:', responseText)
    throw new Error('Invalid JSON response from Twitch users endpoint')
  }
  
  if (!data.data || !data.data[0]) {
    throw new Error('No user data in Twitch API response')
  }
  
  return data.data[0]
}

