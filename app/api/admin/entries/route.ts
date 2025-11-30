/**
 * Get all entries with user data for admin panel
 * Requires authenticated broadcaster session
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getAdminEntries } from '@/lib/admin-data'
import { getCurrentSession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    // Get search and sort params
    const search = request.nextUrl.searchParams.get('search') || ''
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'weight'
    const sortOrder = request.nextUrl.searchParams.get('sortOrder') || 'desc'

    const currentSession = await getCurrentSession()
    const entries = currentSession
      ? await getAdminEntries({
          search,
          sortBy:
            sortBy === 'name'
              ? 'name'
              : 'weight',
          sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
          sessionId: currentSession.id,
        })
      : []

    return NextResponse.json({
      success: true,
      entries,
      total: entries.length,
    })
  } catch (error) {
    console.error('Error fetching entries:', error)
    const details = error instanceof Error ? error.message : undefined
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries', details },
      { status: 500 }
    )
  }
}

