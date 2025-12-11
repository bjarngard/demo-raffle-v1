'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import AmbientBackground from '@/app/components/AmbientBackground'
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
  sessionId: string | null
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
  carryOverMaxBonus: number
  loyaltyMaxBonus: number
  supportMaxBonus: number
}

interface WinnerData {
  id: number
  name: string
}

function DemoPortalContent() {
  const { data: session, status } = useSession()
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null)
  const [weightSettings, setWeightSettings] = useState<WeightSettings | null>(null)
  const [winner, setWinner] = useState<WinnerData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard()
    fetchLatestWinner()
    fetchWeightSettings()
    
    // Poll for updates every 5 seconds
    const interval = setInterval(() => {
      fetchLeaderboard()
      fetchLatestWinner()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' })
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

  const fetchLatestWinner = async () => {
    try {
      const response = await fetch('/api/winner', { cache: 'no-store' })
      if (!response.ok) {
        return
      }
      const data = await response.json()
      setWinner(data.winner ?? null)
    } catch (error) {
      console.error('Error fetching latest winner:', error)
    }
  }

  if (status === 'loading') {
    return (
      <AmbientBackground contentClassName="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </AmbientBackground>
    )
  }

  return (
    <AmbientBackground contentClassName="min-h-screen py-6 px-4">
      <main className="max-w-7xl mx-auto">
        {/* Status Banner */}
        {leaderboard && Boolean(leaderboard.sessionId) && (
          <div
            className={`mb-6 rounded-lg shadow-lg p-4 ${
              leaderboard.submissionsOpen ? 'bg-bf-lime-soft text-gray-900 border border-[#c4cf48]' : 'bg-bf-orange-soft text-gray-900 border border-[#f08e4c]'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-[#d8e86a]' : 'bg-[#f7b485]'
                } animate-pulse`}
              ></div>
              <h2 className="text-3xl font-bold">
                {leaderboard.submissionsOpen ? 'Submissions open' : 'Submissions paused'}
              </h2>
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-[#d8e86a]' : 'bg-[#f7b485]'
                } animate-pulse`}
              ></div>
            </div>
            <p className="text-center text-lg mt-2 opacity-90">
              {leaderboard.totalEntries}{' '}
              {leaderboard.totalEntries === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
        )}

        {/* Inline status for session/submissions */}
        {leaderboard && !leaderboard.sessionId && (
          <div className="mb-6 rounded-lg bg-bf-orange-soft border border-[#f08e4c] shadow p-4 text-gray-900">
            No active session is running right now. Please check back later.
          </div>
        )}

        {leaderboard && leaderboard.sessionId && !leaderboard.submissionsOpen && (
          <div className="mb-6 rounded-lg bg-bf-orange-soft border border-[#f08e4c] shadow p-4 text-gray-900">
            {winner ? (
              <p>
                Submissions are currently paused. Latest winner:{' '}
                <span className="font-semibold text-bf-primary">
                  {winner.name}
                </span>
                .
              </p>
            ) : (
              <p>Submissions are currently paused.</p>
            )}
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
              <div className="bg-white dark:bg-[#0b1722] rounded-lg shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Submit Your Demo
                </h2>
                <DemoSubmissionForm
                  submissionsOpen={leaderboard?.submissionsOpen === true}
                  sessionActive={Boolean(leaderboard?.sessionId)}
                />
              </div>

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
          <div className="bg-white dark:bg-[#0b1722] rounded-lg shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Please Sign In
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Sign in with Twitch to view your status and submit a demo
            </p>
          </div>
        )}
      </main>
    </AmbientBackground>
  )
}

export default function DemoPortal() {
  return (
    <SessionProvider>
      <DemoPortalContent />
    </SessionProvider>
  )
}

