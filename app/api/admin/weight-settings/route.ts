/**
 * Get/Update weight settings for admin panel
 * Requires ADMIN_TOKEN
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { getWeightSettings, updateWeightSettings } from '@/lib/weight-settings'

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

    // Get settings from database
    const settings = await getWeightSettings()

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error: any) {
    console.error('Error fetching weight settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weight settings', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Verify admin token
    const isAuthenticated = await verifyAdminToken(request)

    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Settings object is required' },
        { status: 400 }
      )
    }

    // Validate settings values
    const validSettings: any = {}
    if (settings.baseWeight !== undefined) validSettings.baseWeight = parseFloat(settings.baseWeight)
    if (settings.subMonthsMultiplier !== undefined) validSettings.subMonthsMultiplier = parseFloat(settings.subMonthsMultiplier)
    if (settings.subMonthsCap !== undefined) validSettings.subMonthsCap = parseInt(settings.subMonthsCap)
    if (settings.resubMultiplier !== undefined) validSettings.resubMultiplier = parseFloat(settings.resubMultiplier)
    if (settings.resubCap !== undefined) validSettings.resubCap = parseInt(settings.resubCap)
    if (settings.cheerBitsDivisor !== undefined) validSettings.cheerBitsDivisor = parseFloat(settings.cheerBitsDivisor)
    if (settings.cheerBitsCap !== undefined) validSettings.cheerBitsCap = parseFloat(settings.cheerBitsCap)
    if (settings.donationsDivisor !== undefined) validSettings.donationsDivisor = parseFloat(settings.donationsDivisor)
    if (settings.donationsCap !== undefined) validSettings.donationsCap = parseFloat(settings.donationsCap)
    if (settings.giftedSubsMultiplier !== undefined) validSettings.giftedSubsMultiplier = parseFloat(settings.giftedSubsMultiplier)
    if (settings.giftedSubsCap !== undefined) validSettings.giftedSubsCap = parseFloat(settings.giftedSubsCap)
    if (settings.carryOverMultiplier !== undefined) validSettings.carryOverMultiplier = parseFloat(settings.carryOverMultiplier)

    // Update settings
    const updated = await updateWeightSettings(validSettings)

    return NextResponse.json({
      success: true,
      settings: updated,
      message: 'Weight settings updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating weight settings:', error)
    return NextResponse.json(
      { error: 'Failed to update weight settings', details: error.message },
      { status: 500 }
    )
  }
}

