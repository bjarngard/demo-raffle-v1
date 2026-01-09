import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BATCH_SIZE = 25

// Update weights based on Twitch data
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let streamId: string | null = null
    const contentLength = request.headers.get('content-length')
    if (contentLength && contentLength !== '0') {
      try {
        const body = await request.json()
        if (typeof body?.streamId === 'string') {
          streamId = body.streamId
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON in request body' },
          { status: 400 }
        )
      }
    }
    // Get all users with Twitch data
    const users = await prisma.user.findMany({
      where: {
        ...(streamId
          ? {
              entries: {
                some: {
                  streamId,
                  isWinner: false,
                },
              },
            }
          : {}),
        lastActive: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Active in last 24 hours
        },
      },
    })

    const updatedUsers: Array<{ id: string; username: string; totalWeight: number }> = []
    const { calculateUserWeight } = await import('@/lib/weight-settings')

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE)

      const recalculated = await Promise.all(
        batch.map(async (user) => {
          const weight = await calculateUserWeight({
            isSubscriber: user.isSubscriber,
            subMonths: user.subMonths,
            resubCount: user.resubCount,
            totalCheerBits: user.totalCheerBits,
            totalDonations: user.totalDonations,
            totalGiftedSubs: user.totalGiftedSubs,
            carryOverWeight: user.carryOverWeight,
            sessionBonus: user.sessionBonus ?? 0,
          })

          return {
            id: user.id,
            username: user.username,
            carryOver: user.carryOverWeight,
            totalWeight: weight,
          }
        })
      )

      await prisma.$transaction(
        recalculated.map((record) =>
          prisma.user.update({
            where: { id: record.id },
            data: {
              currentWeight: record.totalWeight - record.carryOver,
              totalWeight: record.totalWeight,
              lastUpdated: new Date(),
            },
          })
        )
      )

      updatedUsers.push(
        ...recalculated.map((record) => ({
          id: record.id,
          username: record.username,
          totalWeight: record.totalWeight,
        }))
      )
    }

    return NextResponse.json({
      success: true,
      updated: updatedUsers.length,
      users: updatedUsers,
    })
  } catch (error) {
    console.error('Error updating weights:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update weights',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

