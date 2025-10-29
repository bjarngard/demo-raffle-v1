'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface UserWeight {
  id: string
  username: string
  displayName: string
  isFollower: boolean
  isSubscriber: boolean
  subMonths: number
  totalCheerBits: number
  totalDonations: number
  resubCount: number
  totalGiftedSubs: number
  totalWeight: number
  carryOverWeight: number
}

export default function MyStatusCard() {
  const { data: session } = useSession()
  const [userWeight, setUserWeight] = useState<UserWeight | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserWeight()
      const interval = setInterval(fetchUserWeight, 10000) // Poll every 10s
      return () => clearInterval(interval)
    }
  }, [session])

  const fetchUserWeight = async () => {
    try {
      const response = await fetch('/api/twitch/sync', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setUserWeight(data.user)
      }
    } catch (error) {
      console.error('Error fetching user weight:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!session?.user) {
    return null
  }

  if (loading || !userWeight) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-500">Loading status...</p>
      </div>
    )
  }

  // Calculate weight breakdown (mirrors backend logic)
  const baseWeight = 1.0
  const subMonthsCapped = Math.min(userWeight.subMonths, 10)
  const subMonthsWeight = userWeight.isSubscriber ? subMonthsCapped * 0.1 : 0
  const resubCountCapped = Math.min(userWeight.resubCount, 5)
  const resubWeight = resubCountCapped * 0.2
  const cheerWeight = Math.min(userWeight.totalCheerBits / 1000, 5.0)
  const donationWeight = Math.min(userWeight.totalDonations / 1000, 5.0)
  const giftedSubsWeight = Math.min(userWeight.totalGiftedSubs * 0.1, 5.0)
  const carryOver = userWeight.carryOverWeight

  return (
    <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
      <h3 className="text-2xl font-bold mb-4">My Status</h3>
      
      <div className="bg-white/10 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-purple-100">Total Weight</span>
          <span className="text-3xl font-bold">{userWeight.totalWeight.toFixed(2)}x</span>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
          <span className="text-purple-100">Base Weight</span>
          <span className="font-semibold">{baseWeight.toFixed(2)}x</span>
        </div>
        
        {userWeight.isSubscriber && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Subscriber ({subMonthsCapped}/{userWeight.subMonths} months)
            </span>
            <span className="font-semibold">+{subMonthsWeight.toFixed(2)}x</span>
          </div>
        )}
        
        {userWeight.resubCount > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Resubs ({resubCountCapped}/{userWeight.resubCount})
            </span>
            <span className="font-semibold">+{resubWeight.toFixed(2)}x</span>
          </div>
        )}
        
        {userWeight.totalCheerBits > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Cheer Bits ({userWeight.totalCheerBits.toLocaleString()})
            </span>
            <span className="font-semibold">+{cheerWeight.toFixed(2)}x</span>
          </div>
        )}
        
        {userWeight.totalDonations > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Donations (${(userWeight.totalDonations / 100).toFixed(2)})
            </span>
            <span className="font-semibold">+{donationWeight.toFixed(2)}x</span>
          </div>
        )}
        
        {userWeight.totalGiftedSubs > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">
              Gifted Subs ({userWeight.totalGiftedSubs})
            </span>
            <span className="font-semibold">+{giftedSubsWeight.toFixed(2)}x</span>
          </div>
        )}
        
        {carryOver > 0 && (
          <div className="flex justify-between items-center bg-white/10 rounded px-3 py-2">
            <span className="text-purple-100">Carry-Over Weight</span>
            <span className="font-semibold">+{carryOver.toFixed(2)}x</span>
          </div>
        )}
      </div>
    </div>
  )
}

