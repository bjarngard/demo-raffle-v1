import type { NextAuthConfig } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { env } from './env'
import TwitchProvider from 'next-auth/providers/twitch'
import { checkUserFollowsChannel, getUserSubscription, getUserInfo } from './twitch-api'
import { getBroadcasterAccessToken, refreshTwitchAccessToken } from './twitch-oauth'

const isDevelopment = process.env.NODE_ENV === 'development'

// Update user Twitch data using official Twitch API endpoints
async function updateUserTwitchData(
  userId: string,
  accessToken: string,
) {
  try {
    // Fetch user info from Twitch API (using user token)
    const twitchUser = await getUserInfo(accessToken)

    if (!twitchUser || !twitchUser.id) {
      throw new Error('Twitch user not found or invalid')
    }

    const broadcasterToken = await getBroadcasterAccessToken()

    // Check if user follows the channel (using broadcaster token)
    // GET /helix/channels/followers?broadcaster_id=<id>&user_id=<id>
    // Scope: moderator:read:followers (broadcaster-token required)
    let isFollower = false
    try {
      isFollower = await checkUserFollowsChannel(twitchUser.id, broadcasterToken)
    } catch (error) {
      console.error('Error checking follow status, defaulting to false:', error)
      isFollower = false
    }

    // Get subscription info (using broadcaster token)
    // GET /helix/subscriptions?broadcaster_id=<id>&user_id=<id>
    // Scope: channel:read:subscriptions (broadcaster-token required)
    let subscription = null
    try {
      subscription = await getUserSubscription(twitchUser.id, broadcasterToken)
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

type TwitchTokenState = {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  providerAccountId?: string
}

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    TwitchProvider({
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
      authorization: {
        params: {
          // OIDC identity + email access for syncing Twitch profile
          // Broadcaster token (server-side) används separat för follows/subs
          scope: 'openid user:read:email',
        },
      },
      checks: ['state', 'pkce'],
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      const typedToken = token as typeof token & { twitch?: TwitchTokenState }

      if (account?.provider === 'twitch' && user) {
        const expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + (account.expires_in ?? 0) * 1000

        typedToken.twitch = {
          accessToken: account.access_token || '',
          refreshToken: account.refresh_token || undefined,
          expiresAt,
          providerAccountId: account.providerAccountId,
        }
      }

      const twitchState = typedToken.twitch
      if (!twitchState?.accessToken || !twitchState.refreshToken || !twitchState.expiresAt) {
        return typedToken
      }

      const shouldRefresh = Date.now() > twitchState.expiresAt - TOKEN_REFRESH_BUFFER_MS

      if (!shouldRefresh) {
        return typedToken
      }

      try {
        const refreshed = await refreshTwitchAccessToken(twitchState.refreshToken)
        const newExpiresAt = Date.now() + refreshed.expiresIn * 1000
        typedToken.twitch = {
          ...twitchState,
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? twitchState.refreshToken,
          expiresAt: newExpiresAt,
        }

        if (twitchState.providerAccountId) {
          await prisma.account.update({
            where: {
              provider_providerAccountId: {
                provider: 'twitch',
                providerAccountId: twitchState.providerAccountId,
              },
            },
            data: {
              access_token: refreshed.accessToken,
              refresh_token: refreshed.refreshToken ?? twitchState.refreshToken,
              expires_at: Math.floor(newExpiresAt / 1000),
            },
          })
        }
      } catch (error) {
        if (isDevelopment) {
          console.error('Failed to refresh Twitch access token:', error)
        }
      }

      return typedToken
    },
    async signIn({ user, account }) {
      if (account?.provider === 'twitch' && account.access_token) {
        // Update user with Twitch data after sign in
        try {
          await updateUserTwitchData(user.id, account.access_token)
          // Check if user follows channel - REQUIRED
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
          })
          if (!dbUser?.isFollower) {
            console.log('User does not follow channel, blocking sign-in')
            return false // Block sign-in if not following
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Unknown sign-in error')
          console.error('Error updating Twitch data during sign-in:', err)
          if (err.message) {
            console.error('Error message:', err.message)
          }
          if (err.stack) {
            console.error('Error stack:', err.stack)
          }
          // Don't block sign-in on error, let it proceed but log the issue
          // This prevents the JSON parsing error from blocking authentication
          return true
        }
      }
      return true
    },
    async session({ session, token }) {
      try {
        if (!session) {
          return session
        }

        const userId = token?.sub ?? session.user?.id ?? null
        
        if (session.user && userId) {
          session.user.id = userId
        }

        if (session.user?.id) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { isFollower: true },
            })
            session.isFollower = dbUser?.isFollower ?? false
          } catch {
            session.isFollower = false
          }
        }

        const isBroadcaster =
          !!token &&
          ((token as typeof token & { twitch?: TwitchTokenState }).twitch?.providerAccountId === env.TWITCH_BROADCASTER_ID)
        session.isBroadcaster = isBroadcaster
        if (session.user) {
          session.user.isBroadcaster = isBroadcaster
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
        return session
      }
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  debug: isDevelopment,
  logger: isDevelopment
    ? {
        error: (...args: unknown[]) => console.error('AUTH_ERROR', ...args),
        warn: (...args: unknown[]) => console.warn('AUTH_WARN', ...args),
        debug: (...args: unknown[]) => console.log('AUTH_DEBUG', ...args),
      }
    : undefined,
}


