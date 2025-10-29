import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verify admin token
    const authHeader = request.headers.get('authorization')
    const tokenFromHeader = authHeader?.replace('Bearer ', '')
    const tokenFromQuery = request.nextUrl.searchParams.get('token')
    const adminToken = tokenFromHeader || tokenFromQuery

    const expectedToken = process.env.ADMIN_TOKEN

    if (!expectedToken) {
      console.error('ADMIN_TOKEN is not configured in environment variables')
      return NextResponse.json(
        { success: false, error: 'Server configuration missing' },
        { status: 500 }
      )
    }

    if (adminToken !== expectedToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    // Get all participants who are not winners
    const entries = await prisma.entry.findMany({
      where: {
        isWinner: false,
      },
    })

    if (entries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No participants available to choose from' },
        { status: 400 }
      )
    }

    // Select random winner
    const randomIndex = Math.floor(Math.random() * entries.length)
    const winner = entries[randomIndex]

    // Update winner in database
    const updatedWinner = await prisma.entry.update({
      where: { id: winner.id },
      data: { isWinner: true },
    })

    return NextResponse.json({
      success: true,
      winner: {
        id: updatedWinner.id,
        name: updatedWinner.name,
        email: updatedWinner.email,
      },
    })
  } catch (error) {
    console.error('Error in /api/pick-winner:', error)
    return NextResponse.json(
      { success: false, error: 'An error occurred while picking the winner' },
      { status: 500 }
    )
  }
}

