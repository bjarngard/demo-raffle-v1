import { prisma } from './prisma'
import type { AdminEntry } from '@/types/admin'
import { entryStateExclusion } from './submissions-state'

type EntrySortBy = 'weight' | 'name'
type EntrySortOrder = 'asc' | 'desc'

export async function getAdminEntries({
  search = '',
  sortBy = 'weight',
  sortOrder = 'desc',
}: {
  search?: string
  sortBy?: EntrySortBy
  sortOrder?: EntrySortOrder
} = {}): Promise<AdminEntry[]> {
  const entries = await prisma.entry.findMany({
    where: {
      isWinner: false,
      ...entryStateExclusion,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          totalWeight: true,
          isSubscriber: true,
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

  const formattedEntries: AdminEntry[] = filteredEntries.map((entry) => ({
    id: entry.id,
    name: entry.name || entry.user?.displayName || entry.user?.username || 'Unknown',
    username: entry.user?.username || '',
    displayName: entry.user?.displayName || '',
    demoLink: entry.demoLink || null,
    totalWeight: entry.user?.totalWeight || 1.0,
    weightBreakdown: {
      base: 1.0,
      subMonths: entry.user?.subMonths || 0,
      resubCount: entry.user?.resubCount || 0,
      cheerBits: entry.user?.totalCheerBits || 0,
      donations: entry.user?.totalDonations || 0,
      giftedSubs: entry.user?.totalGiftedSubs || 0,
      carryOver: entry.user?.carryOverWeight || 0,
    },
    createdAt: entry.createdAt.toISOString(),
    userId: entry.userId,
  }))

  if (sortBy === 'weight') {
    formattedEntries.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.totalWeight - a.totalWeight
        : a.totalWeight - b.totalWeight
    })
  }

  return formattedEntries
}

