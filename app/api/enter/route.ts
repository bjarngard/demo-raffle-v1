import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rate-limit'
import { Prisma } from '@prisma/client'
import { getSubmissionsOpen } from '@/lib/submissions-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_DOMAINS = ['soundcloud.com', 'drive.google.com', 'dropbox.com', 'google.com']
const RATE_LIMIT_PER_USER = 5 // 5 submissions per hour
const RATE_LIMIT_PER_IP = 10 // 10 submissions per hour per IP

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    if (!checkRateLimit(`ip:${ip}`, RATE_LIMIT_PER_IP, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const session = await auth()
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


    // REQUIRE Twitch login
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'You must be logged in with Twitch to enter the raffle' },
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // Check if user follows the channel - REQUIRED
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found. Please try logging in again.' },
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
        { error: 'NOT_FOLLOWING' },
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        }
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
    const { name, demoLink } = body

    // Rate limit per user
    if (!checkRateLimit(`user:${session.user.id}`, RATE_LIMIT_PER_USER, 60 * 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    // Check if user already has an active submission (non-winner entry)
    const existingEntry = await prisma.entry.findFirst({
      where: {
        userId: session.user.id,
        isWinner: false,
      },
    })

    if (existingEntry) {
      return NextResponse.json(
        { success: false, error: 'You already have an active submission', errorCode: 'ALREADY_SUBMITTED' },
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
          { success: false, error: 'Demo link must be from SoundCloud, Google Drive, or Dropbox' },
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
    const displayName = name?.trim() || user.displayName || user.username

    // Try to create new participant
    try {
      const entryData: Prisma.EntryCreateInput = {
        name: displayName,
        user: {
          connect: { id: session.user.id }, // Always linked to Twitch user
        },
      }

      // Add demo link if provided
      if (demoLink && demoLink.trim()) {
        entryData.demoLink = demoLink.trim()
      }

      // Use email from user if available
      if (user.email) {
        entryData.email = user.email.toLowerCase()
      }

      const entry = await prisma.entry.create({
        data: entryData,
      })

      return NextResponse.json(
        { success: true, id: entry.id },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'This email is already registered', errorCode: 'EMAIL_ALREADY_REGISTERED' },
          { 
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Error in /api/enter:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'An error occurred during registration',
        details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined
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

