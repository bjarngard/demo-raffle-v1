'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import type { WeightBreakdown, WeightSettings } from '@/lib/weight-settings'

type WeightResponse = {
  user: {
    id: string
    username: string
    displayName: string
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

  useEffect(() => {
    if (!session?.user?.id) return
    fetchWeightInfo()
    const interval = setInterval(fetchWeightInfo, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [session?.user?.id])

  const fetchWeightInfo = async () => {
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
      setLoading(false)
    }
  }

  if (!session?.user) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-500">Loading status...</p>
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

  return (
    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
      <h3 className="text-2xl font-bold mb-4">My Status</h3>
      
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
        
        {user.isSubscriber && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Subscriber ({user.subMonths} months)
            </span>
            <span className="font-semibold">+{breakdown.loyalty.monthsComponent.toFixed(2)}x</span>
          </div>
        )}
        
        {user.resubCount > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Resubs ({user.resubCount})
            </span>
            <span className="font-semibold">+{breakdown.loyalty.resubComponent.toFixed(2)}x</span>
          </div>
        )}
        
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

