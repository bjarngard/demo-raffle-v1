import { prisma } from './prisma'
import { entryStateExclusion } from './submissions-state'
import { describeWeightBreakdown } from './weight-settings'
import { getUserDisplayName } from './user-display-name'

type LeaderboardEntry = {
  id: number
  name: string
  weight: number
  probability: number
}

type LeaderboardResult = {
  totalEntries: number
  entries: LeaderboardEntry[]
}

export async function getLeaderboardEntries(sessionId: string): Promise<LeaderboardResult> {
  const entries = await prisma.entry.findMany({
    where: {
      sessionId,
      isWinner: false,
      ...entryStateExclusion,
    },
    include: {
      user: {
        select: {
          username: true,
          displayName: true,
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
  })

  const entriesWithWeights = await Promise.all(
    entries.map(async (entry) => {
      const user = entry.user
      if (!user) {
        return {
          id: entry.id,
          name: entry.name || 'Unknown',
          weight: 1,
        }
      }

      const breakdown = await describeWeightBreakdown({
        isSubscriber: user.isSubscriber ?? false,
        subMonths: user.subMonths ?? 0,
        resubCount: user.resubCount ?? 0,
        totalCheerBits: user.totalCheerBits ?? 0,
        totalDonations: user.totalDonations ?? 0,
        totalGiftedSubs: user.totalGiftedSubs ?? 0,
        carryOverWeight: user.carryOverWeight ?? 0,
      })

      return {
        id: entry.id,
        name: entry.name || getUserDisplayName(user),
        weight: breakdown.totalWeight,
      }
    })
  )

  const totalWeight = entriesWithWeights.reduce((sum, entry) => sum + entry.weight, 0)
  const mappedEntries = entriesWithWeights
    .map((entry) => ({
      ...entry,
      probability: totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20)

  return {
    totalEntries: entries.length,
    entries: mappedEntries,
  }
}

