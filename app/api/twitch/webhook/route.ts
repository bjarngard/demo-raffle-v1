/**
 * Twitch EventSub Webhook Handler
 * Based on official Twitch EventSub documentation:
 * https://dev.twitch.tv/docs/eventsub/handling-webhook-events
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Constants for header names (case-insensitive, Next.js converts to lowercase)
const TWITCH_MESSAGE_ID = 'twitch-eventsub-message-id'
const TWITCH_MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp'
const TWITCH_MESSAGE_SIGNATURE = 'twitch-eventsub-message-signature'
const TWITCH_MESSAGE_TYPE = 'twitch-eventsub-message-type'
const TWITCH_MESSAGE_RETRY = 'twitch-eventsub-message-retry'

// Message types
const MESSAGE_TYPE_VERIFICATION = 'webhook_callback_verification'
const MESSAGE_TYPE_NOTIFICATION = 'notification'
const MESSAGE_TYPE_REVOCATION = 'revocation'

// HMAC prefix
const HMAC_PREFIX = 'sha256='

// Maximum age for events (10 minutes as per Twitch docs)
const MAX_EVENT_AGE_MS = 10 * 60 * 1000

/**
 * Main webhook handler
 * All requests must respond within a few seconds
 */
export async function POST(request: NextRequest) {
  try {
    // Get headers (already lowercase in Next.js)
    const messageId = request.headers.get(TWITCH_MESSAGE_ID)
    const messageTimestamp = request.headers.get(TWITCH_MESSAGE_TIMESTAMP)
    const messageSignature = request.headers.get(TWITCH_MESSAGE_SIGNATURE)
    const messageType = request.headers.get(TWITCH_MESSAGE_TYPE)
    const messageRetry = request.headers.get(TWITCH_MESSAGE_RETRY)

    if (!messageId || !messageTimestamp || !messageSignature || !messageType) {
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      )
    }

    // Get raw body for signature verification
    const body = await request.text()

    // Verify signature BEFORE processing anything
    const { env } = await import('@/lib/env')
    const secret = env.TWITCH_WEBHOOK_SECRET

    if (!verifySignature(secret, messageId, messageTimestamp, body, messageSignature)) {
      console.error('Invalid signature for webhook event')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 403 }
      )
    }

    // Verify timestamp (prevent replay attacks)
    if (!verifyTimestamp(messageTimestamp)) {
      console.error('Event timestamp too old, possible replay attack')
      return NextResponse.json(
        { error: 'Event too old' },
        { status: 400 }
      )
    }

    // Parse JSON body
    let data
    try {
      data = JSON.parse(body)
    } catch (error) {
      console.error('Failed to parse webhook body:', error)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Handle webhook verification challenge
    // This is the first event received after subscribing
    if (messageType === MESSAGE_TYPE_VERIFICATION) {
      const challenge = data.challenge
      if (!challenge) {
        return NextResponse.json(
          { error: 'Missing challenge' },
          { status: 400 }
        )
      }
      
      // Return challenge as text/plain (not JSON) as per Twitch docs
      return new NextResponse(challenge, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    // Handle revocation events
    if (messageType === MESSAGE_TYPE_REVOCATION) {
      console.log(`Subscription revoked: ${data.subscription?.type}`)
      console.log(`Reason: ${data.subscription?.status}`)
      
      // Return 2XX status code (204 No Content recommended)
      return new NextResponse(null, { status: 204 })
    }

    // Handle notification events
    if (messageType === MESSAGE_TYPE_NOTIFICATION) {
      // Mark event as processed in transaction BEFORE processing to prevent race conditions
      try {
        await prisma.$transaction(async (tx) => {
          // Try to create - if fails due to unique constraint, it's a duplicate
          await tx.processedWebhookEvent.create({
            data: {
              messageId,
              eventType: data.subscription?.type || 'unknown',
              twitchUserId: data.event?.user_id || null,
            },
          })
        })
      } catch (error: any) {
        // If unique constraint fails, it's a duplicate
        if (error?.code === 'P2002') {
          console.log(`Duplicate event detected, skipping: ${messageId}`)
          return new NextResponse(null, { status: 204 })
        }
        throw error // Re-throw other errors
      }

      // Process the event
      const event = data.event
      const subscription = data.subscription

      if (!event || !subscription) {
        console.error('Missing event or subscription data')
        return new NextResponse(null, { status: 204 })
      }

      // Process event based on subscription type
      try {
        await processEvent(subscription.type, event)
      } catch (error) {
        console.error(`Error processing event ${subscription.type}:`, error)
        // Still return 2XX - we've already marked it as processed
      }

      // Return 2XX status code quickly (process can continue in background)
      return new NextResponse(null, { status: 204 })
    }

    // Unknown message type
    console.log(`Unknown message type: ${messageType}`)
    return new NextResponse(null, { status: 204 })
  } catch (error: any) {
    console.error('Error processing Twitch webhook:', error)
    // Return 2XX even on error to avoid Twitch marking subscription as failed
    return new NextResponse(null, { status: 204 })
  }
}

/**
 * Verify HMAC signature using timing-safe comparison
 * https://dev.twitch.tv/docs/eventsub/handling-webhook-events#verifying-the-event-message
 */
function verifySignature(
  secret: string,
  messageId: string,
  messageTimestamp: string,
  body: string,
  receivedSignature: string
): boolean {
  try {
    // Build the message: message_id + message_timestamp + body
    const message = messageId + messageTimestamp + body

    // Create HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(message)
    const expectedSignature = HMAC_PREFIX + hmac.digest('hex')

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    )
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

/**
 * Verify timestamp is not older than 10 minutes (prevent replay attacks)
 * Timestamps are in RFC3339 format with nanoseconds
 */
function verifyTimestamp(timestamp: string): boolean {
  try {
    const eventTime = new Date(timestamp).getTime()
    const now = Date.now()
    const age = now - eventTime

    // Event must be less than 10 minutes old
    return age >= 0 && age <= MAX_EVENT_AGE_MS
  } catch (error) {
    console.error('Error verifying timestamp:', error)
    return false
  }
}


/**
 * Process events based on subscription type
 */
async function processEvent(subscriptionType: string, event: any) {
  switch (subscriptionType) {
    case 'channel.subscribe':
      // New subscription (first month)
      // Payload: user_id, tier, is_gift, gifter_id (if gifted)
      await handleSubscription(event)
      break

    case 'channel.subscription.message':
      // Resub - includes cumulative_months
      // Payload: cumulative_months, streak_months, duration_months
      await handleResub(event)
      break

    case 'channel.subscription.gift':
      // Gift subscriptions (single or bulk)
      // Payload: total, tier, cumulative_total
      await handleGiftSub(event)
      break

    case 'channel.cheer':
      // Bits cheered
      // Payload: bits, user_id
      await handleCheer(event)
      break

    case 'channel.follow':
      // New follower
      // Payload: user_id, followed_at
      await handleFollow(event)
      break

    default:
      console.log('Unhandled subscription type:', subscriptionType)
  }
}

/**
 * Handle channel.subscribe event
 */
async function handleSubscription(event: any) {
  const twitchUserId = event.user_id
  const isGift = event.is_gift || false
  const tier = event.tier || '1000'

  if (!twitchUserId) {
    console.error('Missing user_id in subscription event')
    return
  }

  const user = await prisma.user.findUnique({
    where: { twitchId: twitchUserId },
  })

  if (user) {
    // For new subs, set to 1 month initially
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isSubscriber: true,
        subMonths: 1,
        totalSubs: 1,
        lastUpdated: new Date(),
      },
    })

    await recalculateUserWeight(user.id)
  }
}

/**
 * Handle channel.subscription.message event (resub)
 */
async function handleResub(event: any) {
  const twitchUserId = event.user_id
  const cumulativeMonths = event.cumulative_months || 0
  const streakMonths = event.streak_months || 0

  if (!twitchUserId) {
    console.error('Missing user_id in resub event')
    return
  }

  const user = await prisma.user.findUnique({
    where: { twitchId: twitchUserId },
  })

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resubCount: { increment: 1 },
        subMonths: cumulativeMonths,
        totalSubs: cumulativeMonths,
        lastUpdated: new Date(),
      },
    })

    await recalculateUserWeight(user.id)
  }
}

/**
 * Handle channel.cheer event
 */
async function handleCheer(event: any) {
  const twitchUserId = event.user_id
  const bits = event.bits || 0

  if (!twitchUserId) {
    console.error('Missing user_id in cheer event')
    return
  }

  if (bits <= 0) {
    return // No bits cheered
  }

  const user = await prisma.user.findUnique({
    where: { twitchId: twitchUserId },
  })

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalCheerBits: { increment: bits },
        lastUpdated: new Date(),
      },
    })

    await recalculateUserWeight(user.id)
  }
}

/**
 * Handle channel.subscription.gift event
 */
async function handleGiftSub(event: any) {
  // channel.subscription.gift event - gifted subscriptions
  // Payload: total (gifted in this event), tier, cumulative_total (if not anonymous)
  const gifterId = event.user_id
  const total = event.total || 1
  const tier = event.tier || '1000'
  const cumulativeTotal = event.cumulative_total || null // May be null if anonymous

  if (!gifterId) {
    console.error('Missing user_id in gift sub event')
    return
  }

  const user = await prisma.user.findUnique({
    where: { twitchId: gifterId },
  })

  if (user) {
    // Update total gifted subs count
    // If cumulative_total is available (not anonymous), use that; otherwise increment by total
    const newTotalGiftedSubs = cumulativeTotal !== null 
      ? cumulativeTotal 
      : user.totalGiftedSubs + total

    await prisma.user.update({
      where: { id: user.id },
      data: {
        totalGiftedSubs: newTotalGiftedSubs,
        lastUpdated: new Date(),
      },
    })

    // Gift giver gets bonus weight for gifting subs
    // The recipients will get their own sub events
    await recalculateUserWeight(user.id)
  }
}

/**
 * Handle channel.follow event
 */
async function handleFollow(event: any) {
  // channel.follow event - new follower
  // Payload: user_id, followed_at
  const twitchUserId = event.user_id
  const followedAt = event.followed_at

  if (!twitchUserId) {
    console.error('Missing user_id in follow event')
    return
  }

  const user = await prisma.user.findUnique({
    where: { twitchId: twitchUserId },
  })

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isFollower: true,
        lastUpdated: new Date(),
      },
    })

    // Give small weight bonus for new follow
    await recalculateUserWeight(user.id)
  }
}

/**
 * Recalculate user weight based on all factors
 */
async function recalculateUserWeight(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) return

    const { calculateUserWeight } = await import('@/lib/weight-settings')
    
    const weight = await calculateUserWeight({
      isSubscriber: user.isSubscriber,
      subMonths: user.subMonths,
      resubCount: user.resubCount,
      totalCheerBits: user.totalCheerBits,
      totalDonations: user.totalDonations,
      totalGiftedSubs: user.totalGiftedSubs,
      carryOverWeight: user.carryOverWeight,
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentWeight: weight - user.carryOverWeight,
        totalWeight: weight,
      },
    })
  } catch (error) {
    console.error('Error recalculating user weight:', error)
  }
}
