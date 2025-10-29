/**
 * Twitch API helpers using official Helix endpoints
 * Based on official Twitch API documentation
 */
import { env } from './env'

const TWITCH_CLIENT_ID = env.TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = env.TWITCH_CLIENT_SECRET
const BROADCASTER_ID = env.TWITCH_BROADCASTER_ID

// Cache broadcaster token to avoid refreshing too often
let broadcasterTokenCache: { token: string; expiresAt: number } | null = null

/**
 * Get broadcaster access token (for server-side API calls)
 * This token has broadcaster scopes and can check subs/follows
 */
async function getBroadcasterToken(): Promise<string> {
  // Check cache first
  if (broadcasterTokenCache && broadcasterTokenCache.expiresAt > Date.now() + 60000) {
    return broadcasterTokenCache.token
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'channel:read:subscriptions moderator:read:followers bits:read',
      }),
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error('Failed to get broadcaster token:', response.status, responseText)
      throw new Error(`Failed to get broadcaster token: ${response.status}`)
    }

    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Empty response from Twitch token endpoint')
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse broadcaster token response:', responseText)
      throw new Error('Invalid JSON response from Twitch token endpoint')
    }
    const expiresAt = Date.now() + (data.expires_in * 1000) - 60000 // Refresh 1 min before expiry

    broadcasterTokenCache = {
      token: data.access_token,
      expiresAt,
    }

    return data.access_token
  } catch (error) {
    console.error('Error getting broadcaster token:', error)
    throw error
  }
}

/**
 * Check if a user follows the broadcaster channel
 * GET https://api.twitch.tv/helix/channels/followers?broadcaster_id=<id>&user_id=<id>
 * Scope: moderator:read:followers (broadcaster-token)
 */
export async function checkUserFollowsChannel(userId: string): Promise<boolean> {
  try {
    const token = await getBroadcasterToken()

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
        return false // User doesn't follow
      }
      console.error('Twitch API error checking follow:', response.status, responseText)
      return false // Return false on error instead of throwing
    }

    if (!responseText || responseText.trim().length === 0) {
      return false
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse follow response:', responseText)
      return false
    }
    return data.data && data.data.length > 0
  } catch (error) {
    console.error('Error checking follow status:', error)
    return false
  }
}

/**
 * Get user's subscription info to broadcaster channel
 * GET https://api.twitch.tv/helix/subscriptions?broadcaster_id=<id>&user_id=<id>
 * Scope: channel:read:subscriptions (broadcaster-token)
 * Returns: user_id, tier, is_gift, cumulative_months, etc.
 */
export async function getUserSubscription(userId: string): Promise<{
  isSubscriber: boolean
  subMonths: number
  tier: string
  isGift: boolean
} | null> {
  try {
    const token = await getBroadcasterToken()

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
        return { isSubscriber: false, subMonths: 0, tier: '1000', isGift: false }
      }
      console.error('Twitch API error fetching subscription:', response.status, responseText)
      return { isSubscriber: false, subMonths: 0, tier: '1000', isGift: false } // Return default instead of throwing
    }

    if (!responseText || responseText.trim().length === 0) {
      return { isSubscriber: false, subMonths: 0, tier: '1000', isGift: false }
    }

    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse subscription response:', responseText)
      return { isSubscriber: false, subMonths: 0, tier: '1000', isGift: false }
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

    return { isSubscriber: false, subMonths: 0, tier: '1000', isGift: false }
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

/**
 * Get user info from Twitch API
 */
export async function getUserInfo(accessToken: string): Promise<any> {
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

  let data
  try {
    data = JSON.parse(responseText)
  } catch (parseError) {
    console.error('Failed to parse user data response:', responseText)
    throw new Error('Invalid JSON response from Twitch users endpoint')
  }
  
  if (!data.data || !data.data[0]) {
    throw new Error('No user data in Twitch API response')
  }
  
  return data.data[0]
}

