import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { maskSuffix } from '@/lib/mask'

async function main() {
  console.log('=== DB CONSISTENCY CHECK (read-only) ===')

  const accounts = await prisma.account.findMany({
    select: { id: true, provider: true, providerAccountId: true, userId: true },
  })
  const userIds = new Set(
    (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id),
  )
  const orphanAccounts = accounts.filter((a) => !userIds.has(a.userId))

  const usersMissingTwitchId = (
    await prisma.user.findMany({ select: { id: true, email: true, twitchId: true } })
  ).filter((u) => !u.twitchId)

  const duplicateTwitchIds = await prisma.user.groupBy({
    by: ['twitchId'],
    _count: { twitchId: true },
    having: {
      twitchId: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  const duplicateTwitchIdsFiltered = duplicateTwitchIds.filter((d) => d.twitchId)

  const duplicateAccounts = await prisma.account.groupBy({
    by: ['provider', 'providerAccountId'],
    _count: { providerAccountId: true },
    having: {
      providerAccountId: {
        _count: {
          gt: 1,
        },
      },
    },
  })

  const broadcasterAccount = await prisma.account.findFirst({
    where: {
      provider: 'twitch',
      OR: [
        { user: { twitchId: env.TWITCH_BROADCASTER_ID } },
        { providerAccountId: env.TWITCH_BROADCASTER_ID },
      ],
    },
    select: {
      id: true,
      providerAccountId: true,
      refresh_token: true,
      expires_at: true,
      user: { select: { id: true, twitchId: true } },
    },
  })

  console.log('\nOrphan Accounts (Account without User):', orphanAccounts.length)
  orphanAccounts.forEach((a) =>
    console.log({
      id: a.id,
      provider: a.provider,
      providerAccountId: maskSuffix(a.providerAccountId),
      userId: maskSuffix(a.userId),
    }),
  )

  console.log('\nUsers missing twitchId:', usersMissingTwitchId.length)
  usersMissingTwitchId.forEach((u) =>
    console.log({
      id: maskSuffix(u.id),
      emailPresent: Boolean(u.email),
    }),
  )

  console.log('\nDuplicate twitchId (should be empty):', duplicateTwitchIdsFiltered.length)
  duplicateTwitchIdsFiltered.forEach((d) =>
    console.log({
      twitchId: maskSuffix(d.twitchId),
      count: d._count.twitchId,
    }),
  )

  console.log('\nDuplicate (provider, providerAccountId) (should be empty):', duplicateAccounts.length)
  duplicateAccounts.forEach((d) =>
    console.log({
      provider: d.provider,
      providerAccountId: maskSuffix(d.providerAccountId),
      count: d._count.providerAccountId,
    }),
  )

  console.log('\nBroadcaster account health:')
  if (!broadcasterAccount) {
    console.log('  Not found')
  } else {
    console.log({
      accountId: maskSuffix(broadcasterAccount.id),
      providerAccountId: maskSuffix(broadcasterAccount.providerAccountId),
      userId: maskSuffix(broadcasterAccount.user?.id),
      userTwitchId: maskSuffix(broadcasterAccount.user?.twitchId),
      hasRefreshToken: Boolean(broadcasterAccount.refresh_token),
      expiresAt: broadcasterAccount.expires_at ?? null,
    })
  }

  console.log('\n=== CHECK COMPLETE ===')
}

main()
  .catch((error) => {
    console.error('db-consistency-check failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

