/**
 * Delete an entry (admin only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin token
    const isAuthenticated = await verifyAdminToken(request)

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const entryId = parseInt(params.id)

    if (isNaN(entryId)) {
      return NextResponse.json(
        { error: 'Invalid entry ID' },
        { status: 400 }
      )
    }

    // Delete entry
    await prisma.entry.delete({
      where: { id: entryId },
    })

    return NextResponse.json({
      success: true,
      message: 'Entry removed successfully',
    })
  } catch (error: any) {
    console.error('Error deleting entry:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete entry', details: error.message },
      { status: 500 }
    )
  }
}

