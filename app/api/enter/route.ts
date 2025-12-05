import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { Prisma } from '@prisma/client'
import { entryStateExclusion, getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession } from '@/lib/session'
import { ensureUser } from '@/lib/user'
import { evaluateFollowStatus } from '@/lib/follow-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_DOMAINS = ['soundcloud.com', 'drive.google.com', 'dropbox.com', 'google.com']
const RATE_LIMIT_PER_USER = 5 // 5 submissions per hour
const RATE_LIMIT_PER_IP = 10 // 10 submissions per hour per IP

export async function POST(request: NextRequest) {
  try {
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

    const submissionsOpen = await getSubmissionsOpen()

    if (!submissionsOpen) {
      return NextResponse.json(
        {
          success: false,
          error: 'Submissions are currently closed. Please try again later.',
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
    const { name, displayName, demoLink } = body as {
      name?: unknown
      displayName?: unknown
      demoLink?: unknown
    }
    const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : ''
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    const normalizedDemoLink = typeof demoLink === 'string' ? demoLink.trim() : ''

    const viewer = await ensureUser(session.user)

    // Global pending entry check
    const pendingEntry = await prisma.entry.findFirst({
      where: {
        userId: viewer.id,
        isWinner: false,
        ...entryStateExclusion,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (pendingEntry) {
      if (pendingEntry.sessionId === currentSession.id) {
        return NextResponse.json(
          {
            success: false,
            error: 'You already have an active submission for this session.',
            errorCode: 'ALREADY_SUBMITTED_THIS_SESSION',
          },
          { status: 400 }
        )
      }

      return NextResponse.json(
        {
          success: false,
          error: 'You already have a pending submission carried over from a previous session.',
          errorCode: 'PENDING_ENTRY_FROM_PREVIOUS_SESSION',
        },
        { status: 400 }
      )
    }

    // Validate demo link if provided
    if (normalizedDemoLink) {
      let url: URL
      try {
        url = new URL(normalizedDemoLink)
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

    // Gatekeeping (A): require an explicit not_following result before blocking entry.
    const followStatus = await evaluateFollowStatus({
      id: viewer.id,
      twitchId: viewer.twitchId,
      isFollower: viewer.isFollower,
    })

    if (followStatus.status === 'not_following') {
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

    const resolvedDisplayName =
      normalizedDisplayName ||
      normalizedName ||
      viewer.displayName ||
      viewer.username ||
      session.user.name ||
      viewer.twitchId ||
      'Raffle Viewer'

    const entryData: Prisma.EntryCreateInput = {
      name: resolvedDisplayName,
      user: {
        connect: { id: viewer.id },
      },
      session: {
        connect: {
          id: currentSession.id,
        },
      },
      demoLink: normalizedDemoLink || null,
    }

    let entry
    try {
      entry = await prisma.entry.create({
        data: entryData,
      })
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target
        const targetParts = Array.isArray(target) ? target : typeof target === 'string' ? [target] : []
        if (targetParts.includes('sessionId_userId') || (targetParts.includes('sessionId') && targetParts.includes('userId'))) {
          const activeSession = currentSession ?? (await getCurrentSession())
          if (!activeSession) {
            console.error('P2002 triggered but no active session found')
            return NextResponse.json(
              {
                success: false,
                error: 'Unable to verify your submission status. Please try again.',
              },
              {
                status: 500,
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            )
          }

          const existingEntry = await prisma.entry.findFirst({
            where: {
              userId: viewer.id,
              sessionId: activeSession.id,
              ...entryStateExclusion,
            },
            select: { id: true, isWinner: true },
          })

          if (existingEntry?.isWinner) {
            return NextResponse.json(
              {
                success: false,
                error: 'You have already won this session. You’ll be eligible again in the next session.',
                errorCode: 'ALREADY_WON_THIS_SESSION',
              },
              {
                status: 400,
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            )
          }

          return NextResponse.json(
            {
              success: false,
              error: 'You already have an active submission for this session.',
              errorCode: 'ALREADY_SUBMITTED_THIS_SESSION',
            },
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )
        }
      }

      throw error
    }

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
