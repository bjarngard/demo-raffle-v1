import { prisma } from './prisma'
import type { AdminEntry } from '@/types/admin'
import { entryStateExclusion } from './submissions-state'
import { describeWeightBreakdown } from './weight-settings'
import { getCurrentSession, getLatestEndedSession } from './session'
import { getUserDisplayName } from './user-display-name'

type EntrySortBy = 'weight' | 'name'
type EntrySortOrder = 'asc' | 'desc'

export async function getAdminEntries({
  search = '',
  sortBy = 'weight',
  sortOrder = 'desc',
  sessionId,
}: {
  search?: string
  sortBy?: EntrySortBy
  sortOrder?: EntrySortOrder
  sessionId?: string | null
} = {}): Promise<AdminEntry[]> {
  const resolvedSessionId = await resolveAdminSessionId(sessionId)

  if (!resolvedSessionId) {
    return []
  }

  const entries = await prisma.entry.findMany({
    where: {
      isWinner: false,
      ...entryStateExclusion,
      sessionId: resolvedSessionId,
    },
    select: {
      id: true,
      name: true,
      userId: true,
      demoLink: true,
      notes: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          totalWeight: true,
          isSubscriber: true,
          isFollower: true,
          subMonths: true,
          resubCount: true,
          totalCheerBits: true,
          totalDonations: true,
          totalGiftedSubs: true,
          carryOverWeight: true,
        },
      },
    },
    orderBy:
      sortBy === 'name'
        ? { name: sortOrder === 'desc' ? 'desc' : 'asc' }
        : { createdAt: 'desc' },
  })

  const filteredEntries = search
    ? entries.filter((entry) => {
        const searchLower = search.toLowerCase()
        return (
          entry.name.toLowerCase().includes(searchLower) ||
          entry.user?.username?.toLowerCase().includes(searchLower) ||
          entry.user?.displayName?.toLowerCase().includes(searchLower)
        )
      })
    : entries

  const formattedEntries: AdminEntry[] = await Promise.all(
    filteredEntries.map(async (entry) => {
      const user = entry.user
      let canonicalBreakdown = null

      if (user) {
        canonicalBreakdown = await describeWeightBreakdown({
          isSubscriber: user.isSubscriber ?? false,
          subMonths: user.subMonths ?? 0,
          resubCount: user.resubCount ?? 0,
          totalCheerBits: user.totalCheerBits ?? 0,
          totalDonations: user.totalDonations ?? 0,
          totalGiftedSubs: user.totalGiftedSubs ?? 0,
          carryOverWeight: user.carryOverWeight ?? 0,
        })
      }

      const weightSummary = canonicalBreakdown
        ? {
            baseWeight: canonicalBreakdown.baseWeight,
            loyalty: {
              monthsComponent: canonicalBreakdown.loyalty.monthsComponent,
              resubComponent: canonicalBreakdown.loyalty.resubComponent,
              total: canonicalBreakdown.loyalty.cappedTotal,
            },
            support: {
              cheerWeight: canonicalBreakdown.support.cheerWeight,
              donationsWeight: canonicalBreakdown.support.donationsWeight,
              giftedSubsWeight: canonicalBreakdown.support.giftedSubsWeight,
              total: canonicalBreakdown.support.cappedTotal,
            },
            carryOverWeight: canonicalBreakdown.carryOverWeight,
            totalWeight: canonicalBreakdown.totalWeight,
          }
        : {
            baseWeight: 1,
            loyalty: {
              monthsComponent: 0,
              resubComponent: 0,
              total: 0,
            },
            support: {
              cheerWeight: 0,
              donationsWeight: 0,
              giftedSubsWeight: 0,
              total: 0,
            },
            carryOverWeight: user?.carryOverWeight ?? 0,
            totalWeight: user?.totalWeight ?? 1,
          }

      const effectiveName = getUserDisplayName(user)

      return {
        id: entry.id,
        name: entry.name || effectiveName,
        username: user?.username || '',
        displayName: user?.displayName || '',
        demoLink: entry.demoLink || null,
        notes: entry.notes ?? null,
        totalWeight: weightSummary.totalWeight,
        weightBreakdown: {
          ...weightSummary,
          isSubscriber: user?.isSubscriber ?? false,
          isFollower: user?.isFollower ?? false,
          subMonths: user?.subMonths ?? 0,
        },
        createdAt: entry.createdAt.toISOString(),
        userId: entry.userId,
      }
    })
  )

  if (sortBy === 'weight') {
    formattedEntries.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.totalWeight - a.totalWeight
        : a.totalWeight - b.totalWeight
    })
  }

  return formattedEntries
}

async function resolveAdminSessionId(explicitSessionId?: string | null) {
  if (explicitSessionId) {
    return explicitSessionId
  }

  const activeSession = await getCurrentSession()
  if (activeSession) {
    return activeSession.id
  }

  const latestEnded = await getLatestEndedSession()
  return latestEnded?.id ?? null
}

