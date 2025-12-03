'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import type { WeightBreakdown, WeightSettings } from '@/lib/weight-settings'

type WeightResponse = {
  user: {
    id: string
    username: string
    displayName: string
    isFollower: boolean
    isSubscriber: boolean
    subMonths: number
    resubCount: number
    totalCheerBits: number
    totalDonations: number
    totalGiftedSubs: number
    carryOverWeight: number
    totalWeight: number
  }
  breakdown: WeightBreakdown
  settings: WeightSettings
}

export default function MyStatusCard() {
  const { data: session } = useSession()
  const [weightInfo, setWeightInfo] = useState<WeightResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const initialLoadRef = useRef(true)

  const fetchWeightInfo = useCallback(async () => {
    if (!session?.user?.id) return
    const isInitial = initialLoadRef.current
    if (isInitial) {
      setLoading(true)
    }
    try {
      const response = await fetch('/api/weight/me', { cache: 'no-store' })
      if (!response.ok) {
        if (response.status === 401) {
          setWeightInfo(null)
          setError('You must be signed in to view your raffle status.')
        } else {
          setError('Unable to load your weight breakdown right now.')
        }
        return
      }
      const data: WeightResponse = await response.json()
      setWeightInfo(data)
      setError(null)
    } catch (error) {
      console.error('Error fetching user weight:', error)
      setError('Unable to load your weight breakdown right now.')
    } finally {
      if (isInitial) {
        setLoading(false)
        initialLoadRef.current = false
      }
    }
  }, [session?.user?.id])

  // UI display (C): poll the canonical weight API, never recompute client-side.
  useEffect(() => {
    if (!session?.user?.id) {
      setWeightInfo(null)
      setError('Sign in with Twitch to view your raffle status.')
      setLoading(false)
      initialLoadRef.current = true
      return
    }

    initialLoadRef.current = true
    setLoading(true)
    fetchWeightInfo()
    const interval = setInterval(fetchWeightInfo, 30 * 1000)
    return () => clearInterval(interval)
  }, [session?.user?.id, fetchWeightInfo])

  if (!session?.user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-600 dark:text-gray-300">
          Sign in with Twitch to see your raffle status and bonuses.
        </p>
      </div>
    )
  }

  if (loading) {
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
          {error || 'Unable to load your raffle status. Please try again later.'}
        </p>
      </div>
    )
  }

  const { user, breakdown } = weightInfo
  const donationsDollars = user.totalDonations / 100
  const cheerCount = user.totalCheerBits.toLocaleString()
  const donationCount = donationsDollars.toFixed(2)
  const giftedSubsCount = user.totalGiftedSubs.toLocaleString()
  const loyaltyBonus = breakdown.loyalty.cappedTotal
  const supportBonus = breakdown.support.cappedTotal

  return (
    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
      <h3 className="text-2xl font-bold mb-4">My Status</h3>

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

      {error && (
        <p className="mb-3 text-sm text-amber-100 bg-amber-500/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      
      <div className="bg-white/10 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-purple-100">Total Weight</span>
          <span className="text-3xl font-bold">{breakdown.totalWeight.toFixed(2)}x</span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-purple-100">Base Weight</span>
          <span className="font-semibold">{breakdown.baseWeight.toFixed(2)}x</span>
        </div>
        
        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-purple-100">
            {user.isSubscriber
              ? `Subscriber loyalty (tracked months: ${Math.max(1, user.subMonths)})`
              : 'Subscriber loyalty'}
          </span>
          <span className="font-semibold">
            +{breakdown.loyalty.monthsComponent.toFixed(2)}x
          </span>
        </div>
        
        {user.resubCount > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Resubs ({user.resubCount})
            </span>
            <span className="font-semibold">+{breakdown.loyalty.resubComponent.toFixed(2)}x</span>
          </div>
        )}

        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-purple-100">Total Loyalty Bonus</span>
          <span className="font-semibold">+{loyaltyBonus.toFixed(2)}x</span>
        </div>
        
        {user.totalCheerBits > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">Cheer Bits ({cheerCount})</span>
            <span className="font-semibold">+{breakdown.support.cheerWeight.toFixed(2)}x</span>
          </div>
        )}
        
        {user.totalDonations > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Donations (${donationCount})
            </span>
            <span className="font-semibold">
              +{breakdown.support.donationsWeight.toFixed(2)}x
            </span>
          </div>
        )}
        
        {user.totalGiftedSubs > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Gifted Subs ({giftedSubsCount})
            </span>
            <span className="font-semibold">
              +{breakdown.support.giftedSubsWeight.toFixed(2)}x
            </span>
          </div>
        )}

        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-purple-100">Total Support Bonus</span>
          <span className="font-semibold">+{supportBonus.toFixed(2)}x</span>
        </div>
        
        {breakdown.carryOverWeight > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">Carry-Over Weight</span>
            <span className="font-semibold">+{breakdown.carryOverWeight.toFixed(2)}x</span>
          </div>
        )}
      </div>

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
      : 'bg-amber-500/20 text-amber-100 border-amber-300/40'
  const labelColor = variant === 'positive' ? 'text-white/70' : 'text-amber-200/80'
  const valueColor = variant === 'positive' ? 'text-white' : 'text-amber-100'
  return (
    <div className={`rounded-lg border px-3 py-2 ${styles}`}>
      <p className={`text-xs uppercase tracking-wide ${labelColor}`}>{label}</p>
      <p className={`text-sm font-semibold ${valueColor}`}>{value}</p>
    </div>
  )
}

