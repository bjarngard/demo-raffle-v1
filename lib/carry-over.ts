import { prisma } from './prisma'
import { entryStateExclusion } from './submissions-state'
import { calculateUserWeight, getWeightSettings } from './weight-settings'

type CarryOverResultUser = {
  id: string
  username: string
  carryOverWeight: number
}

type CarryOverResult = {
  updatedCount: number
  users: CarryOverResultUser[]
}

export async function applyCarryOverForSession(
  sessionId: string,
  resetWeights = false
): Promise<CarryOverResult> {
  if (!sessionId) {
    return { updatedCount: 0, users: [] }
  }

  const session = await prisma.raffleSession.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return { updatedCount: 0, users: [] }
  }

  // Load ALL entries for this raffle session (excluding sentinel/system entries),
  // not just winners, so we can apply carry-over correctly for all participants.
  const entries = await prisma.entry.findMany({
    where: {
      sessionId,
      ...entryStateExclusion,
    },
    select: {
      userId: true,
      isWinner: true,
    },
  })

  const participantIds = Array.from(
    new Set(
      entries
        .map((entry) => entry.userId)
        .filter((id): id is string => Boolean(id))
    )
  )

  if (participantIds.length === 0) {
    return { updatedCount: 0, users: [] }
  }

  const winnerId =
    entries.find((entry) => entry.isWinner && entry.userId)?.userId ?? null

  const settings = await getWeightSettings()

  const updatedUsers = await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { id: { in: participantIds } },
    })

    const userById = new Map(users.map((user) => [user.id, user]))
    const updates: CarryOverResultUser[] = []

    for (const userId of participantIds) {
      const user = userById.get(userId)
      if (!user) continue

      let newCarry = 0

      if (resetWeights || userId === winnerId) {
        // Either we're doing a hard reset, or this is the winner → no carry-over.
        newCarry = 0
      } else {
        // Normal carry-over behaviour for non-winners.
        const carryFromSession = user.totalWeight * settings.carryOverMultiplier
        const newCarryRaw = user.carryOverWeight + carryFromSession
        newCarry = Math.min(newCarryRaw, settings.carryOverMaxBonus)
      }

      const totalWeight = await calculateUserWeight({
        isSubscriber: user.isSubscriber,
        subMonths: user.subMonths,
        resubCount: user.resubCount,
        totalCheerBits: user.totalCheerBits,
        totalDonations: user.totalDonations,
        totalGiftedSubs: user.totalGiftedSubs,
        carryOverWeight: newCarry,
      })

      await tx.user.update({
        where: { id: user.id },
        data: {
          carryOverWeight: newCarry,
          totalWeight,
          currentWeight: totalWeight - newCarry,
          lastUpdated: new Date(),
        },
      })

      updates.push({
        id: user.id,
        username: user.username,
        carryOverWeight: newCarry,
      })
    }

    return updates
  })

  return {
    updatedCount: updatedUsers.length,
    users: updatedUsers,
  }
}

