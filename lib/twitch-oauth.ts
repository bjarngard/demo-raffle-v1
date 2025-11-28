import { env } from './env'
import { prisma } from './prisma'

const TOKEN_REFRESH_BUFFER_SECONDS = 60

type TwitchTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string[]
  token_type: string
}

async function requestTwitchToken(body: Record<string, string>): Promise<TwitchTokenResponse> {
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      client_secret: env.TWITCH_CLIENT_SECRET,
      ...body,
    }),
  })

  const data = (await response.json()) as TwitchTokenResponse & { message?: string }

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to fetch Twitch token')
  }

  if (!data.access_token || !data.expires_in) {
    throw new Error('Invalid token response from Twitch')
  }

  return data
}

export async function refreshTwitchAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresIn: number
}> {
  const data = await requestTwitchToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

export async function getBroadcasterAccessToken(): Promise<string> {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: 'twitch',
        providerAccountId: env.TWITCH_BROADCASTER_ID,
      },
    },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  })

  if (!account || !account.refresh_token) {
    throw new Error('Broadcaster Twitch account is not connected. Please sign in as the broadcaster.')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = account.expires_at ?? 0
  const shouldRefresh = !account.access_token || expiresAt - TOKEN_REFRESH_BUFFER_SECONDS <= nowSeconds

  if (!shouldRefresh) {
    return account.access_token as string
  }

  const refreshed = await refreshTwitchAccessToken(account.refresh_token)
  const newExpiresAt = nowSeconds + refreshed.expiresIn

  await prisma.account.update({
    where: {
      provider_providerAccountId: {
        provider: 'twitch',
        providerAccountId: env.TWITCH_BROADCASTER_ID,
      },
    },
    data: {
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken ?? account.refresh_token,
      expires_at: newExpiresAt,
    },
  })

  return refreshed.accessToken
}

