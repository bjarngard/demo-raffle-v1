import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { maskSuffix } from '@/lib/mask'
import { calculateUserWeight } from '@/lib/weight-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE_ID_HEADER = 'twitch-eventsub-message-id'
const MESSAGE_TIMESTAMP_HEADER = 'twitch-eventsub-message-timestamp'
const MESSAGE_SIGNATURE_HEADER = 'twitch-eventsub-message-signature'
const MESSAGE_TYPE_HEADER = 'twitch-eventsub-message-type'

const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification'
const MESSAGE_TYPE_NOTIFICATION = 'notification'
const MESSAGE_TYPE_REVOCATION = 'revocation'

const HMAC_PREFIX = 'sha256='
const MAX_EVENT_AGE_MS = 10 * 60 * 1000
const ALLOWED_EVENT_TYPES = new Set([
  'channel.follow',
  'channel.subscribe',
  'channel.subscription.gift',
  'channel.subscription.message',
  'channel.cheer',
])

type EventSubPayload = {
  challenge?: string
  subscription?: {
    type?: string
  }
  event?: Record<string, unknown> | null
}

const BROADCASTER_ID = env.TWITCH_BROADCASTER_ID
// Allow enabling EventSub resync debug even in production; logs are suffix-masked.
const eventSubDebugEnabled = process.env.WEIGHT_SYNC_DEBUG === '1'
const immediateSupportWeightEnabled = process.env.IMMEDIATE_SUPPORT_WEIGHT === '1'


/**
 * Verify Twitch EventSub payloads, dedupe them, and mark affected users as
 * needing a backend sync. All canonical data still comes from Helix.
 */
export async function POST(request: NextRequest) {
  const messageId = request.headers.get(MESSAGE_ID_HEADER)
  const messageTimestamp = request.headers.get(MESSAGE_TIMESTAMP_HEADER)
  const messageSignature = request.headers.get(MESSAGE_SIGNATURE_HEADER)
  const messageType = request.headers.get(MESSAGE_TYPE_HEADER) ?? ''

  if (!messageId || !messageTimestamp || !messageSignature) {
    return NextResponse.json({ error: 'missing_headers' }, { status: 400 })
  }

  const rawBody = await request.text()

  if (!verifySignature(env.TWITCH_WEBHOOK_SECRET, messageId, messageTimestamp, rawBody, messageSignature)) {
    console.error('Invalid EventSub signature', { messageId })
    return NextResponse.json({ error: 'invalid_signature' }, { status: 403 })
  }

  if (!verifyTimestamp(messageTimestamp)) {
    console.error('EventSub message too old', { messageId })
    return NextResponse.json({ error: 'event_too_old' }, { status: 400 })
  }

  let payload: EventSubPayload | null = null
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as EventSubPayload
    } catch (error) {
      console.error('Failed to parse EventSub payload:', error)
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }
  }

  if (messageType === MESSAGE_TYPE_VERIFICATION) {
    const challenge = payload?.challenge
    if (!challenge) {
      return NextResponse.json({ error: 'missing_challenge' }, { status: 400 })
    }
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  if (messageType === MESSAGE_TYPE_REVOCATION) {
    console.warn('Twitch EventSub subscription revoked:', payload?.subscription?.type)
    return new NextResponse(null, { status: 204 })
  }

  if (messageType === MESSAGE_TYPE_NOTIFICATION) {
    const subscriptionType = payload?.subscription?.type
    if (!subscriptionType || !ALLOWED_EVENT_TYPES.has(subscriptionType)) {
      console.warn('[eventsub] ignoring unsupported subscription type', subscriptionType)
      return new NextResponse(null, { status: 204 })
    }

    const event = payload?.event ?? {}
    const twitchUserId = extractTwitchUserId(event)

    if (!twitchUserId) {
      console.warn('[eventsub] missing twitchUserId for type', subscriptionType, 'payload keys=', Object.keys(event))
      return new NextResponse(null, { status: 204 })
    }

    if (twitchUserId === BROADCASTER_ID) {
      return new NextResponse(null, { status: 204 })
    }

    const isSupportEvent =
      subscriptionType === 'channel.cheer' || subscriptionType === 'channel.subscription.gift'

    // NOTE: Do not expand this “instant weight” block to other events (e.g. subscribe/follow)
    // without a separate decision. Keep this isolated to support-only signals to avoid a
    // Franken-route that mixes too many side effects.
    if (immediateSupportWeightEnabled && isSupportEvent) {
      const handled = await processSupportEventWithWeight({
        subscriptionType,
        event,
        twitchUserId,
        messageId,
      })
      if (handled) {
        return new NextResponse(null, { status: 204 })
      }
      // fall through to default path on failure
    }

    try {
      await prisma.processedWebhookEvent.create({
        data: {
          messageId,
          eventType: subscriptionType,
          twitchUserId,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        console.log('[eventsub] duplicate message ignored', {
          messageId,
          subscriptionType,
          twitchUserId,
        })
        return new NextResponse(null, { status: 204 })
      }
      console.error('Error recording processed EventSub message', {
        messageId,
        subscriptionType,
        twitchUserId,
        error,
      })
      return new NextResponse(null, { status: 204 })
    }

    try {
      await handleAggregation(subscriptionType, event, twitchUserId)
    } catch (error) {
      console.error('[eventsub] aggregation_error', {
        subscriptionType,
        twitchUserId,
        error,
      })
    }

    try {
      const result = await prisma.user.updateMany({
        where: { twitchId: twitchUserId },
        data: { needsResync: true },
      })

      if (eventSubDebugEnabled) {
        console.log('[eventsub][resync]', {
          type: subscriptionType,
          userId: maskSuffix(twitchUserId),
          matched: result.count,
        })
      }

      if (result.count === 0) {
        console.warn(
          '[eventsub] no matching user to mark for type',
          subscriptionType,
          'user=',
          twitchUserId
        )
      }
    } catch (error) {
      console.error('Failed to mark user for resync from EventSub', {
        twitchUserId,
        subscriptionType,
        error,
      })
    }

    return new NextResponse(null, { status: 204 })
  }

  return new NextResponse(null, { status: 204 })
}

function extractTwitchUserId(event: Record<string, unknown> | null | undefined): string | null {
  if (!event) {
    return null
  }

  const candidateKeys = [
    'user_id',
    'userId',
    'gifter_user_id',
    'gifter_id',
    'from_broadcaster_user_id',
    'to_broadcaster_user_id',
    'viewer_id',
  ]

  for (const key of candidateKeys) {
    const value = event[key]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return null
}

type CheerEventPayload = {
  user_id?: string | null
  bits?: number
  is_anonymous?: boolean
}

type SubscriptionGiftEventPayload = {
  user_id?: string | null
  total?: number
  is_anonymous?: boolean
}

async function handleAggregation(
  subscriptionType: string,
  event: Record<string, unknown>,
  twitchUserId: string
) {
  if (subscriptionType === 'channel.cheer') {
    await aggregateCheer(event as CheerEventPayload, twitchUserId)
  } else if (subscriptionType === 'channel.subscription.gift') {
    await aggregateGift(event as SubscriptionGiftEventPayload, twitchUserId)
  }
}

async function aggregateCheer(event: CheerEventPayload, twitchUserId: string) {
  if (event.is_anonymous) {
    return
  }
  const bits =
    typeof event.bits === 'number' && Number.isFinite(event.bits) ? Math.max(0, Math.floor(event.bits)) : 0
  if (bits <= 0) {
    return
  }

  const result = await prisma.user.updateMany({
    where: { twitchId: twitchUserId },
    data: {
      totalCheerBits: {
        increment: bits,
      },
    },
  })

  if (result.count === 0) {
    console.warn('[eventsub] aggregation_user_missing', {
      twitchUserId,
      subscriptionType: 'channel.cheer',
      context: 'cheer',
    })
    return
  }

  console.log('[eventsub] cheer_aggregated', {
    twitchUserId,
    bits,
  })
}

async function aggregateGift(event: SubscriptionGiftEventPayload, twitchUserId: string) {
  if (event.is_anonymous) {
    return
  }
  const total =
    typeof event.total === 'number' && Number.isFinite(event.total) ? Math.max(0, Math.floor(event.total)) : null
  const giftCount = total ?? 1
  if (!total || total <= 0) {
    console.warn('[eventsub] gift_total_invalid', {
      twitchUserId,
      provided: event.total,
    })
  }

  const result = await prisma.user.updateMany({
    where: { twitchId: twitchUserId },
    data: {
      totalGiftedSubs: {
        increment: giftCount,
      },
    },
  })

  if (result.count === 0) {
    console.warn('[eventsub] aggregation_user_missing', {
      twitchUserId,
      subscriptionType: 'channel.subscription.gift',
      context: 'gift',
    })
    return
  }

  console.log('[eventsub] gift_aggregated', {
    twitchUserId,
    giftCount,
  })
}

async function processSupportEventWithWeight(params: {
  subscriptionType: string
  event: Record<string, unknown>
  twitchUserId: string
  messageId: string
}) {
  const { subscriptionType, event, twitchUserId, messageId } = params

  if (subscriptionType === 'channel.cheer') {
    const bitsPayload = event as CheerEventPayload
    if (bitsPayload.is_anonymous) return false
  }
  if (subscriptionType === 'channel.subscription.gift') {
    const giftPayload = event as SubscriptionGiftEventPayload
    if (giftPayload.is_anonymous) return false
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Serialize concurrent updates per user to keep weights consistent when multiple support events land.
      const lockedUser = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM "User" WHERE "twitchId" = ${twitchUserId} FOR UPDATE`
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
      const totalWeight = await calculateUserWeight({
        isSubscriber: userUpdate.isSubscriber,
        subMonths: userUpdate.subMonths,
        resubCount: userUpdate.resubCount,
        totalCheerBits: userUpdate.totalCheerBits,
        totalDonations: userUpdate.totalDonations,
        totalGiftedSubs: userUpdate.totalGiftedSubs,
        carryOverWeight: userUpdate.carryOverWeight,
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
    if (eventSubDebugEnabled) {
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
    const bitsPayload = event as CheerEventPayload
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
      },
    })
  }

  if (subscriptionType === 'channel.subscription.gift') {
    const giftPayload = event as SubscriptionGiftEventPayload
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
      },
    })
  }

  return null
}

function verifySignature(
  secret: string,
  messageId: string,
  messageTimestamp: string,
  body: string,
  receivedSignature: string
): boolean {
  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(messageId + messageTimestamp + body)
    const expectedSignature = HMAC_PREFIX + hmac.digest('hex')
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature))
  } catch (error) {
    console.error('Error verifying EventSub signature:', error)
    return false
  }
}

function verifyTimestamp(timestamp: string): boolean {
  try {
    const eventTime = new Date(timestamp).getTime()
    if (Number.isNaN(eventTime)) return false
    const age = Date.now() - eventTime
    return age >= 0 && age <= MAX_EVENT_AGE_MS
  } catch (error) {
    console.error('Error verifying EventSub timestamp:', error)
    return false
  }
}

