/**
 * Get user's current submission status
 */
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { entryStateExclusion } from '@/lib/submissions-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has an active submission
    const entry = await prisma.entry.findFirst({
      where: {
        userId: session.user.id,
        isWinner: false,
        ...entryStateExclusion,
      },
      select: {
        id: true,
        name: true,
        demoLink: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      hasSubmission: !!entry,
      submission: entry || null,
    })
  } catch (error) {
    console.error('Error fetching submission:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch submission',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

