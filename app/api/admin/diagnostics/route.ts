import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { maskSuffix } from '@/lib/mask'

export async function GET() {
  const session = await requireAdminSession()
  if (!session?.user?.isBroadcaster) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authInfo = {
    userIdSuffix: maskSuffix(session.user?.id ?? null),
    twitchIdSuffix: maskSuffix(session.user?.twitchId ?? null),
    isBroadcaster: Boolean(session.user?.isBroadcaster),
    sessionHasTwitchId: Boolean(session.user?.twitchId),
    sessionHasUserId: Boolean(session.user?.id),
  }

  const envInfo = {
    storeTwitchEmailEnabled: process.env.STORE_TWITCH_EMAIL === '1',
    weightSyncDebugEnabled: process.env.WEIGHT_SYNC_DEBUG === '1',
  }

  let broadcasterTokenInfo: {
    ok: boolean
    reason?: string
    expiresAtUnix?: number | null
    hasRefreshToken?: boolean
    accountRowFound?: boolean
    pathUsed?: 'byUserTwitchId' | 'byProviderAccountIdFallback' | 'notFound'
  } = { ok: false, reason: 'unknown' }

  try {
    const accountByUser = await prisma.account.findFirst({
      where: {
        provider: 'twitch',
        user: {
          twitchId: env.TWITCH_BROADCASTER_ID,
        },
      },
      select: {
        access_token: true,
        refresh_token: true,
        expires_at: true,
        providerAccountId: true,
        user: { select: { id: true, twitchId: true } },
      },
    })

    const accountByProvider =
      accountByUser ??
      (await prisma.account.findFirst({
        where: {
          provider: 'twitch',
          providerAccountId: env.TWITCH_BROADCASTER_ID,
        },
        select: {
          access_token: true,
          refresh_token: true,
          expires_at: true,
          providerAccountId: true,
          user: { select: { id: true, twitchId: true } },
        },
      }))

    const pathUsed = accountByUser
      ? 'byUserTwitchId'
      : accountByProvider
        ? 'byProviderAccountIdFallback'
        : 'notFound'
    const account = accountByUser ?? (accountByProvider === accountByUser ? null : accountByProvider)

    broadcasterTokenInfo = {
      ok: Boolean(account?.access_token),
      reason: account ? undefined : 'no_account',
      expiresAtUnix: account?.expires_at ?? null,
      hasRefreshToken: Boolean(account?.refresh_token),
      accountRowFound: Boolean(account),
      pathUsed,
    }
  } catch (error) {
    broadcasterTokenInfo = {
      ok: false,
      reason: error instanceof Error ? error.message : 'unknown_error',
    }
  }

  return NextResponse.json({
    auth: authInfo,
    broadcasterToken: broadcasterTokenInfo,
    env: envInfo,
  })
}

