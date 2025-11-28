import type { NextAuthConfig } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { env } from './env'
import TwitchProvider from 'next-auth/providers/twitch'
import { checkUserFollowsChannel, getUserSubscription, getUserInfo } from './twitch-api'

// Update user Twitch data using official Twitch API endpoints
async function updateUserTwitchData(
  userId: string,
  accessToken: string,
  refreshToken?: string
) {
  try {
    // Fetch user info from Twitch API (using user token)
    const twitchUser = await getUserInfo(accessToken)

    if (!twitchUser || !twitchUser.id) {
      throw new Error('Twitch user not found or invalid')
    }

    // Check if user follows the channel (using broadcaster token)
    // GET /helix/channels/followers?broadcaster_id=<id>&user_id=<id>
    // Scope: moderator:read:followers (broadcaster-token required)
    let isFollower = false
    try {
      isFollower = await checkUserFollowsChannel(twitchUser.id)
    } catch (error) {
      console.error('Error checking follow status, defaulting to false:', error)
      isFollower = false
    }

    // Get subscription info (using broadcaster token)
    // GET /helix/subscriptions?broadcaster_id=<id>&user_id=<id>
    // Scope: channel:read:subscriptions (broadcaster-token required)
    let subscription = null
    try {
      subscription = await getUserSubscription(twitchUser.id)
    } catch (error) {
      console.error('Error fetching subscription, defaulting to non-subscriber:', error)
      subscription = { isSubscriber: false, subMonths: 0, tier: '1000', isGift: false }
    }
    
    const isSubscriber = subscription?.isSubscriber || false
    const subMonths = subscription?.subMonths || 0

    // Update or create user in database
    await prisma.user.upsert({
      where: { twitchId: twitchUser.id },
      create: {
        id: userId,
        twitchId: twitchUser.id,
        username: twitchUser.login,
        displayName: twitchUser.display_name,
        email: twitchUser.email,
        image: twitchUser.profile_image_url,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isSubscriber,
        isFollower,
        subMonths,
        totalSubs: subMonths,
        lastUpdated: new Date(),
        lastActive: new Date(),
      },
      update: {
        username: twitchUser.login,
        displayName: twitchUser.display_name,
        email: twitchUser.email,
        image: twitchUser.profile_image_url,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isSubscriber,
        isFollower,
        subMonths,
        totalSubs: subMonths,
        lastUpdated: new Date(),
        lastActive: new Date(),
      },
    })
  } catch (error) {
    console.error('Error updating Twitch data:', error)
    throw error
  }
}

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as any,
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    TwitchProvider({
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
      authorization: {
        params: {
          // User scopes - we use user token for user info
          // Broadcaster token (server-side) is used for checking follows/subs
          scope: 'user:read:email',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: { user: any; account: any; profile: any }) {
      if (account?.provider === 'twitch' && account.access_token) {
        // Update user with Twitch data after sign in
        try {
          await updateUserTwitchData(user.id, account.access_token, account.refresh_token)
          // Check if user follows channel - REQUIRED
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
          })
          if (!dbUser?.isFollower) {
            console.log('User does not follow channel, blocking sign-in')
            return false // Block sign-in if not following
          }
        } catch (error: any) {
          console.error('Error updating Twitch data during sign-in:', error)
          // Log more details for debugging
          if (error.message) {
            console.error('Error message:', error.message)
          }
          if (error.stack) {
            console.error('Error stack:', error.stack)
          }
          // Don't block sign-in on error, let it proceed but log the issue
          // This prevents the JSON parsing error from blocking authentication
          return true
        }
      }
      return true
    },
    async session({ session, token, user }: { session: any; token: any; user: any }) {
      try {
        // With JWT strategy, token is provided instead of user
        // With database strategy, user is provided
        if (!session) {
          return {
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            user: null,
          }
        }

        // For JWT strategy, use token; for database strategy, use user
        const userId = user?.id ?? token?.sub ?? (session as any).user?.id ?? null
        
        if (session.user && userId) {
          session.user.id = userId
          
          // Only fetch from DB if we have a user ID (database strategy)
          if (user?.id) {
            try {
              const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { isFollower: true },
              })
              ;(session as any).isFollower = dbUser?.isFollower || false
            } catch (error) {
              ;(session as any).isFollower = false
            }
          }
        }
        
        return {
          ...session,
          user: {
            ...session.user,
            id: userId,
          },
        }
      } catch (error) {
        console.error('AUTH_ERROR in session callback:', error)
        return {
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          user: null,
        }
      }
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'database',
  },
  debug: true,
  logger: {
    error: (...args: any[]) => console.error('AUTH_ERROR', ...args),
    warn: (...args: any[]) => console.warn('AUTH_WARN', ...args),
    debug: (...args: any[]) => console.log('AUTH_DEBUG', ...args),
  },
}


