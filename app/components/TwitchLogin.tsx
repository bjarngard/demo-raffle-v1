'use client'

import { signIn, signOut, useSession } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useWeightData } from '@/app/hooks/useWeightData'
import { formatNumber } from '@/lib/format-number'
import { getUserDisplayName } from '@/lib/user-display-name'
import { formatChancePercent } from '@/lib/format-chance'

const SIGN_IN_TTL_MS = 30_000

export default function TwitchLogin() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const signInStartedRef = useRef(false)
  const userId = session?.user?.id
  const isSignedIn = Boolean(userId)
  const { data } = useWeightData({
    enabled: isSignedIn,
    pollIntervalMs: 2 * 60 * 1000,
  })
  const userWeight = userId && data?.user.id === userId ? data.user : null
  const chancePercent = data?.chancePercent ?? null
  const viewerName = userWeight
    ? getUserDisplayName(userWeight)
    : getUserDisplayName({
        displayName: session?.user?.name ?? null,
        username: session?.user?.name ?? null,
        id: session?.user?.id ?? null,
      })

  useEffect(() => {
    if (status === 'authenticated') {
      try {
        sessionStorage.removeItem('twitchSignInInFlight')
      } catch {
        // ignore storage failures
      }
      signInStartedRef.current = false
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'unauthenticated') return

    let ageOk = false
    try {
      const tsStr = sessionStorage.getItem('twitchSignInInFlight')
      if (tsStr) {
        const age = Date.now() - Number(tsStr)
        ageOk = !Number.isNaN(age) && age >= SIGN_IN_TTL_MS
      }
    } catch {
      // ignore storage failures
    }

    // Only clear on TTL expiry; unauthenticated can be transient mid-redirect.
    if (!ageOk) return

    // Allow retry if a sign-in attempt was started but did not complete.
    signInStartedRef.current = false
    setLoading(false)
    try {
      sessionStorage.removeItem('twitchSignInInFlight')
    } catch {
      // ignore storage failures
    }
  }, [status])

  useEffect(() => {
    // If we return with ?error= from the auth redirect, clear in-flight lock so user can retry.
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.has('error') && status !== 'authenticated') {
      signInStartedRef.current = false
      setLoading(false)
      try {
        sessionStorage.removeItem('twitchSignInInFlight')
      } catch {
        // ignore storage failures
      }
      try {
        window.history.replaceState({}, '', window.location.pathname)
      } catch {
        // ignore history failures
      }
    }
  }, [status])

  const handleSignIn = async () => {
    if (loading || signInStartedRef.current) {
      return
    }

    try {
      const existingTs = sessionStorage.getItem('twitchSignInInFlight')
      if (existingTs) {
        const delta = Date.now() - Number(existingTs)
        if (!Number.isNaN(delta) && delta < SIGN_IN_TTL_MS) {
          return
        }
      }
    } catch {
      // ignore storage failures
    }

    signInStartedRef.current = true
    setLoading(true)
    try {
      sessionStorage.setItem('twitchSignInInFlight', Date.now().toString())
    } catch {
      // ignore storage failures
    }

    try {
      await signIn('twitch', {
        callbackUrl: new URL('/', window.location.href).toString(),
      })
      // Normal path redirects; effect will clear guards on auth.
    } catch (error) {
      console.error('Sign in error:', error)
      // Allow retry on failure
      signInStartedRef.current = false
      try {
        sessionStorage.removeItem('twitchSignInInFlight')
      } catch {
        // ignore storage failures
      }
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
      try {
        sessionStorage.removeItem('twitchSignInInFlight')
      } catch {
        // ignore storage failures
      }
      signInStartedRef.current = false
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
      <div className="bg-gradient-to-r from-[#EB2E70] to-[#A6178E] rounded-lg p-6 mb-6 text-white border border-white/15 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={viewerName}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full border-2 border-white object-cover"
              />
            )}
            <div>
              <h3 className="font-semibold text-lg">
                {viewerName}
              </h3>
              <p className="text-gray-100 text-sm">
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
                <p className="text-gray-100">Following Channel</p>
                <p className={`text-lg font-semibold ${userWeight.isFollower ? 'text-bf-lime' : 'text-bf-orange'}`}>
                  {userWeight.isFollower ? '✓ Yes' : '✗ No'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-100">Total Weight</p>
                <p className="text-2xl font-bold">{formatNumber(userWeight.totalWeight)}x</p>
              </div>
              {chancePercent !== null && !Number.isNaN(chancePercent) && (
                <div>
                  <p className="text-gray-100">Current chance</p>
                  <p className="text-2xl font-bold">
                    {formatChancePercent(chancePercent)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-gray-100">Carry-Over Weight</p>
                <p className="text-2xl font-bold">{formatNumber(userWeight.carryOverWeight)}x</p>
              </div>
              <div>
                <p className="text-gray-100">Subscriber</p>
                <p className="text-lg font-semibold">
                  {userWeight.isSubscriber ? '✓ Subscriber' : 'Not subscribed'}
                </p>
              </div>
              <div>
                <p className="text-gray-100">Bits Cheered</p>
                <p className="text-lg font-semibold">{userWeight.totalCheerBits}</p>
              </div>
              <div>
                <p className="text-gray-100">Gifted Subs</p>
                <p className="text-lg font-semibold">{userWeight.totalGiftedSubs}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--bf-lime)] bg-[#0f1d28] text-gray-100 p-6 mb-6 shadow-md shadow-black/20">
      <h3 className="font-semibold text-gray-100 mb-2">Sign in with Twitch (Required)</h3>
      <p className="text-sm text-gray-200 mb-4">
        Your subscriber status, bits, and gifted subs will automatically increase your chances of winning.
      </p>
      <button
        onClick={handleSignIn}
        disabled={loading}
        aria-disabled={loading}
        className="w-full bg-bf-primary hover:bg-bf-primary-dark text-white py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none flex items-center justify-center gap-2"
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

