/**
 * Get all entries with user data for admin panel
 * Requires ADMIN_TOKEN
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verify admin token
    const isAuthenticated = await verifyAdminToken(request)

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    // Get search and sort params
    const search = request.nextUrl.searchParams.get('search') || ''
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'weight'
    const sortOrder = request.nextUrl.searchParams.get('sortOrder') || 'desc'

    // Get all non-winner entries with user data
    const entries = await prisma.entry.findMany({
      where: {
        isWinner: false,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            totalWeight: true,
            isSubscriber: true,
            subMonths: true,
            resubCount: true,
            totalCheerBits: true,
            totalDonations: true,
            totalGiftedSubs: true,
            carryOverWeight: true,
          },
        },
      },
      orderBy: sortBy === 'name'
        ? { name: sortOrder === 'desc' ? 'desc' : 'asc' }
        : { createdAt: 'desc' },
    })

    // Filter by search term if provided
    let filteredEntries = entries
    if (search) {
      const searchLower = search.toLowerCase()
      filteredEntries = entries.filter(
        (entry) =>
          entry.name.toLowerCase().includes(searchLower) ||
          entry.user?.username?.toLowerCase().includes(searchLower) ||
          entry.user?.displayName?.toLowerCase().includes(searchLower)
      )
    }

    // Format response with weight breakdown and sort by weight if needed
    let formattedEntries = filteredEntries.map((entry) => ({
      id: entry.id,
      name: entry.name || entry.user?.displayName || entry.user?.username || 'Unknown',
      username: entry.user?.username || '',
      displayName: entry.user?.displayName || '',
      demoLink: entry.demoLink || null,
      totalWeight: entry.user?.totalWeight || 1.0,
      weightBreakdown: {
        base: 1.0,
        subMonths: entry.user?.subMonths || 0,
        resubCount: entry.user?.resubCount || 0,
        cheerBits: entry.user?.totalCheerBits || 0,
        donations: entry.user?.totalDonations || 0,
        giftedSubs: entry.user?.totalGiftedSubs || 0,
        carryOver: entry.user?.carryOverWeight || 0,
      },
      createdAt: entry.createdAt,
      userId: entry.userId,
    }))

    // Sort by weight if requested (client-side since Prisma doesn't support relation sorting easily)
    if (sortBy === 'weight') {
      formattedEntries.sort((a, b) => {
        return sortOrder === 'desc'
          ? b.totalWeight - a.totalWeight
          : a.totalWeight - b.totalWeight
      })
    }

    return NextResponse.json({
      success: true,
      entries: formattedEntries,
      total: formattedEntries.length,
    })
  } catch (error: any) {
    console.error('Error fetching entries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entries', details: error.message },
      { status: 500 }
    )
  }
}

