import 'dotenv/config'
import { prisma } from '../lib/prisma'
import { syncUserFromTwitch } from '../lib/twitch-sync'

const BATCH_SIZE = 100

async function main() {
  let processed = 0
  let cursor: string | null = null

  console.log('[sync-all-users] starting')

  for (;;) {
    const users: Awaited<ReturnType<typeof prisma.user.findMany>> =
      await prisma.user.findMany({
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })

    if (users.length === 0) break

    for (const user of users) {
      try {
        await syncUserFromTwitch(user.id, { force: true, trigger: 'manual' })
        processed += 1
        if (processed % 50 === 0) {
          console.log('[sync-all-users] synced', processed)
        }
      } catch (err) {
        console.error('[sync-all-users] failed for user', user.id, err)
      }
    }

    cursor = users[users.length - 1].id
  }

  console.log('[sync-all-users] done. total users:', processed)
}

main()
  .catch((err) => {
    console.error('[sync-all-users] fatal', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
