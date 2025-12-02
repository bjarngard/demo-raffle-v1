import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { describeWeightBreakdown, getWeightSettings } from '@/lib/weight-settings'

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      isSubscriber: true,
      subMonths: true,
      resubCount: true,
      totalCheerBits: true,
      totalDonations: true,
      totalGiftedSubs: true,
      carryOverWeight: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const breakdown = await describeWeightBreakdown({
    isSubscriber: user.isSubscriber,
    subMonths: user.subMonths,
    resubCount: user.resubCount,
    totalCheerBits: user.totalCheerBits,
    totalDonations: user.totalDonations,
    totalGiftedSubs: user.totalGiftedSubs,
    carryOverWeight: user.carryOverWeight,
  })

  const settings = await getWeightSettings()

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      isSubscriber: user.isSubscriber,
      subMonths: user.subMonths,
      resubCount: user.resubCount,
      totalCheerBits: user.totalCheerBits,
      totalDonations: user.totalDonations,
      totalGiftedSubs: user.totalGiftedSubs,
      carryOverWeight: user.carryOverWeight,
      totalWeight: breakdown.totalWeight,
    },
    breakdown,
    settings,
  })
}

