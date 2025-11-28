import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Get top 20 entries with their win probability
 */
export async function GET() {
  try {
    // Check if submissions are open or closed (closed if winner exists)
    const hasWinner = await prisma.entry.findFirst({
      where: { isWinner: true },
    })

    // Get all entries that are not winners, sorted by weight
    const entries = await prisma.entry.findMany({
      where: {
        isWinner: false,
      },
      include: {
        user: {
          select: {
            totalWeight: true,
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate total weight for probability calculation
    const totalWeight = entries.reduce((sum, entry) => {
      const weight = entry.user?.totalWeight || 1.0
      return sum + weight
    }, 0)

    // Calculate probability for each entry and sort by weight (highest first)
    const entriesWithProbability = entries
      .map((entry) => {
        const weight = entry.user?.totalWeight || 1.0
        const probability = totalWeight > 0 ? (weight / totalWeight) * 100 : 0

        return {
          id: entry.id,
          name: entry.name || entry.user?.displayName || entry.user?.username || 'Unknown',
          weight: weight,
          probability: probability,
        }
      })
      .sort((a, b) => b.weight - a.weight) // Sort by weight descending
      .slice(0, 20) // Top 20

    return NextResponse.json({
      submissionsOpen: !hasWinner,
      totalEntries: entries.length,
      entries: entriesWithProbability,
    })
  } catch (error) {
    console.error('Error in /api/leaderboard:', error)
    return NextResponse.json(
      {
        error: 'An error occurred while fetching leaderboard',
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

