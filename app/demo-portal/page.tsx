'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import TwitchLogin from '@/app/components/TwitchLogin'
import DemoSubmissionForm from '@/app/components/DemoSubmissionForm'
import MyStatusCard from '@/app/components/MyStatusCard'
import TopList from '@/app/components/TopList'
import WeightTable from '@/app/components/WeightTable'

interface LeaderboardEntry {
  id: number
  name: string
  weight: number
  probability: number
}

interface LeaderboardData {
  submissionsOpen: boolean
  totalEntries: number
  entries: LeaderboardEntry[]
}

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

function DemoPortalContent() {
  const { data: session, status } = useSession()
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null)
  const [weightSettings, setWeightSettings] = useState<WeightSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
    fetchWeightSettings()
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchLeaderboard()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard')
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data)
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchWeightSettings = async () => {
    try {
      const response = await fetch('/api/admin/weight-settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setWeightSettings(data.settings)
        }
      }
    } catch (error) {
      console.error('Error fetching weight settings:', error)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <main className="max-w-7xl mx-auto">
        {/* Status Banner */}
        {leaderboard && (
          <div
            className={`mb-6 rounded-lg shadow-lg p-4 ${
              leaderboard.submissionsOpen
                ? 'bg-green-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-green-300' : 'bg-red-300'
                } animate-pulse`}
              ></div>
              <h2 className="text-3xl font-bold">
                {leaderboard.submissionsOpen
                  ? '🟢 SUBMISSIONS OPEN'
                  : '🔴 SUBMISSIONS CLOSED'}
              </h2>
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-green-300' : 'bg-red-300'
                } animate-pulse`}
              ></div>
            </div>
            <p className="text-center text-lg mt-2 opacity-90">
              {leaderboard.totalEntries}{' '}
              {leaderboard.totalEntries === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
        )}

        {/* Login Section */}
        <div className="mb-6">
          <TwitchLogin />
        </div>

        {/* Main Content Grid */}
        {session?.user ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Submission Form & Status */}
            <div className="lg:col-span-2 space-y-6">
              {/* Submission Form */}
              {leaderboard?.submissionsOpen && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    Submit Your Demo
                  </h2>
                  <DemoSubmissionForm />
                </div>
              )}

              {/* My Status */}
              <MyStatusCard />

              {/* Weight Table */}
              {weightSettings && <WeightTable settings={weightSettings} />}
            </div>

            {/* Right Column: Leaderboard */}
            <div>
              {leaderboard && (
                <TopList entries={leaderboard.entries} loading={loading} />
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Please Sign In
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in with Twitch to view your status and submit a demo
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function DemoPortal() {
  return (
    <SessionProvider>
      <DemoPortalContent />
    </SessionProvider>
  )
}

