'use client'

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { useWeightData } from '@/app/hooks/useWeightData'

type WeightInfoModalProps = {
  open: boolean
  onClose: () => void
}

export default function WeightInfoModal({ open, onClose }: WeightInfoModalProps) {
  const { data, status, error } = useWeightData({
    enabled: open,
    pollIntervalMs: 60_000,
  })
  const settings = data?.settings

  const ruleRows = useMemo(() => {
    if (!settings) {
      return [
        {
          title: 'Base weight',
          children: 'Everyone starts with the same base weight each session.',
        },
        {
          title: 'Subscriber status',
          children: 'Active subscribers receive a static bonus on top of the base weight.',
        },
        {
          title: 'Bits (cheers)',
          children: 'Cheering bits increases your weight for the current session only.',
        },
        {
          title: 'Gifted subs',
          children: 'Gifting subs provides a per-gift bonus during the active session.',
        },
        {
          title: 'Carry-over',
          children:
            'Carry-over is the only bonus that persists between sessions, based on previous non-winning entries.',
        },
      ]
    }

    const format = (value: number) => value.toFixed(2)
    const loyaltyPerMonth = settings.subMonthsMultiplier
    const bitsDivisor = settings.cheerBitsDivisor
    const bitsCap = settings.cheerBitsCap
    const supportCap = settings.supportMaxBonus
    const giftMultiplier = settings.giftedSubsMultiplier
    const giftCap = settings.giftedSubsCap
    const carryPercent = Math.round(settings.carryOverMultiplier * 100)
    const carryCap = settings.carryOverMaxBonus

    return [
      {
        title: 'Base weight',
        children: `Everyone starts at ${format(settings.baseWeight)}× each session.`,
      },
      {
        title: 'Subscriber status',
        children: `Active subscribers get a static bonus: +${format(loyaltyPerMonth)}× applied once (we treat all subs as having at least 1 month).`,
      },
      {
        title: 'Bits (cheers)',
        children: `Every ${bitsDivisor.toLocaleString()} bits adds +1.00× (capped at +${format(
          bitsCap
        )}× from bits and +${format(supportCap)}× from all support this session).`,
      },
      {
        title: 'Gifted subs',
        children: `Each gifted sub adds +${format(giftMultiplier)}×, capped at +${format(giftCap)}× per session.`,
      },
      {
        title: 'Carry-over',
        children: `If your entry doesn't win, ${carryPercent}% of that session's weight becomes carry-over (capped at +${format(
          carryCap
        )}×) and is the only bonus that persists into the next session.`,
      },
    ]
  }, [settings])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Raffle weight information"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 md:p-8 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3 text-center">
          How your raffle weight works
        </h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-6 text-center">
          Your odds come from a few capped components. Everything except carry-over resets at the start of each new
          session.
        </p>

        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
          {ruleRows.map((row) => (
            <RuleSection key={row.title} title={row.title}>
              {row.children}
            </RuleSection>
          ))}
        </div>

        <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
          {status === 'error' && error ? (
            <p>{error.message}</p>
          ) : (
            <p>
              Values shown above come directly from the live raffle settings. You must be logged in with Twitch and
              follow the channel to participate.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function RuleSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
      <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
      <p>{children}</p>
    </section>
  )
}
