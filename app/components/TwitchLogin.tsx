'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useWeightData } from '@/app/hooks/useWeightData'

export default function TwitchLogin() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const userId = session?.user?.id
  const isSignedIn = Boolean(userId)
  const { data, refetch } = useWeightData({
    enabled: isSignedIn,
    pollIntervalMs: 2 * 60 * 1000,
  })
  const userWeight = userId && data?.user.id === userId ? data.user : null

  useEffect(() => {
    if (userId) {
      void refetch()
    }
  }, [userId, refetch])

  const handleSignIn = async () => {
    setLoading(true)
    try {
      await signIn('twitch')
    } catch (error) {
      console.error('Sign in error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (session?.user) {
    return (
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name || 'User'}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full border-2 border-white object-cover"
              />
            )}
            <div>
              <h3 className="font-semibold text-lg">
                {session.user.name || 'Twitch User'}
              </h3>
              <p className="text-purple-100 text-sm">
                Logged in via Twitch
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
          >
            Sign Out
          </button>
        </div>

        {userWeight && (
          <div className="bg-white/10 rounded-lg p-4 mt-4">
            <h4 className="font-semibold mb-3">Your Raffle Stats</h4>
            <div className="mb-3 pb-3 border-b border-white/20">
              <div className="flex items-center justify-between">
                <p className="text-purple-100">Following Channel</p>
                <p className={`text-lg font-semibold ${userWeight.isFollower ? 'text-green-300' : 'text-red-300'}`}>
                  {userWeight.isFollower ? '✓ Yes' : '✗ No'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-purple-100">Total Weight</p>
                <p className="text-2xl font-bold">{userWeight.totalWeight.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-purple-100">Carry-Over Weight</p>
                <p className="text-xl font-semibold">{userWeight.carryOverWeight.toFixed(2)}x</p>
              </div>
              <div>
                <p className="text-purple-100">Subscriber</p>
                <p className="text-lg font-semibold">
                  {userWeight.isSubscriber ? '✓ Subscriber' : 'Not subscribed'}
                </p>
              </div>
              <div>
                <p className="text-purple-100">Bits Cheered</p>
                <p className="text-lg font-semibold">{userWeight.totalCheerBits.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-purple-100">Gifted Subs</p>
                <p className="text-lg font-semibold">{userWeight.totalGiftedSubs.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6 mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
        Sign in with Twitch (Required)
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        You must sign in with Twitch and follow the channel to enter the raffle.
        Your subscriptions, bits, and donations will automatically increase your chances of winning!
      </p>
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          'Connecting...'
        ) : (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
            </svg>
            Sign in with Twitch
          </>
        )}
      </button>
    </div>
  )
}

