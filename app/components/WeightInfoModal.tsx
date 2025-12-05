'use client'

import type { ReactNode } from 'react'
import MyStatusCard from '@/app/components/MyStatusCard'

type WeightInfoModalProps = {
  open: boolean
  onClose: () => void
}

export default function WeightInfoModal({ open, onClose }: WeightInfoModalProps) {
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
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4 text-center">
          Your odds are based on a few simple components. The card on the right shows your current weight.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <Section title="Base weight">
              <p>
                Everyone starts with the same base weight. This is the default chance you get just by entering the
                raffle.
              </p>
            </Section>
            <Section title="Subscriber">
              <p>
                If you&apos;re a subscriber, you get a loyalty bonus on top of the base weight. This bonus is static
                and doesn&apos;t increase depending on sub streaks or resubs.
              </p>
            </Section>
            <Section title="Boosts during current session">
              <p>
                Bits, gifted subs and donations increase your weight for the <strong>current</strong> raffle session
                only. When a new session starts, these support stats are reset back to zero for everyone.
              </p>
              <p className="mt-2">
                In other words: cheering and gifting helps you right now, but it does not stack across multiple sessions.
              </p>
            </Section>
            <Section title="Carry-over">
              <p>
                Carry-over is the only bonus that can persist between sessions. It&apos;s awarded based on previous
                sessions (for example, if you had entries that didn&apos;t get drawn), and it&apos;s capped so it can&apos;t
                grow forever.
              </p>
            </Section>
            <Section title="Requirements">
              <p>
                You must be logged in with Twitch and follow the channel to participate. All weights are calculated
                server-side from Twitch data.
              </p>
            </Section>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your current weight</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              This card pulls from the same API used by the admin dashboard and leaderboard.
            </p>
            <MyStatusCard />
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
      <div className="space-y-1 text-sm">{children}</div>
    </section>
  )
}

