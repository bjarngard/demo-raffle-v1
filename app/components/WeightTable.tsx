'use client'

interface WeightSettings {
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
                {settings.baseWeight.toFixed(1)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Sub Months</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(months, {settings.subMonthsCap}) × {settings.subMonthsMultiplier}
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {(settings.subMonthsCap * settings.subMonthsMultiplier).toFixed(1)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Resubs</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(resubs, {settings.resubCap}) × {settings.resubMultiplier}
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {(settings.resubCap * settings.resubMultiplier).toFixed(1)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Cheer Bits</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(bits / {settings.cheerBitsDivisor}, {settings.cheerBitsCap})
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {settings.cheerBitsCap.toFixed(1)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Donations</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(cents / {settings.donationsDivisor}, {settings.donationsCap})
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {settings.donationsCap.toFixed(1)}x
              </td>
            </tr>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-3 text-gray-900 dark:text-white">Gifted Subs</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                min(count × {settings.giftedSubsMultiplier}, {settings.giftedSubsCap})
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                {settings.giftedSubsCap.toFixed(1)}x
              </td>
            </tr>
            <tr>
              <td className="py-3 text-gray-900 dark:text-white">Carry-Over</td>
              <td className="py-3 text-gray-600 dark:text-gray-400">
                Previous weight × {settings.carryOverMultiplier}
              </td>
              <td className="py-3 font-semibold text-gray-900 dark:text-white">
                Variable
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

