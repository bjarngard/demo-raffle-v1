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
  // Current behavior: apply carry-over only to non-winners using carryOverMultiplier and cap.
  // carryOverWeight is stored and later used directly in weight calculations; no extra multiplier there.

  const users = await prisma.user.findMany({
    where: { id: { in: participantIds } },
  })

  const userById = new Map(users.map((user) => [user.id, user]))

  const updatedUsers = await Promise.all(
    participantIds.map(async (userId) => {
      const user = userById.get(userId)
      if (!user) return null

      let newCarry = 0

      if (resetWeights || userId === winnerId) {
        // Either we're doing a hard reset, or this is the winner → no carry-over.
        newCarry = 0
      } else {
        // Normal carry-over behaviour for non-winners.
        const sessionWeight = Math.max(0, user.totalWeight - user.carryOverWeight) // weight earned this session only
        const carryFromSession = sessionWeight * settings.carryOverMultiplier
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

      await prisma.user.update({
        where: { id: user.id },
        data: {
          carryOverWeight: newCarry,
          totalWeight,
          currentWeight: totalWeight - newCarry,
          lastUpdated: new Date(),
        },
      })

      return {
        id: user.id,
        username: user.username,
        carryOverWeight: newCarry,
      }
    })
  )

  const filtered = updatedUsers.filter(
    (u): u is CarryOverResultUser => u !== null
  )

  return {
    updatedCount: filtered.length,
    users: filtered,
  }
}

