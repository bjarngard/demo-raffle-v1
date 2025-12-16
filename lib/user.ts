import { prisma } from './prisma'
import { calculateUserWeight } from './weight-settings'

type SessionUserLike = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

const DEFAULT_WEIGHT_INPUT = {
  isSubscriber: false,
  subMonths: 0,
  resubCount: 0,
  totalCheerBits: 0,
  totalDonations: 0,
  totalGiftedSubs: 0,
  carryOverWeight: 0,
}

/**
 * Ensures that a Prisma User exists for the authenticated session.
 * Creates a minimal user profile (with accurate default weights) if missing.
 */
export async function ensureUser(sessionUser: SessionUserLike) {
  if (!sessionUser?.id) {
    throw new Error('Missing session user id')
  }

  const existing = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  })

  if (existing) {
    // Legacy safety net: if older rows are missing displayName/username, backfill from session name.
    const updates: Record<string, string> = {}
    if (!existing.displayName && sessionUser.name) {
      updates.displayName = sessionUser.name
    }
    if (!existing.username && sessionUser.name) {
      updates.username = sessionUser.name
    }
    if (Object.keys(updates).length > 0) {
      return prisma.user.update({
        where: { id: existing.id },
        data: updates,
      })
    }
    return existing
  }

  const twitchAccount = await prisma.account.findFirst({
    where: {
      userId: sessionUser.id,
      provider: 'twitch',
    },
    select: {
      providerAccountId: true,
    },
  })

  if (!twitchAccount?.providerAccountId) {
    throw new Error('TWITCH_ACCOUNT_MISSING')
  }

  const baseWeight = await calculateUserWeight(DEFAULT_WEIGHT_INPUT)
  const now = new Date()
  const fallbackName =
    sessionUser.name ||
    sessionUser.email ||
    `viewer-${twitchAccount.providerAccountId}`

  return prisma.user.create({
    data: {
      id: sessionUser.id,
      twitchId: twitchAccount.providerAccountId,
      username: fallbackName,
      displayName: fallbackName,
      email: sessionUser.email,
      image: sessionUser.image ?? undefined,
      currentWeight: baseWeight,
      totalWeight: baseWeight,
      carryOverWeight: 0,
      lastUpdated: now,
      lastActive: now,
    },
  })
}

