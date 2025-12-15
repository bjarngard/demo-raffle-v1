'use client'

import { useSession } from 'next-auth/react'
import { useWeightData } from '@/app/hooks/useWeightData'
import { formatNumber } from '@/lib/format-number'
import { getUserDisplayName } from '@/lib/user-display-name'
import { formatChancePercent } from '@/lib/format-chance'

export default function MyStatusCard() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const isSignedIn = Boolean(userId)
  const { data, status, error, lastUpdated, refetch } = useWeightData({
    enabled: isSignedIn,
    pollIntervalMs: 20_000,
  })
  const weightInfo = userId && data?.user.id === userId ? data : null
  const formattedLastUpdated = formatLastUpdated(lastUpdated ?? null)
  const chancePercent = data?.chancePercent ?? null

  if (!session?.user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-600 dark:text-gray-300">
          Sign in with Twitch to see your raffle status and bonuses.
        </p>
      </div>
    )
  }

  const shouldShowLoading = isSignedIn && !weightInfo && status !== 'error'

  if (shouldShowLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-500">Loading your raffle status…</p>
      </div>
    )
  }

  if (!weightInfo) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-500">
          {error?.message || 'Unable to load your raffle status. Please try again later.'}
        </p>
      </div>
    )
  }

  const { user, breakdown } = weightInfo
  const cheerCount = user.totalCheerBits.toString()
  const giftedSubsCount = user.totalGiftedSubs.toString()
  const loyaltyBonus = breakdown.loyalty.cappedTotal
  const supportBonus = breakdown.support.cappedTotal
  const sessionName = typeof session?.user?.name === 'string' ? session.user.name : ''
  const viewerName = getUserDisplayName({
    ...user,
    displayName: user.displayName ?? sessionName ?? null,
    username: user.username ?? sessionName ?? null,
  })

  return (
    <div className="bg-gradient-to-br from-[#EB2E70] to-[#A6178E] rounded-lg border border-white/15 shadow-lg p-6 text-white">
      <h3 className="text-2xl font-bold mb-1">My Status</h3>
      <p className="text-sm text-white/80 mb-4">Signed in as {viewerName}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <StatusBadge
          label="Follower"
          value={user.isFollower ? 'Following channel' : 'Not following yet'}
          variant={user.isFollower ? 'positive' : 'warning'}
        />
        <StatusBadge
          label="Subscriber"
          value={
            user.isSubscriber
              ? 'Subscriber bonus active'
              : 'No active subscription'
          }
          variant={user.isSubscriber ? 'positive' : 'warning'}
        />
      </div>

      {status === 'error' && error && (
        <p className="mb-3 text-sm text-gray-900 bg-bf-orange-soft rounded-md px-3 py-2">
          {error.message}
        </p>
      )}
      
      <div className="bg-white/10 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-100">Total Weight</span>
          <span className="text-3xl font-bold">{formatNumber(breakdown.totalWeight)}x</span>
        </div>
        {chancePercent !== null && !Number.isNaN(chancePercent) && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-gray-100">Current chance</span>
            <span className="text-lg font-semibold">{formatChancePercent(chancePercent)}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-gray-100">Base Weight</span>
          <span className="font-semibold">{formatNumber(breakdown.baseWeight)}x</span>
        </div>
        
        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-gray-100">Subscriber loyalty bonus</span>
          <span className="font-semibold">
            +{formatNumber(breakdown.loyalty.monthsComponent)}x
          </span>
        </div>
        {/* NOTE: We intentionally do not render a separate "Resubs" row in the viewer UI.
            Any resub-based loyalty (if used) is folded into the total loyalty bonus. */}

        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-gray-100">Total Loyalty Bonus</span>
          <span className="font-semibold">+{formatNumber(loyaltyBonus)}x</span>
        </div>
        
        {user.totalCheerBits > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-gray-100">Cheer Bits ({cheerCount})</span>
            <span className="font-semibold">+{formatNumber(breakdown.support.cheerWeight)}x</span>
          </div>
        )}
        
        {user.totalGiftedSubs > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-gray-100">
              Gifted Subs ({giftedSubsCount})
            </span>
            <span className="font-semibold">
              +{formatNumber(breakdown.support.giftedSubsWeight)}x
            </span>
          </div>
        )}

        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-gray-100">Total Support Bonus</span>
          <span className="font-semibold">+{formatNumber(supportBonus)}x</span>
        </div>
        
        {breakdown.carryOverWeight > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-gray-100">Carry-Over Weight</span>
            <span className="font-semibold">+{formatNumber(breakdown.carryOverWeight)}x</span>
          </div>
        )}
      </div>
      {formattedLastUpdated && (
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Last updated: {formattedLastUpdated}{' '}
          <button
            type="button"
            onClick={() => void refetch()}
            className="underline text-[var(--bf-lime)] hover:text-bf-primary transition-colors"
          >
            Refresh now
          </button>
        </p>
      )}

    </div>
  )
}

function StatusBadge({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant: 'positive' | 'warning'
}) {
  const styles =
    variant === 'positive'
      ? 'bg-white/20 text-white border-white/40'
      : 'bg-bf-orange-soft text-gray-900 border-[#f08e4c]'
  const labelColor = variant === 'positive' ? 'text-white/70' : 'text-gray-700'
  const valueColor = variant === 'positive' ? 'text-white' : 'text-gray-900'
  return (
    <div className={`rounded-lg border px-3 py-2 ${styles}`}>
      <p className={`text-xs uppercase tracking-wide ${labelColor}`}>{label}</p>
      <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  )
}

function formatLastUpdated(timestamp: number | null): string | null {
  if (!timestamp) {
    return null
  }

  const diff = Date.now() - timestamp
  if (diff < 0) {
    return 'just now'
  }

  const seconds = Math.round(diff / 1000)
  if (seconds < 15) {
    return 'just now'
  }
  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours} h ago`
  }

  return 'More than a day ago'
}

