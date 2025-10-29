/**
 * Weight settings helper
 * Manages weight calculation constants from database
 */
import { prisma } from './prisma'

const DEFAULT_SETTINGS = {
  baseWeight: 1.0,
  subMonthsMultiplier: 0.1,
  subMonthsCap: 10,
  resubMultiplier: 0.2,
  resubCap: 5,
  cheerBitsDivisor: 1000.0,
  cheerBitsCap: 5.0,
  donationsDivisor: 1000.0,
  donationsCap: 5.0,
  giftedSubsMultiplier: 0.1,
  giftedSubsCap: 5.0,
  carryOverMultiplier: 0.5,
}

export type WeightSettings = typeof DEFAULT_SETTINGS

let settingsCache: WeightSettings | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60000 // 1 minute cache

/**
 * Get current weight settings from database (with caching)
 */
export async function getWeightSettings(): Promise<WeightSettings> {
  const now = Date.now()

  // Return cached settings if still valid
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return settingsCache
  }

  try {
    // Try to get settings from database
    let settings = await prisma.weightSettings.findFirst({
      orderBy: { updatedAt: 'desc' },
    })

    // If no settings exist, create default
    if (!settings) {
      settings = await prisma.weightSettings.create({
        data: DEFAULT_SETTINGS,
      })
    }

    const result = {
      baseWeight: settings.baseWeight,
      subMonthsMultiplier: settings.subMonthsMultiplier,
      subMonthsCap: settings.subMonthsCap,
      resubMultiplier: settings.resubMultiplier,
      resubCap: settings.resubCap,
      cheerBitsDivisor: settings.cheerBitsDivisor,
      cheerBitsCap: settings.cheerBitsCap,
      donationsDivisor: settings.donationsDivisor,
      donationsCap: settings.donationsCap,
      giftedSubsMultiplier: settings.giftedSubsMultiplier,
      giftedSubsCap: settings.giftedSubsCap,
      carryOverMultiplier: settings.carryOverMultiplier,
    }

    // Update cache
    settingsCache = result
    cacheTimestamp = now

    return result
  } catch (error) {
    console.error('Error fetching weight settings, using defaults:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Update weight settings in database
 */
export async function updateWeightSettings(
  newSettings: Partial<WeightSettings>
): Promise<WeightSettings> {
  try {
    // Get current settings
    let currentSettings = await prisma.weightSettings.findFirst({
      orderBy: { updatedAt: 'desc' },
    })

    // Create if doesn't exist
    if (!currentSettings) {
      currentSettings = await prisma.weightSettings.create({
        data: DEFAULT_SETTINGS,
      })
    }

    // Update settings
    const updated = await prisma.weightSettings.update({
      where: { id: currentSettings.id },
      data: {
        ...newSettings,
        updatedAt: new Date(),
      },
    })

    // Invalidate cache
    settingsCache = null

    return {
      baseWeight: updated.baseWeight,
      subMonthsMultiplier: updated.subMonthsMultiplier,
      subMonthsCap: updated.subMonthsCap,
      resubMultiplier: updated.resubMultiplier,
      resubCap: updated.resubCap,
      cheerBitsDivisor: updated.cheerBitsDivisor,
      cheerBitsCap: updated.cheerBitsCap,
      donationsDivisor: updated.donationsDivisor,
      donationsCap: updated.donationsCap,
      giftedSubsMultiplier: updated.giftedSubsMultiplier,
      giftedSubsCap: updated.giftedSubsCap,
      carryOverMultiplier: updated.carryOverMultiplier,
    }
  } catch (error) {
    console.error('Error updating weight settings:', error)
    throw error
  }
}

/**
 * Calculate user weight based on settings
 */
export async function calculateUserWeight(
  user: {
    isSubscriber: boolean
    subMonths: number
    resubCount: number
    totalCheerBits: number
    totalDonations: number
    totalGiftedSubs: number
    carryOverWeight: number
  }
): Promise<number> {
  const settings = await getWeightSettings()

  let weight = settings.baseWeight

  // Subscriber bonus (capped)
  if (user.isSubscriber) {
    const subMonthsCapped = Math.min(user.subMonths, settings.subMonthsCap)
    weight += subMonthsCapped * settings.subMonthsMultiplier
  }

  // Resub bonus (capped)
  const resubCountCapped = Math.min(user.resubCount, settings.resubCap)
  weight += resubCountCapped * settings.resubMultiplier

  // Cheer bits bonus (capped)
  const cheerWeight = Math.min(
    user.totalCheerBits / settings.cheerBitsDivisor,
    settings.cheerBitsCap
  )
  weight += cheerWeight

  // Donation bonus (capped)
  const donationWeight = Math.min(
    user.totalDonations / settings.donationsDivisor,
    settings.donationsCap
  )
  weight += donationWeight

  // Gifted subs bonus (capped)
  const giftedSubsWeight = Math.min(
    user.totalGiftedSubs * settings.giftedSubsMultiplier,
    settings.giftedSubsCap
  )
  weight += giftedSubsWeight

  // Add carry-over weight
  weight += user.carryOverWeight

  return weight
}

