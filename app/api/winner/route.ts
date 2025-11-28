import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Try to connect to database
    const winner = await prisma.entry.findFirst({
      where: { isWinner: true },
      select: {
        id: true,
        name: true,
        email: false, // Visa inte e-post publikt
      },
    })

    if (!winner) {
      return NextResponse.json({ winner: null }, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
    }

    return NextResponse.json({ winner }, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in /api/winner:', error)
    
    // Return JSON even on error
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching the winner',
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

