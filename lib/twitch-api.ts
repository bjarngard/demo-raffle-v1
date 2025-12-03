/**
 * Twitch API helpers using official Helix endpoints
 * Based on official Twitch API documentation
 */
import { env } from './env'
import { getBroadcasterAccessToken } from './twitch-oauth'

const TWITCH_CLIENT_ID = env.TWITCH_CLIENT_ID
const BROADCASTER_ID = env.TWITCH_BROADCASTER_ID

// Cache broadcaster token to avoid duplicate fetches within a single event loop
let broadcasterTokenCache: { token: string; expiresAt: number } | null = null

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
        return { status: 'unknown', reason: 'unauthorized' }
      }
      console.error('Twitch API error checking follow:', response.status, responseText)
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
  tier: string
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

  try {
    const token = await resolveBroadcasterToken(broadcasterToken)

    const response = await fetch(
      `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${BROADCASTER_ID}&user_id=${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': TWITCH_CLIENT_ID,
        },
      }
    )

    const responseText = await response.text()
    
    if (!response.ok) {
      if (response.status === 404 || response.status === 400) {
        return {
          isSubscriber: false,
          subMonths: 0,
          tier: '1000',
          isGift: false,
        }
      }

      if (response.status === 401) {
        console.error('Twitch subscription check unauthorized:', responseText)
        return null
      }

      if (response.status === 429) {
        console.warn('Twitch subscription check rate limited')
        return null
      }

      console.error('Twitch API error fetching subscription:', response.status, responseText)
      return null
    }

    if (!responseText || responseText.trim().length === 0) {
      console.warn('Empty subscription response from Twitch for user:', userId)
      return null
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('Failed to parse subscription response:', responseText)
      return null
    }
    
    if (data.data && data.data.length > 0) {
      const sub = data.data[0]
      return {
        isSubscriber: true,
        subMonths: sub.cumulative_months || 0,
        tier: sub.tier || '1000',
        isGift: sub.is_gift || false,
      }
    }

    return {
      isSubscriber: false,
      subMonths: 0,
      tier: '1000',
      isGift: false,
    }
  } catch (error) {
    console.error('Error fetching subscription:', error)
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

