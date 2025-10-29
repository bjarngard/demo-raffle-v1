'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminUserTable from '@/app/components/AdminUserTable'
import AdminWeightsForm from '@/app/components/AdminWeightsForm'
import RaffleWheel from '@/app/components/RaffleWheel'
import TopList from '@/app/components/TopList'
import { useAdminAuth } from '@/app/hooks/useAdminAuth'

interface Entry {
  id: number
  name: string
  username: string
  displayName: string
  demoLink: string | null
  totalWeight: number
  weightBreakdown: {
    base: number
    subMonths: number
    resubCount: number
    cheerBits: number
    donations: number
    giftedSubs: number
    carryOver: number
  }
  createdAt: string
  userId: string | null
}

interface LeaderboardEntry {
  id: number
  name: string
  weight: number
  probability: number
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

type Tab = 'users' | 'weights' | 'raffle'

export default function DemoAdminPage() {
  const router = useRouter()
  const { authenticated, loading: authLoading, login, logout } = useAdminAuth()
  const [password, setPassword] = useState('')
  const [adminToken, setAdminToken] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('users')

  // Data state
  const [entries, setEntries] = useState<Entry[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [weightSettings, setWeightSettings] = useState<WeightSettings | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.trim() !== '' && adminToken.trim() !== '') {
      const result = await login(adminToken.trim())
      if (result.success) {
        setError('')
        setPassword('')
        // Keep token in state for API calls (cookie is set)
        fetchData()
      } else {
        setError(result.error || 'Invalid credentials')
      }
    } else {
      setError('Please enter both password and admin token')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch entries (cookie is automatically sent)
      const entriesResponse = await fetch('/api/admin/entries')
      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json()
        setEntries(entriesData.entries || [])
      }

      // Fetch leaderboard
      const leaderboardResponse = await fetch('/api/leaderboard')
      if (leaderboardResponse.ok) {
        const leaderboardData = await leaderboardResponse.json()
        setLeaderboard(leaderboardData.entries || [])
      }

      // Fetch weight settings (cookie is automatically sent)
      const settingsResponse = await fetch('/api/admin/weight-settings')
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        setWeightSettings(settingsData.settings || null)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authenticated) {
      fetchData()
      const interval = setInterval(fetchData, 10000) // Poll every 10s
      return () => clearInterval(interval)
    }
  }, [authenticated, adminToken])

  const handleWinnerPicked = (winner: any) => {
    // Refresh data after winner is picked
    setTimeout(() => {
      fetchData()
    }, 1000)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <main className="w-full max-w-md px-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
              Admin Login
            </h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder="Enter admin password"
                />
              </div>
              <div>
                <label
                  htmlFor="adminToken"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Admin Token
                </label>
                <input
                  type="password"
                  id="adminToken"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder="Enter ADMIN_TOKEN"
                />
              </div>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Log in
              </button>
            </form>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
              NOTE: Real security is enforced by API endpoints requiring ADMIN_TOKEN
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <main className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Admin Panel
          </h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'users'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('weights')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'weights'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Weights
            </button>
            <button
              onClick={() => setActiveTab('raffle')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'raffle'
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Raffle
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'users' && (
            <AdminUserTable
              entries={entries}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'weights' && weightSettings && (
            <AdminWeightsForm settings={weightSettings} />
          )}

          {activeTab === 'raffle' && (
            <div className="space-y-6">
              <RaffleWheel
                entries={entries.map((e) => ({
                  id: e.id,
                  name: e.name,
                  weight: e.totalWeight,
                }))}
                onWinnerPicked={handleWinnerPicked}
              />
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

