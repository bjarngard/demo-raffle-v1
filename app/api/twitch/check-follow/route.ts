import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Check if logged-in user follows the channel
export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      isFollower: user.isFollower,
    })
  } catch (error) {
    console.error('Error checking follow status:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check follow status',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

