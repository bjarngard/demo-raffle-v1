'use client'

import { formatNumber } from '@/lib/format-number'

interface WeightSettings {
  baseWeight: number
  subMonthsMultiplier: number
  subMonthsCap: number
  cheerBitsDivisor: number
  cheerBitsCap: number
  giftedSubsMultiplier: number
  giftedSubsCap: number
  carryOverMultiplier: number
  carryOverMaxBonus: number
  loyaltyMaxBonus: number
  supportMaxBonus: number
}

interface WeightTableProps {
  settings: WeightSettings
}

export default function WeightTable({ settings }: WeightTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Weight Parameters
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Factor
              </th>
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Calculation
              </th>
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Max Weight
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Base</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">Fixed</td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {formatNumber(settings.baseWeight, 2)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Subscriber Bonus</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(effective months, {settings.subMonthsCap}) × {settings.subMonthsMultiplier} (effective months is at least 1 if subscribed)
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {formatNumber(settings.subMonthsCap * settings.subMonthsMultiplier, 2)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Cheer Bits</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(bits / {settings.cheerBitsDivisor}, {settings.cheerBitsCap})
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {formatNumber(settings.cheerBitsCap, 2)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Gifted Subs</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(count × {settings.giftedSubsMultiplier}, {settings.giftedSubsCap})
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {formatNumber(settings.giftedSubsCap, 2)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Loyalty Cap</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                Total loyalty bonus (subscriber tenure) is capped at this value
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {formatNumber(settings.loyaltyMaxBonus, 2)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Support Cap</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                Combined bits + gifted subs bonus cap
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {formatNumber(settings.supportMaxBonus, 2)}x
              </td>
            </tr>
            <tr>
              <td className="py-3 text-gray-900 dark:text-white">Carry-Over</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                Previous weight × {formatNumber(settings.carryOverMultiplier, 2)} (capped at {formatNumber(
                  settings.carryOverMaxBonus,
                  2
                )}x)
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {formatNumber(settings.carryOverMaxBonus, 2)}x max
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

