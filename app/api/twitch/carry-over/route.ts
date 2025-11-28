import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Carry over weights for users who didn't win to next stream
const BATCH_SIZE = 25

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    const { streamId, resetWeights = false } = body

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

    const updated: Array<{ id: string; username: string; carryOverWeight: number }> = []

    for (let i = 0; i < nonWinners.length; i += BATCH_SIZE) {
      const batch = nonWinners.slice(i, i + BATCH_SIZE)
      const updates = batch.map((user) => ({
        id: user.id,
        username: user.username,
        carryOver: resetWeights ? 0 : user.totalWeight * 0.5,
      }))

      await prisma.$transaction(
        updates.map((update) =>
          prisma.user.update({
            where: { id: update.id },
            data: {
              carryOverWeight: update.carryOver,
              currentWeight: 1.0,
              totalWeight: 1.0 + update.carryOver,
              lastUpdated: new Date(),
            },
          })
        )
      )

      updated.push(
        ...updates.map((update) => ({
          id: update.id,
          username: update.username,
          carryOverWeight: update.carryOver,
        }))
      )
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
  } catch (error) {
    console.error('Error carrying over weights:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to carry over weights',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

