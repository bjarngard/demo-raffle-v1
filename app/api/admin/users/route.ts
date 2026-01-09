import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { calculateUserWeightWithSettings, getWeightSettings } from '@/lib/weight-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized access' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') ?? '').trim()
    const limitRaw = Number(searchParams.get('limit') ?? DEFAULT_LIMIT)
    const limit = Math.min(Math.max(limitRaw, 1), MAX_LIMIT)

    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { lastUpdated: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        displayName: true,
        totalWeight: true,
        currentWeight: true,
        carryOverWeight: true,
        sessionBonus: true,
        isSubscriber: true,
        isFollower: true,
        subMonths: true,
        lastUpdated: true,
      },
    })

    return NextResponse.json({ success: true, users })
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized access' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const userId = typeof body?.userId === 'string' ? body.userId : null
    const bonusRaw = body?.sessionBonus
    const bonus =
      typeof bonusRaw === 'number' && Number.isFinite(bonusRaw) ? Math.max(0, bonusRaw) : null

    if (!userId || bonus === null) {
      return NextResponse.json(
        { success: false, error: 'userId and sessionBonus are required (sessionBonus >= 0)' },
        { status: 400 }
      )
    }

    const settings = await getWeightSettings()

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
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
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const totalWeight = calculateUserWeightWithSettings(
      {
        isSubscriber: user.isSubscriber,
        subMonths: user.subMonths,
        resubCount: user.resubCount,
        totalCheerBits: user.totalCheerBits,
        totalDonations: user.totalDonations,
        totalGiftedSubs: user.totalGiftedSubs,
        carryOverWeight: user.carryOverWeight,
        sessionBonus: bonus,
      },
      settings
    )

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        sessionBonus: bonus,
        totalWeight,
        currentWeight: totalWeight - user.carryOverWeight,
        lastUpdated: new Date(),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        totalWeight: true,
        currentWeight: true,
        carryOverWeight: true,
        sessionBonus: true,
        isSubscriber: true,
        isFollower: true,
        subMonths: true,
        lastUpdated: true,
      },
    })

    return NextResponse.json({ success: true, user: updated })
  } catch (error) {
    console.error('Error updating session bonus:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update session bonus',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
