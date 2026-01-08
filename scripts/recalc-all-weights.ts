import 'dotenv/config'
import { prisma } from '../lib/prisma'
import {
  calculateUserWeightWithSettings,
  getWeightSettings,
} from '../lib/weight-settings'

const BATCH_SIZE = 200

async function main() {
  const settings = await getWeightSettings()
  let processed = 0
  let cursor: string | null = null

  console.log('[recalc-all-weights] starting')

  // Stream through all users in deterministic order
  // using cursor pagination to avoid skip/limit drift.
  // Keeps memory bounded and can be resumed safely if interrupted.
  for (;;) {
    const users: Awaited<ReturnType<typeof prisma.user.findMany>> =
      await prisma.user.findMany({
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })

    if (users.length === 0) break

    for (const user of users) {
      const totalWeight = calculateUserWeightWithSettings(
        {
          isSubscriber: user.isSubscriber,
          subMonths: user.subMonths,
          resubCount: user.resubCount,
          totalCheerBits: user.totalCheerBits,
          totalDonations: user.totalDonations,
          totalGiftedSubs: user.totalGiftedSubs,
          carryOverWeight: user.carryOverWeight,
        },
        settings
      )

      await prisma.user.update({
        where: { id: user.id },
        data: {
          totalWeight,
          currentWeight: totalWeight - user.carryOverWeight,
          lastUpdated: new Date(),
        },
      })
    }

    processed += users.length
    cursor = users[users.length - 1].id
    console.log('[recalc-all-weights] processed', processed)
  }

  console.log('[recalc-all-weights] done. total users:', processed)
}

main()
  .catch((err) => {
    console.error('[recalc-all-weights] failed', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
