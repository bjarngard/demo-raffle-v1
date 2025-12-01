'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminUserTable from '@/app/components/AdminUserTable'
import AdminWeightsForm from '@/app/components/AdminWeightsForm'
import RaffleWheel, { type RaffleWinner } from '@/app/components/RaffleWheel'
import TopList from '@/app/components/TopList'
import type { AdminEntry } from '@/types/admin'
import type { WeightSettings } from '@/lib/weight-settings'

type AdminWeightSettings = WeightSettings

type LeaderboardEntry = {
  id: number
  name: string
  weight: number
  probability: number
}

type DashboardSession = {
  id: string
  name?: string | null
  createdAt: string
  endedAt?: string | null
}

type AdminDashboardClientProps = {
  initialEntries: AdminEntry[]
  initialSettings: AdminWeightSettings
  initialSubmissionsOpen: boolean
  initialSession: DashboardSession | null
  lastEndedSession: DashboardSession | null
}

export default function AdminDashboardClient({
  initialEntries,
  initialSettings,
  initialSubmissionsOpen,
  initialSession,
  lastEndedSession,
}: AdminDashboardClientProps) {
  const [entries, setEntries] = useState<AdminEntry[]>(initialEntries)
  const [weightSettings, setWeightSettings] = useState<AdminWeightSettings>(initialSettings)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'weights' | 'raffle'>('users')
  const [submissionsOpen, setSubmissionsOpen] = useState(initialSubmissionsOpen)
  const [isTogglingSubmissions, setIsTogglingSubmissions] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<DashboardSession | null>(initialSession)
  const [previousSession, setPreviousSession] = useState<DashboardSession | null>(lastEndedSession)
  const [sessionActionLoading, setSessionActionLoading] = useState(false)
  const [sessionActionMessage, setSessionActionMessage] = useState<string | null>(null)

  const fetchAdminData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/dashboard', {
        cache: 'no-store',
      })

      if (response.ok) {
        const data = await response.json()
        setEntries(data.entries || [])
        if (data.settings) {
          setWeightSettings(data.settings)
        }
        if (typeof data.submissionsOpen === 'boolean') {
          setSubmissionsOpen(data.submissionsOpen)
        }
        if ('currentSession' in data) {
          setSessionInfo(data.currentSession ?? null)
        }
        if ('lastEndedSession' in data) {
          setPreviousSession(data.lastEndedSession ?? null)
        }
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleSubmissions = useCallback(
    async (nextState: boolean) => {
      setIsTogglingSubmissions(true)
      try {
        const response = await fetch('/api/admin/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionsOpen: nextState }),
        })

        if (!response.ok) {
          throw new Error('Failed to update submissions state')
        }

        const data = await response.json()
        if (typeof data.submissionsOpen === 'boolean') {
          setSubmissionsOpen(data.submissionsOpen)
        } else {
          setSubmissionsOpen(nextState)
        }

        await fetchAdminData()
      } catch (error) {
        console.error('Error toggling submissions:', error)
      } finally {
        setIsTogglingSubmissions(false)
      }
    },
    [fetchAdminData]
  )

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/leaderboard', {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data.entries || [])
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
    }
  }, [])

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(() => {
      fetchAdminData()
      fetchLeaderboard()
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchAdminData, fetchLeaderboard])

  const handleWinnerPicked = useCallback(
    (_winner: RaffleWinner) => {
      void _winner
      setTimeout(() => {
        fetchAdminData()
        fetchLeaderboard()
      }, 1000)
    },
    [fetchAdminData, fetchLeaderboard]
  )

  const raffleEntries = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        weight: entry.totalWeight,
      })),
    [entries]
  )

  const handleStartSession = useCallback(async () => {
    setSessionActionLoading(true)
    setSessionActionMessage(null)
    try {
      const response = await fetch('/api/admin/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start session')
      }

      setSessionInfo(data.session)
      setSessionActionMessage('Session started successfully.')
      await fetchAdminData()
      await fetchLeaderboard()
    } catch (error) {
      setSessionActionMessage(
        error instanceof Error ? error.message : 'Unable to start new session.'
      )
    } finally {
      setSessionActionLoading(false)
    }
  }, [fetchAdminData, fetchLeaderboard])

  const handleEndSession = useCallback(async () => {
    setSessionActionLoading(true)
    setSessionActionMessage(null)
    try {
      const response = await fetch('/api/admin/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to end session')
      }

      setSessionInfo(null)
      setPreviousSession(data.session ?? previousSession)
      setSessionActionMessage('Session ended. Carry-over applied to pending entries.')
      await fetchAdminData()
      await fetchLeaderboard()
    } catch (error) {
      setSessionActionMessage(
        error instanceof Error ? error.message : 'Unable to end the current session.'
      )
    } finally {
      setSessionActionLoading(false)
    }
  }, [fetchAdminData, fetchLeaderboard, previousSession])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <main className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Admin Panel
            </h1>
            {loading && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Refreshing...
              </span>
            )}
          </div>

          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Session Status</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {sessionInfo ? 'Active session' : 'No active session'}
                </p>
                {sessionInfo ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Started {new Date(sessionInfo.createdAt).toLocaleString()}
                    {sessionInfo.name ? ` • ${sessionInfo.name}` : ''}
                  </p>
                ) : previousSession ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Last session ended {new Date(previousSession.endedAt ?? previousSession.createdAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Start a session to begin accepting entries.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStartSession}
                  disabled={sessionInfo !== null || sessionActionLoading}
                  className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white disabled:bg-blue-300 disabled:cursor-not-allowed transition"
                >
                  Start new session
                </button>
                <button
                  type="button"
                  onClick={handleEndSession}
                  disabled={!sessionInfo || sessionActionLoading}
                  className="px-4 py-2 rounded-lg font-medium bg-amber-600 text-white disabled:bg-amber-300 disabled:cursor-not-allowed transition"
                >
                  End session
                </button>
              </div>
            </div>

            {sessionActionMessage && (
              <p className="text-sm text-gray-600 dark:text-gray-300">{sessionActionMessage}</p>
            )}
          </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Submissions Status</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {sessionInfo ? (submissionsOpen ? 'Open' : 'Paused') : 'No active session'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggleSubmissions(true)}
                  disabled={!sessionInfo || submissionsOpen || isTogglingSubmissions}
                className="px-4 py-2 rounded-lg font-medium bg-green-600 text-white disabled:bg-green-300 disabled:cursor-not-allowed transition"
              >
                Open submissions
              </button>
              <button
                type="button"
                onClick={() => toggleSubmissions(false)}
                  disabled={!sessionInfo || !submissionsOpen || isTogglingSubmissions}
                className="px-4 py-2 rounded-lg font-medium bg-orange-500 text-white disabled:bg-orange-300 disabled:cursor-not-allowed transition"
              >
                Pause submissions
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            {(['users', 'weights', 'raffle'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {tab === 'users' ? 'Users' : tab === 'weights' ? 'Weights' : 'Raffle'}
              </button>
            ))}
          </div>

          {activeTab === 'users' && (
            <AdminUserTable
              entries={entries}
              onRefresh={fetchAdminData}
            />
          )}

          {activeTab === 'weights' && (
            <AdminWeightsForm
              settings={weightSettings}
              onSettingsChange={setWeightSettings}
            />
          )}

          {activeTab === 'raffle' && (
            <div className="space-y-6">
              <RaffleWheel entries={raffleEntries} onWinnerPicked={handleWinnerPicked} />
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Top 20 for Stream Display
                </h3>
                <TopList entries={leaderboard} loading={loading} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

