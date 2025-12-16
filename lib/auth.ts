import type { NextAuthConfig } from 'next-auth'
import type { AdapterUser } from 'next-auth/adapters'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { env } from './env'
import TwitchProvider from 'next-auth/providers/twitch'
import { checkUserFollowsChannel, getUserSubscription, getUserInfo } from './twitch-api'
import { getBroadcasterAccessToken, refreshTwitchAccessToken } from './twitch-oauth'

const isDevelopment = process.env.NODE_ENV === 'development'
const authDebugEnabled =
  process.env.NODE_ENV !== 'production' && process.env.AUTH_DEBUG_TWITCH_PROFILE === '1'

const maskSuffix = (value: unknown) => {
  if (value === null || value === undefined) return 'missing'
  const str = String(value)
  if (str.length <= 4) return `...${str}`
  return `...${str.slice(-4)}`
}

// Base adapter; we wrap createUser below as a final safety net to ensure twitchId/username/displayName are persisted.
const baseAdapter = PrismaAdapter(prisma)

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

    let broadcasterAccessToken: string | null = null
    try {
      broadcasterAccessToken = await getBroadcasterAccessToken()
    } catch (error) {
      if (isDevelopment) {
        console.warn(
          'Broadcaster token unavailable while updating Twitch data; skipping follow/sub sync.',
          error,
        )
      }
      broadcasterAccessToken = null
    }

    // Check if user follows the channel (using broadcaster token)
    // GET /helix/channels/followers?broadcaster_id=<id>&user_id=<id>
    // Scope: moderator:read:followers (broadcaster-token required)
    let isFollower: boolean | undefined
    let subscription: {
      isSubscriber: boolean
      subMonths: number
      tier: string | null
      isGift: boolean
    } | null = null

    if (broadcasterAccessToken) {
      try {
        const followResult = await checkUserFollowsChannel(twitchUser.id, broadcasterAccessToken)
        if (followResult.status !== 'unknown') {
          isFollower = followResult.status === 'following'
        }
      } catch (error) {
        console.error('Error checking follow status, keeping previous value:', error)
      }

      // Get subscription info (using broadcaster token)
      // GET /helix/subscriptions?broadcaster_id=<id>&user_id=<id>
      // Scope: channel:read:subscriptions (broadcaster-token required)
      try {
        subscription = await getUserSubscription(twitchUser.id, broadcasterAccessToken)
      } catch (error) {
        console.error('Error fetching subscription, defaulting to non-subscriber:', error)
        subscription = { isSubscriber: false, subMonths: 0, tier: null, isGift: false }
      }
    } else {
      subscription = { isSubscriber: false, subMonths: 0, tier: null, isGift: false }
    }

    const isSubscriber = subscription?.isSubscriber || false
    const subMonths = subscription?.subMonths || 0
    const followerUpdate =
      typeof isFollower === 'boolean'
        ? { isFollower }
        : {}

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
        ...followerUpdate,
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
        ...followerUpdate,
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
  adapter: {
    ...baseAdapter,
    // Final safety net: ensure twitchId/username/displayName are always persisted, even if adapter drops custom fields.
    async createUser(data) {
      const twitchId = (data as { twitchId?: string; id?: string }).twitchId ?? (data as { id?: string }).id
      if (!twitchId) {
        throw new Error('Missing twitchId in createUser')
      }

      const username =
        (data as { username?: string; name?: string }).username ||
        (data as { name?: string }).name ||
        `viewer-${twitchId}`
      const displayName = (data as { displayName?: string; name?: string }).displayName || (data as { name?: string }).name || username
      const email = (data as { email?: string | null }).email ?? null
      const image = (data as { image?: string | null }).image ?? null
      const user = await prisma.user.upsert({
        where: { twitchId },
        create: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(data as any),
          twitchId,
          username,
          displayName,
          email,
          image,
        },
        update: {
          username,
          displayName,
          email,
          image,
        },
      })
      const adapterUser = {
        id: user.id,
        email: user.email ?? undefined,
        emailVerified: null,
        name: user.displayName ?? user.username,
        image: user.image ?? undefined,
      } as AdapterUser
      return adapterUser
    },
  },
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    TwitchProvider({
      clientId: env.TWITCH_CLIENT_ID,
      clientSecret: env.TWITCH_CLIENT_SECRET,
      authorization: {
        params: {
          // OIDC identity, email, and broadcaster scopes needed for Helix calls
          scope:
            'openid user:read:email user:read:follows moderator:read:followers channel:read:subscriptions bits:read',
        },
      },
      checks: ['state', 'pkce'],
    
      // IMPORTANT: allow linking based on email (only enabled in non-prod to reduce risk surface)
      allowDangerousEmailAccountLinking: isDevelopment,

  profile(profile) {
    const p = profile as Partial<{
      sub: string | number
      id: string | number
      preferred_username: string
      login: string
      name: string
      display_name: string
      picture: string
      profile_image_url: string
      email: string
    }>

    // Debug-only; gated to non-production to avoid noisy logs.
    if (authDebugEnabled) {
      console.log('[auth][twitch][profile]', {
        keys: Object.keys(profile ?? {}),
        sub: p.sub,
        id: p.id,
        twitchIdSource: p.sub ? 'sub' : p.id ? 'id' : 'missing',
        preferred_username: p.preferred_username,
        login: p.login,
        name: p.name,
        display_name: p.display_name,
        picture: p.picture ?? p.profile_image_url,
        email: p.email ? '[present]' : null,
      })
    }

    const twitchIdRaw = p.sub ?? p.id
    const twitchId = twitchIdRaw ? String(twitchIdRaw) : ''

    if (!twitchId) {
      throw new Error('Missing twitchId from Twitch profile (expected sub)')
    }

    const username = (p.preferred_username ?? p.login ?? '').toString() || `viewer-${twitchId}`

    const displayName = (p.name ?? p.display_name ?? '').toString() || username

    const image = (p.picture ?? p.profile_image_url ?? null) as string | null

    const email = (p.email ?? null) as string | null

    // Return profile-shaped user with extra fields needed by our Prisma schema; adapter/DB assigns `id`.
    const baseUser = {
      name: displayName,
      email,
      image,
      twitchId,
      username,
      displayName,
    }

    // We return a profile-shaped object without id; adapter will assign id. Cast to any to satisfy provider typings.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return baseUser as any
  },
    }),
    
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      const typedToken = token as typeof token & { twitch?: TwitchTokenState }

      if (authDebugEnabled) {
        console.log('[auth][debug][jwt]', {
          ts: new Date().toISOString(),
          provider: account?.provider ?? 'unknown',
          providerAccountIdSuffix: maskSuffix(account?.providerAccountId),
          userIdSuffix: maskSuffix(user?.id ?? token?.sub ?? null),
        })
      }

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
      if (authDebugEnabled) {
        console.log('[auth][debug][signIn]', {
          ts: new Date().toISOString(),
          provider: account?.provider ?? 'unknown',
          providerAccountIdSuffix: maskSuffix(account?.providerAccountId),
          userIdSuffix: maskSuffix(user?.id ?? null),
        })
      }

      const typedUser = user as Partial<{ twitchId?: string }>
      if (account?.provider === 'twitch' && !typedUser.twitchId) {
        console.error('[auth] Missing twitchId on user during signIn', {
          userId: user?.id,
          providerAccountId: account?.providerAccountId,
        })
      }

      if (account?.provider === 'twitch' && account.access_token) {
        try {
          await updateUserTwitchData(user.id, account.access_token)
        } catch (error) {
          if (isDevelopment) {
            console.error('updateUserTwitchData failed during sign-in:', error)
          }
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


