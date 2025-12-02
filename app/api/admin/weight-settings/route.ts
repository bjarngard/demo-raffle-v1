/**
 * Get/Update weight settings for admin panel
 * Requires ADMIN_TOKEN
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-auth'
import { getWeightSettings, updateWeightSettings } from '@/lib/weight-settings'
import type { WeightSettings } from '@/lib/weight-settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    // Get settings from database
    const settings = await getWeightSettings()

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error) {
    console.error('Error fetching weight settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch weight settings',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Settings object is required' },
        { status: 400 }
      )
    }

    const parseFloatValue = (value: unknown): number | undefined => {
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        return Number.isNaN(parsed) ? undefined : parsed
      }
      return undefined
    }

    const parseIntValue = (value: unknown): number | undefined => {
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const parsed = Number.parseInt(value, 10)
        return Number.isNaN(parsed) ? undefined : parsed
      }
      return undefined
    }

    // Validate settings values
    const validSettings: Partial<WeightSettings> = {}
    const baseWeight = parseFloatValue(settings.baseWeight)
    if (baseWeight !== undefined) validSettings.baseWeight = baseWeight

    const subMonthsMultiplier = parseFloatValue(settings.subMonthsMultiplier)
    if (subMonthsMultiplier !== undefined) validSettings.subMonthsMultiplier = subMonthsMultiplier

    const subMonthsCap = parseIntValue(settings.subMonthsCap)
    if (subMonthsCap !== undefined) validSettings.subMonthsCap = subMonthsCap

    const resubMultiplier = parseFloatValue(settings.resubMultiplier)
    if (resubMultiplier !== undefined) validSettings.resubMultiplier = resubMultiplier

    const resubCap = parseIntValue(settings.resubCap)
    if (resubCap !== undefined) validSettings.resubCap = resubCap

    const cheerBitsDivisor = parseFloatValue(settings.cheerBitsDivisor)
    if (cheerBitsDivisor !== undefined) validSettings.cheerBitsDivisor = cheerBitsDivisor

    const cheerBitsCap = parseFloatValue(settings.cheerBitsCap)
    if (cheerBitsCap !== undefined) validSettings.cheerBitsCap = cheerBitsCap

    const donationsDivisor = parseFloatValue(settings.donationsDivisor)
    if (donationsDivisor !== undefined) validSettings.donationsDivisor = donationsDivisor

    const donationsCap = parseFloatValue(settings.donationsCap)
    if (donationsCap !== undefined) validSettings.donationsCap = donationsCap

    const giftedSubsMultiplier = parseFloatValue(settings.giftedSubsMultiplier)
    if (giftedSubsMultiplier !== undefined) validSettings.giftedSubsMultiplier = giftedSubsMultiplier

    const giftedSubsCap = parseFloatValue(settings.giftedSubsCap)
    if (giftedSubsCap !== undefined) validSettings.giftedSubsCap = giftedSubsCap

    const carryOverMultiplier = parseFloatValue(settings.carryOverMultiplier)
    if (carryOverMultiplier !== undefined) validSettings.carryOverMultiplier = carryOverMultiplier

    const carryOverMaxBonus = parseFloatValue(settings.carryOverMaxBonus)
    if (carryOverMaxBonus !== undefined) validSettings.carryOverMaxBonus = carryOverMaxBonus

    const loyaltyMaxBonus = parseFloatValue(settings.loyaltyMaxBonus)
    if (loyaltyMaxBonus !== undefined) validSettings.loyaltyMaxBonus = loyaltyMaxBonus

    const supportMaxBonus = parseFloatValue(settings.supportMaxBonus)
    if (supportMaxBonus !== undefined) validSettings.supportMaxBonus = supportMaxBonus

    // Update settings
    const updated = await updateWeightSettings(validSettings)

    return NextResponse.json({
      success: true,
      settings: updated,
      message: 'Weight settings updated successfully',
    })
  } catch (error) {
    console.error('Error updating weight settings:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update weight settings',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

