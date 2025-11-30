import { prisma } from './prisma'
import { entryStateExclusion } from './submissions-state'

const BATCH_SIZE = 25

export async function applyCarryOverForSession(sessionId: string, resetWeights = false) {
  if (!sessionId) {
    return { updatedCount: 0 }
  }

  const nonWinners = await prisma.user.findMany({
    where: {
      entries: {
        some: {
          sessionId,
          isWinner: false,
          ...entryStateExclusion,
        },
      },
    },
  })

  const updated: Array<{ id: string; username: string; carryOverWeight: number }> = []

  for (let i = 0; i < nonWinners.length; i += BATCH_SIZE) {
    const batch = nonWinners.slice(i, i + BATCH_SIZE)
    const updates = batch.map((user) => ({
      id: user.id,
      username: user.username,
      carryOver: resetWeights ? 0 : user.totalWeight * 0.5,
    }))

    await prisma.$transaction(
      updates.map((update) =>
        prisma.user.update({
          where: { id: update.id },
          data: {
            carryOverWeight: update.carryOver,
            currentWeight: 1.0,
            totalWeight: 1.0 + update.carryOver,
            lastUpdated: new Date(),
          },
        })
      )
    )

    updated.push(
      ...updates.map((update) => ({
        id: update.id,
        username: update.username,
        carryOverWeight: update.carryOver,
      }))
    )
  }

  const winner = await prisma.entry.findFirst({
    where: {
      sessionId,
      isWinner: true,
      ...entryStateExclusion,
    },
    include: { user: true },
  })

  if (winner?.user) {
    await prisma.user.update({
      where: { id: winner.user.id },
      data: {
        carryOverWeight: 0,
      },
    })
  }

  return {
    updatedCount: updated.length,
    users: updated,
  }
}

