/**
 * Delete an entry (admin only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const { id } = params
    const entryId = parseInt(id)

    if (isNaN(entryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid entry ID' },
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
  } catch (error) {
    console.error('Error deleting entry:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Entry not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete entry',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

