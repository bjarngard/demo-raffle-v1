import type { User } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { describeWeightBreakdown, getWeightSettings } from '@/lib/weight-settings'
import { ensureUser } from '@/lib/user'
import { syncUserFromTwitch } from '@/lib/twitch-sync'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Weight/odds (B): always normalize the viewer before using cached state.
  await ensureUser(session.user)

  let resolvedUser: User | null = null
  // Twitch is ground truth: attempt a lazy sync unless cooldown blocks it.
  try {
    const syncResult = await syncUserFromTwitch(session.user.id)
    resolvedUser = syncResult.user
  } catch (error) {
    console.error('Lazy Twitch sync failed in /api/weight/me:', error)
  }

  if (!resolvedUser) {
    resolvedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })
  }

  if (!resolvedUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const breakdown = await describeWeightBreakdown({
    isSubscriber: resolvedUser.isSubscriber,
    subMonths: resolvedUser.subMonths,
    resubCount: resolvedUser.resubCount,
    totalCheerBits: resolvedUser.totalCheerBits,
    totalDonations: resolvedUser.totalDonations,
    totalGiftedSubs: resolvedUser.totalGiftedSubs,
    carryOverWeight: resolvedUser.carryOverWeight,
  })

  const settings = await getWeightSettings()

  return NextResponse.json({
    user: {
      id: resolvedUser.id,
      username: resolvedUser.username,
      displayName: resolvedUser.displayName,
      isSubscriber: resolvedUser.isSubscriber,
      subMonths: resolvedUser.subMonths,
      resubCount: resolvedUser.resubCount,
      totalCheerBits: resolvedUser.totalCheerBits,
      totalDonations: resolvedUser.totalDonations,
      totalGiftedSubs: resolvedUser.totalGiftedSubs,
      carryOverWeight: resolvedUser.carryOverWeight,
      totalWeight: breakdown.totalWeight,
    },
    breakdown,
    settings,
  })
}

