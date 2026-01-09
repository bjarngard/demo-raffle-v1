import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { maskSuffix } from './mask'
import { calculateUserWeight } from './weight-settings'

type SupportDeps = {
  calculateUserWeight: typeof calculateUserWeight
}

const defaultDeps: SupportDeps = {
  calculateUserWeight,
}

type ProcessParams = {
  subscriptionType: string
  event: Record<string, unknown>
  twitchUserId: string
  messageId: string
}

type ProcessOptions = {
  deps?: SupportDeps
  debug?: boolean
}

export async function processSupportEventWithWeight(
  params: ProcessParams,
  options: ProcessOptions = {},
): Promise<boolean> {
  const { subscriptionType, event, twitchUserId, messageId } = params
  const deps = options.deps ?? defaultDeps
  const debug = options.debug ?? false

  if (subscriptionType === 'channel.cheer') {
    const bitsPayload = event as { is_anonymous?: boolean }
    if (bitsPayload.is_anonymous) return false
  }
  if (subscriptionType === 'channel.subscription.gift') {
    const giftPayload = event as { is_anonymous?: boolean }
    if (giftPayload.is_anonymous) return false
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Serialize concurrent updates per user to keep weights consistent when multiple support events land.
      const lockedUser = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "User" WHERE "twitchId" = ${twitchUserId} FOR UPDATE
      `
      if (!lockedUser || lockedUser.length === 0) {
        return
      }

      // a) dedupe insert
      await tx.processedWebhookEvent.create({
        data: {
          messageId,
          eventType: subscriptionType,
          twitchUserId,
        },
      })

      // b) increment support + needsResync, fetch updated user
      const userUpdate = await incrementSupportAndReturnUser({
        tx,
        subscriptionType,
        event,
        twitchUserId,
      })

      if (!userUpdate) {
        return
      }

      // c) fetch weight settings inside the transaction
      const settings = await tx.weightSettings.findFirst()
      if (!settings) {
        return
      }

      // d) recompute weight
      const totalWeight = await deps.calculateUserWeight({
        isSubscriber: userUpdate.isSubscriber,
        subMonths: userUpdate.subMonths,
        resubCount: userUpdate.resubCount,
        totalCheerBits: userUpdate.totalCheerBits,
        totalDonations: userUpdate.totalDonations,
        totalGiftedSubs: userUpdate.totalGiftedSubs,
        carryOverWeight: userUpdate.carryOverWeight,
        sessionBonus: userUpdate.sessionBonus ?? 0,
      })
      const currentWeight = totalWeight - userUpdate.carryOverWeight

      // e) update weights in same transaction
      await tx.user.update({
        where: { id: userUpdate.id },
        data: {
          totalWeight,
          currentWeight,
          lastUpdated: new Date(),
        },
      })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.log('[eventsub] duplicate message ignored', {
        messageId,
        subscriptionType,
        twitchUserId,
      })
      return false
    }
    if (debug) {
      console.error('[eventsub][support_weight_error]', {
        type: subscriptionType,
        userId: maskSuffix(twitchUserId),
        error: error instanceof Error ? error.message : 'unknown',
      })
    }
    return false
  }
  return true
}

async function incrementSupportAndReturnUser(params: {
  tx: Prisma.TransactionClient
  subscriptionType: string
  event: Record<string, unknown>
  twitchUserId: string
}) {
  const { tx, subscriptionType, event, twitchUserId } = params

  if (subscriptionType === 'channel.cheer') {
    const bitsPayload = event as { bits?: number }
    const bits =
      typeof bitsPayload.bits === 'number' && Number.isFinite(bitsPayload.bits)
        ? Math.max(0, Math.floor(bitsPayload.bits))
        : 0
    if (bits <= 0) return null

    return tx.user.update({
      where: { twitchId: twitchUserId },
      data: {
        totalCheerBits: { increment: bits },
        needsResync: true,
      },
      select: {
        id: true,
        twitchId: true,
        isSubscriber: true,
        subMonths: true,
        resubCount: true,
        totalCheerBits: true,
        totalDonations: true,
        totalGiftedSubs: true,
        carryOverWeight: true,
        sessionBonus: true,
      },
    })
  }

  if (subscriptionType === 'channel.subscription.gift') {
    const giftPayload = event as { total?: number }
    const total =
      typeof giftPayload.total === 'number' && Number.isFinite(giftPayload.total)
        ? Math.max(0, Math.floor(giftPayload.total))
        : null
    const giftCount = total ?? 1
    if (!total || total <= 0) {
      console.warn('[eventsub] gift_total_invalid', {
        twitchUserId,
        subscriptionType: 'channel.subscription.gift',
        provided: giftPayload.total,
      })
    }

    return tx.user.update({
      where: { twitchId: twitchUserId },
      data: {
        totalGiftedSubs: { increment: giftCount },
        needsResync: true,
      },
      select: {
        id: true,
        twitchId: true,
        isSubscriber: true,
        subMonths: true,
        resubCount: true,
        totalCheerBits: true,
        totalDonations: true,
        totalGiftedSubs: true,
        carryOverWeight: true,
        sessionBonus: true,
      },
    })
  }

  return null
}

