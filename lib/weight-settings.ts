/**
 * Weight settings helper
 * Manages weight calculation constants from database
 */
import { prisma } from './prisma'

export const DEFAULT_SETTINGS = {
  baseWeight: 1.0,
  subMonthsMultiplier: 0.5,
  subMonthsCap: 10,
  resubMultiplier: 0.2,
  resubCap: 5,
  cheerBitsDivisor: 100.0, // matches intended live profile (100 bits = +1×)
  cheerBitsCap: 120.0,
  donationsDivisor: 1000.0,
  donationsCap: 5.0,
  giftedSubsMultiplier: 5.0,
  giftedSubsCap: 120.0,
  carryOverMultiplier: 0.5,
  carryOverMaxBonus: 1.0,
  loyaltyMaxBonus: 3.0,
  supportMaxBonus: 120.0,
}

export type WeightSettings = typeof DEFAULT_SETTINGS
type WeightUserInput = {
  isSubscriber: boolean
  subMonths: number
  resubCount: number
  totalCheerBits: number
  totalDonations: number
  totalGiftedSubs: number
  carryOverWeight: number
}

type WeightComponents = {
  baseWeight: number
  monthsComponent: number
  resubComponent: number
  loyaltyWeightRaw: number
  loyaltyWeightCapped: number
  cheerWeight: number
  donationsWeight: number
  giftedSubsWeight: number
  supportWeightRaw: number
  supportWeightCapped: number
}

export type WeightBreakdown = {
  baseWeight: number
  loyalty: {
    monthsComponent: number
    resubComponent: number
    rawTotal: number
    cappedTotal: number
    cap: number
  }
  support: {
    cheerWeight: number
    donationsWeight: number
    giftedSubsWeight: number
    rawTotal: number
    cappedTotal: number
    cap: number
  }
  carryOverWeight: number
  totalWeight: number
}

/**
 * Get current weight settings from database (with caching)
 */
export async function getWeightSettings(): Promise<WeightSettings> {
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

    const result = normalizeSettings(settings)

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
    // no-op: cache removed

    return normalizeSettings(updated)
  } catch (error) {
    console.error('Error updating weight settings:', error)
    throw error
  }
}

/**
 * Calculate user weight based on settings
 */
export async function calculateUserWeight(user: WeightUserInput): Promise<number> {
  const settings = await getWeightSettings()
  const components = computeWeightComponents(user, settings)
  const totalWeight =
    components.baseWeight +
    components.loyaltyWeightCapped +
    components.supportWeightCapped +
    user.carryOverWeight
  return totalWeight
}

// Test-friendly helper: run weight calculation with provided settings (no DB access).
export function calculateUserWeightWithSettings(user: WeightUserInput, settings: WeightSettings): number {
  const components = computeWeightComponents(user, settings)
  const totalWeight =
    components.baseWeight +
    components.loyaltyWeightCapped +
    components.supportWeightCapped +
    user.carryOverWeight
  return totalWeight
}

export async function describeWeightBreakdown(user: WeightUserInput): Promise<WeightBreakdown> {
  const settings = await getWeightSettings()
  const components = computeWeightComponents(user, settings)
  const totalWeight =
    components.baseWeight +
    components.loyaltyWeightCapped +
    components.supportWeightCapped +
    user.carryOverWeight

  return {
    baseWeight: components.baseWeight,
    loyalty: {
      monthsComponent: components.monthsComponent,
      resubComponent: components.resubComponent,
      rawTotal: components.loyaltyWeightRaw,
      cappedTotal: components.loyaltyWeightCapped,
      cap: settings.loyaltyMaxBonus,
    },
    support: {
      cheerWeight: components.cheerWeight,
      donationsWeight: components.donationsWeight,
      giftedSubsWeight: components.giftedSubsWeight,
      rawTotal: components.supportWeightRaw,
      cappedTotal: components.supportWeightCapped,
      cap: settings.supportMaxBonus,
    },
    carryOverWeight: user.carryOverWeight,
    totalWeight,
  }
}

function normalizeSettings(settings: {
  baseWeight: number
  subMonthsMultiplier: number
  subMonthsCap: number
  resubMultiplier: number
  resubCap: number
  cheerBitsDivisor: number
  cheerBitsCap: number
  donationsDivisor: number
  donationsCap: number
  giftedSubsMultiplier: number
  giftedSubsCap: number
  carryOverMultiplier: number
  carryOverMaxBonus?: number | null
  loyaltyMaxBonus?: number | null
  supportMaxBonus?: number | null
}): WeightSettings {
  return {
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
    carryOverMaxBonus: settings.carryOverMaxBonus ?? DEFAULT_SETTINGS.carryOverMaxBonus,
    loyaltyMaxBonus: settings.loyaltyMaxBonus ?? DEFAULT_SETTINGS.loyaltyMaxBonus,
    supportMaxBonus: settings.supportMaxBonus ?? DEFAULT_SETTINGS.supportMaxBonus,
  }
}

function computeWeightComponents(
  user: WeightUserInput,
  settings: WeightSettings
): WeightComponents {
  const baseWeight = settings.baseWeight

  const effectiveSubMonths = getEffectiveSubMonths(user.isSubscriber, user.subMonths)
  const monthsComponent = effectiveSubMonths
    ? Math.min(
        effectiveSubMonths * settings.subMonthsMultiplier,
        settings.subMonthsCap * settings.subMonthsMultiplier
      )
    : 0

  // NOTE: Resub months are intentionally ignored in weight calculations.
  // Only “subscribed or not” matters right now.
  const resubComponent = 0

  const loyaltyWeightRaw = monthsComponent
  const loyaltyWeightCapped = Math.min(loyaltyWeightRaw, settings.loyaltyMaxBonus)

  const cheerWeight = Math.min(
    user.totalCheerBits / settings.cheerBitsDivisor,
    settings.cheerBitsCap
  )

  // NOTE: Generic cash donations are currently not used for weight.
  // Only bits and gifted subs contribute to support weight.
  const donationsWeight = 0

  const giftedSubsWeight = Math.min(
    user.totalGiftedSubs * settings.giftedSubsMultiplier,
    settings.giftedSubsCap
  )

  const supportWeightRaw = cheerWeight + donationsWeight + giftedSubsWeight
  const supportWeightCapped = Math.min(supportWeightRaw, settings.supportMaxBonus)

  return {
    baseWeight,
    monthsComponent,
    resubComponent,
    loyaltyWeightRaw,
    loyaltyWeightCapped,
    cheerWeight,
    donationsWeight,
    giftedSubsWeight,
    supportWeightRaw,
    supportWeightCapped,
  }
}

function getEffectiveSubMonths(isSubscriber: boolean, subMonths: number): number {
  if (!isSubscriber) {
    return 0
  }
  return Math.max(1, subMonths)
}
