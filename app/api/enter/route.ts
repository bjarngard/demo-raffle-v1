import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { Prisma } from '@prisma/client'
import { entryStateExclusion, getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_DOMAINS = ['soundcloud.com', 'drive.google.com', 'dropbox.com', 'google.com']
const RATE_LIMIT_PER_USER = 5 // 5 submissions per hour
const RATE_LIMIT_PER_IP = 10 // 10 submissions per hour per IP

export async function POST(request: NextRequest) {
  try {
    // --- IP-based rate limit ---
    const ipHeader = request.headers.get('x-forwarded-for')
    const ip = ipHeader ? ipHeader.split(',')[0].trim() : 'unknown'
    const ipKey = `demo_submit_ip:${ip}`

    const { success: ipAllowed, message: ipMessage } = checkRateLimit(
      ipKey,
      RATE_LIMIT_PER_IP,
      60 * 60 * 1000 // 1 hour
    )

    if (!ipAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: ipMessage || 'Too many submissions from this IP. Please try again later.',
          errorCode: 'RATE_LIMIT_IP',
        },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const session = await auth()

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'You must be signed in with Twitch to submit a demo.',
          errorCode: 'UNAUTHENTICATED',
        },
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // --- User-based rate limit ---
    const userKey = `demo_submit_user:${session.user.id}`
    const { success: userAllowed, message: userMessage } = checkRateLimit(
      userKey,
      RATE_LIMIT_PER_USER,
      60 * 60 * 1000 // 1 hour
    )

    if (!userAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: userMessage || 'Too many submissions from this account. Please try again later.',
          errorCode: 'RATE_LIMIT_USER',
        },
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const body = await request.json()
    const { name, demoLink } = body as { name?: string; demoLink?: string }

    const submissionsOpen = await getSubmissionsOpen()

    if (!submissionsOpen) {
      return NextResponse.json(
        {
          success: false,
          error: 'Submissions are currently closed.',
          errorCode: 'SUBMISSIONS_CLOSED',
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const currentSession = await getCurrentSession()

    if (!currentSession) {
      return NextResponse.json(
        {
          success: false,
          error: 'The raffle is not currently running. Please try again later.',
          errorCode: 'NO_ACTIVE_SESSION',
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // 1) Check if user already has an entry in the CURRENT session
    const existingSessionEntry = await prisma.entry.findFirst({
      where: {
        userId: session.user.id,
        isWinner: false,
        sessionId: currentSession.id,
        ...entryStateExclusion,
      },
    })

    if (existingSessionEntry) {
      return NextResponse.json(
        {
          success: false,
          error: 'You already have an active submission for this session.',
          errorCode: 'ALREADY_SUBMITTED_THIS_SESSION',
        },
        { status: 400 }
      )
    }

    // 2) Check if user has a pending entry from ANY PREVIOUS session
    const pendingEntry = await prisma.entry.findFirst({
      where: {
        userId: session.user.id,
        isWinner: false,
        sessionId: { not: currentSession.id },
        ...entryStateExclusion,
      },
    })

    if (pendingEntry) {
      return NextResponse.json(
        {
          success: false,
          error:
            'You already have a pending submission with accumulated weight. It must be drawn before you can submit again.',
          errorCode: 'PENDING_ENTRY_FROM_PREVIOUS_SESSION',
        },
        { status: 400 }
      )
    }

    // Validate demo link if provided
    if (demoLink && demoLink.trim()) {
      let url: URL
      try {
        url = new URL(demoLink.trim())
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid demo link URL format' },
          { status: 400 }
        )
      }

      const domain = url.hostname.replace('www.', '')
      if (!ALLOWED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) {
        return NextResponse.json(
          { success: false, error: 'Demo link must be from SoundCloud, Google Drive, or Dropbox.' },
          { status: 400 }
        )
      }

      // Quick HEAD check (2s timeout)
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2000)
        await fetch(url.toString(), { method: 'HEAD', signal: controller.signal })
        clearTimeout(timeout)
      } catch {
        // Allow if HEAD check fails (might be private/shareable link)
      }
    }

    // Name is optional if user has displayName
    let displayName = name?.trim()
    if (!displayName) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { displayName: true },
      })
      displayName = user?.displayName || ''
    }

    if (!displayName) {
      return NextResponse.json(
        { success: false, error: 'Name or Twitch display name is required.' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        isFollower: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found in the raffle system.',
          errorCode: 'USER_NOT_FOUND',
        },
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    if (!user.isFollower) {
      return NextResponse.json(
        {
          success: false,
          error: 'You need to follow the channel on Twitch before entering the raffle.',
          errorCode: 'NOT_FOLLOWING',
        },
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    const entryData: Prisma.EntryCreateInput = {
      name: displayName,
      user: {
        connect: { id: session.user.id },
      },
      session: {
        connect: {
          id: currentSession.id,
        },
      },
    }

    if (demoLink && demoLink.trim()) {
      entryData.demoLink = demoLink.trim()
    }

    const entry = await prisma.entry.create({
      data: entryData,
    })

    return NextResponse.json(
      {
        success: true,
        entryId: entry.id,
      },
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (error) {
    console.error('Error in /api/enter:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during registration',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}
