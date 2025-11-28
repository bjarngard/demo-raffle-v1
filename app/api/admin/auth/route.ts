import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await requireAdminSession()
    return NextResponse.json({
      authenticated: !!session,
      user: session
        ? {
            id: session.user.id,
            name: session.user.name,
            isBroadcaster: session.user.isBroadcaster ?? false,
          }
        : null,
    })
  } catch (error) {
    console.error('Error verifying admin authentication:', error)
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    )
  }
}

export function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const DELETE = POST

