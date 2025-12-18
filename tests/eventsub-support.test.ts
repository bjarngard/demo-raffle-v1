import test from 'node:test'
import assert from 'node:assert/strict'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DEFAULT_SETTINGS, calculateUserWeightWithSettings } from '@/lib/weight-settings'
import { processSupportEventWithWeight } from '@/lib/eventsub-support'

if (!process.env.IMMEDIATE_SUPPORT_WEIGHT) {
  process.env.IMMEDIATE_SUPPORT_WEIGHT = '1'
}
if (!process.env.WEIGHT_SYNC_DEBUG) {
  process.env.WEIGHT_SYNC_DEBUG = '1'
}

test('processSupportEventWithWeight increments support and recomputes weight', async () => {
  const originalTx = prisma.$transaction
  const user = {
    id: 'user-1',
    twitchId: '123',
    isSubscriber: false,
    subMonths: 0,
    resubCount: 0,
    totalCheerBits: 0,
    totalDonations: 0,
    totalGiftedSubs: 0,
    carryOverWeight: 0,
    needsResync: false,
  }

  const seenMessages = new Set<string>()
  let weightUpdateData: Record<string, unknown> | null = null

  prisma.$transaction = (async (fn) => {
    const tx = {
      $queryRaw: async () => [{ id: user.id }],
      processedWebhookEvent: {
        create: async ({ data }: { data: { messageId: string } }) => {
          if (seenMessages.has(data.messageId)) {
            const err = new Error('duplicate') as Prisma.PrismaClientKnownRequestError
            ;(err as { code: string }).code = 'P2002'
            throw err
          }
          seenMessages.add(data.messageId)
          return null
        },
      },
      user: {
        update: async ({
          where,
          data,
          select = {},
        }: {
          where: { twitchId?: string; id?: string }
          data:
            | { totalCheerBits: { increment: number }; needsResync: boolean }
            | { totalWeight: number; currentWeight: number; lastUpdated?: Date }
          select?: Record<string, boolean>
        }) => {
          if (where.twitchId && where.twitchId !== user.twitchId) throw new Error('wrong user')
          if (where.id && where.id !== user.id) throw new Error('wrong user')
          if ('totalWeight' in data) {
            weightUpdateData = data
            return user
          }
          user.totalCheerBits += data.totalCheerBits.increment
          user.needsResync = data.needsResync
          const result: Record<string, unknown> = {}
          for (const key of Object.keys(select)) {
            result[key] = (user as Record<string, unknown>)[key]
          }
          return result
        },
      },
      weightSettings: {
        findFirst: async () => ({ ...DEFAULT_SETTINGS }),
      },
    }
    return fn(tx as unknown as Prisma.TransactionClient)
  }) as typeof prisma.$transaction

  try {
    const handled = await processSupportEventWithWeight(
      {
        subscriptionType: 'channel.cheer',
        event: { bits: 200 },
        twitchUserId: user.twitchId,
        messageId: 'm1',
      },
      {
        deps: {
          calculateUserWeight: async (u) => calculateUserWeightWithSettings(u, DEFAULT_SETTINGS),
        },
        debug: true,
      },
    )

    assert.equal(handled, true)
    assert.equal(user.totalCheerBits, 200)
    assert.ok(weightUpdateData)
    assert.equal(weightUpdateData?.totalWeight, 3) // base 1 + cheerWeight 2
    assert.equal(weightUpdateData?.currentWeight, 3)
  } finally {
    prisma.$transaction = originalTx
  }
})

test('processSupportEventWithWeight ignores duplicates (P2002)', async () => {
  const originalTx = prisma.$transaction
  const user = {
    id: 'user-1',
    twitchId: '123',
    isSubscriber: false,
    subMonths: 0,
    resubCount: 0,
    totalCheerBits: 0,
    totalDonations: 0,
    totalGiftedSubs: 0,
    carryOverWeight: 0,
    needsResync: false,
  }

  const seenMessages = new Set<string>(['m2'])
  let weightUpdated = false

  prisma.$transaction = (async (fn) => {
    const tx = {
      $queryRaw: async () => [{ id: user.id }],
      processedWebhookEvent: {
        create: async ({ data }: { data: { messageId: string } }) => {
          if (seenMessages.has(data.messageId)) {
            const err = new Error('duplicate') as Prisma.PrismaClientKnownRequestError
            ;(err as { code: string }).code = 'P2002'
            throw err
          }
          seenMessages.add(data.messageId)
          return null
        },
      },
      user: {
        update: async () => {
          weightUpdated = true
          return user
        },
      },
      weightSettings: {
        findFirst: async () => ({ ...DEFAULT_SETTINGS }),
      },
    }
    return fn(tx as unknown as Prisma.TransactionClient)
  }) as typeof prisma.$transaction

  try {
    const handled = await processSupportEventWithWeight(
      {
        subscriptionType: 'channel.cheer',
        event: { bits: 100 },
        twitchUserId: user.twitchId,
        messageId: 'm2',
      },
      {
        deps: {
          calculateUserWeight: async (u) => calculateUserWeightWithSettings(u, DEFAULT_SETTINGS),
        },
        debug: true,
      },
    )
    assert.equal(handled, false)
    assert.equal(weightUpdated, false)
  } finally {
    prisma.$transaction = originalTx
  }
})

