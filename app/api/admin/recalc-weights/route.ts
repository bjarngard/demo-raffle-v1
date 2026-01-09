import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import {
  calculateUserWeightWithSettings,
  getWeightSettings,
} from '@/lib/weight-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BATCH_SIZE = 200

export async function POST() {
  try {
    const adminSession = await requireAdminSession()
    if (!adminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized access' }, { status: 401 })
    }

    const settings = await getWeightSettings()

    let processed = 0
    let cursor: string | null = null

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
    }

    return NextResponse.json({ success: true, processed })
  } catch (error) {
    console.error('Error in /api/admin/recalc-weights:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to recalc weights',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
