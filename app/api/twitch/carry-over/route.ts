import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Carry over weights for users who didn't win to next stream
export async function POST(request: NextRequest) {
  try {
    const { streamId, resetWeights = false } = await request.json()

    // Get all users who entered but didn't win
    const nonWinners = await prisma.user.findMany({
      where: {
        entries: {
          some: {
            streamId: streamId || null,
            isWinner: false,
          },
        },
      },
    })

    const updated = []

    for (const user of nonWinners) {
      // Calculate carry-over as 50% of current weight (adjustable)
      const carryOver = resetWeights ? 0 : user.totalWeight * 0.5

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          carryOverWeight: carryOver,
          currentWeight: 1.0, // Reset base weight for new stream
          totalWeight: 1.0 + carryOver, // Base + carry-over
          lastUpdated: new Date(),
        },
      })

      updated.push({
        id: updatedUser.id,
        username: updatedUser.username,
        carryOverWeight: updatedUser.carryOverWeight,
      })
    }

    // Reset carry-over for winner (they won, no carry-over)
    const winner = await prisma.entry.findFirst({
      where: {
        streamId: streamId || null,
        isWinner: true,
      },
      include: { user: true },
    })

    if (winner?.user) {
      await prisma.user.update({
        where: { id: winner.user.id },
        data: {
          carryOverWeight: 0,
        },
      })
    }

    return NextResponse.json({
      success: true,
      updated: updated.length,
      users: updated,
    })
  } catch (error: any) {
    console.error('Error carrying over weights:', error)
    return NextResponse.json(
      { error: 'Failed to carry over weights', details: error.message },
      { status: 500 }
    )
  }
}

