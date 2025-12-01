import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getSubmissionsOpen, setSubmissionsOpen } from '@/lib/submissions-state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const submissionsOpen = await getSubmissionsOpen()

    return NextResponse.json({ success: true, submissionsOpen })
  } catch (error) {
    console.error('Error fetching submissions state:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch submissions state' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    if (typeof (body as { submissionsOpen?: unknown })?.submissionsOpen !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'submissionsOpen boolean is required' },
        { status: 400 }
      )
    }

    const { submissionsOpen } = body as { submissionsOpen: boolean }
    await setSubmissionsOpen(submissionsOpen)
    const updatedState = await getSubmissionsOpen()

    return NextResponse.json({ success: true, submissionsOpen: updatedState })
  } catch (error) {
    console.error('Error updating submissions state:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update submissions state' },
      { status: 500 }
    )
  }
}

