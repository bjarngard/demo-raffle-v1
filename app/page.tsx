'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import TwitchLogin from './components/TwitchLogin'

interface Winner {
  id: number
  name: string
}

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

function RaffleForm() {
  const { data: session, status } = useSession()
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingWinner, setLoadingWinner] = useState(true)
  const [winner, setWinner] = useState<Winner | null>(null)
  const [isFollower, setIsFollower] = useState<boolean | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)
  const [sessionOverride, setSessionOverride] = useState<boolean | null>(null)
  const [submissionsOverride, setSubmissionsOverride] = useState<boolean | null>(null)
  const sessionActive = leaderboard?.sessionId ? true : false
  const submissionsOpen = leaderboard?.submissionsOpen === true
  const effectiveSessionActive = sessionOverride ?? sessionActive
  const effectiveSubmissionsOpen = submissionsOverride ?? submissionsOpen
  const submissionsClosed = !effectiveSubmissionsOpen

  const checkFollowStatus = useCallback(async () => {
    if (!session?.user?.id) return
    try {
      const response = await fetch('/api/twitch/check-follow', {
        method: 'POST',
      })
      if (response.ok) {
        const data = await response.json()
        setIsFollower(data.isFollower)
      }
    } catch (error) {
      console.error('Error checking follow status:', error)
    }
  }, [session?.user?.id])

  // Fetch winner and leaderboard on page load
  useEffect(() => {
    async function fetchWinner() {
      try {
        const response = await fetch('/api/winner')
        
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          console.error('API did not return JSON:', await response.text())
          setLoadingWinner(false)
          return
        }
        
        const data = await response.json()
        if (data.winner) {
          setWinner(data.winner)
        }
      } catch (error) {
        console.error('Could not fetch winner:', error)
      } finally {
        setLoadingWinner(false)
      }
    }

    async function fetchLeaderboard() {
      try {
        const response = await fetch('/api/leaderboard')
        if (response.ok) {
          const data = await response.json()
          setLeaderboard(data)
        }
      } catch (error) {
        console.error('Could not fetch leaderboard:', error)
      } finally {
        setLoadingLeaderboard(false)
      }
    }

    fetchWinner()
    fetchLeaderboard()

    // Refresh leaderboard every 5 seconds for live updates
    const interval = setInterval(fetchLeaderboard, 5000)

    // Check follow status if logged in
    if (session?.user?.id) {
      checkFollowStatus()
    }

    return () => clearInterval(interval)
  }, [session, checkFollowStatus])

  useEffect(() => {
    setSessionOverride(null)
  }, [leaderboard?.sessionId])

  useEffect(() => {
    setSubmissionsOverride(null)
  }, [leaderboard?.submissionsOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!effectiveSessionActive) {
      setError('The raffle is not currently running. Please check back later.')
      setSessionOverride(false)
      return
    }

    if (submissionsClosed) {
      setError('Submissions are currently closed. Please try again later.')
      setSubmissionsOverride(false)
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() || undefined }),
      })

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('API did not return JSON:', text)
        setError('An unexpected error occurred. Please try again later.')
        return
      }

      const data = await response.json()

      if (!response.ok) {
        const errorCode = data.errorCode || data.error
        if (errorCode === 'NO_ACTIVE_SESSION') {
          setSessionOverride(false)
          setError('The raffle is not currently running. Please try again later.')
        } else if (errorCode === 'SUBMISSIONS_CLOSED') {
          setSubmissionsOverride(false)
          setError('Submissions are currently closed. Please try again later.')
        } else if (errorCode === 'EMAIL_ALREADY_REGISTERED') {
          setError('This email is already registered for this round.')
        } else if (errorCode === 'ALREADY_SUBMITTED_THIS_SESSION' || data.error === 'You already have an active submission') {
          setError('You already have an active submission for this session.')
        } else if (errorCode === 'PENDING_ENTRY_FROM_PREVIOUS_SESSION') {
          setError('You already have a pending submission with accumulated weight. It must be drawn before you can submit again.')
        } else if (errorCode === 'NOT_FOLLOWING') {
          setError('You need to follow the channel on Twitch before entering.')
        } else {
          setError(data.error || 'An error occurred')
        }
        return
      }

      if (data.success) {
        setSubmitted(true)
        setName('')
      } else {
        setError(data.error || 'An error occurred')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      setError('An error occurred during registration')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loadingWinner || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <main className="w-full max-w-2xl px-6 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  // REQUIRE login - show login prompt if not logged in
  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <main className="w-full max-w-2xl px-6 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              Welcome to the raffle! 🎲
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              You must sign in with Twitch and follow the channel to enter
            </p>

            <TwitchLogin />

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-6">
              <p className="text-sm text-yellow-800 dark:text-yellow-300 text-center">
                <strong>⚠️ Requirements:</strong> You must be logged in with Twitch and follow the channel to participate in the raffle.
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // User is logged in - check if they follow
  if (isFollower === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <main className="w-full max-w-2xl px-6 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              Follow Required ❤️
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              You must follow the channel to enter the raffle
            </p>

            <TwitchLogin />

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mt-6 text-center">
              <p className="text-red-800 dark:text-red-300 font-semibold mb-2">
                You are not following this channel
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">
                Please follow the channel on Twitch and refresh this page to enter the raffle.
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // User is logged in and follows - show entry form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-6 px-4">
      <main className="max-w-7xl mx-auto">
        {/* Status Banner */}
        {leaderboard && (
          <div
            className={`mb-6 rounded-lg shadow-lg p-4 ${
              leaderboard.submissionsOpen ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-green-300' : 'bg-orange-300'
                } animate-pulse`}
              ></div>
              <h2 className="text-3xl font-bold">
                {leaderboard.submissionsOpen ? 'Submissions open' : 'Submissions paused'}
              </h2>
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-green-300' : 'bg-orange-300'
                } animate-pulse`}
              ></div>
            </div>
            <p className="text-center text-lg mt-2 opacity-90">
              {leaderboard.totalEntries} {leaderboard.totalEntries === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
        )}

        {leaderboard && !leaderboard.sessionId && (
          <div className="mb-6 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 shadow p-4 text-yellow-900 dark:text-yellow-100">
            The raffle is not currently running. Please check back later.
          </div>
        )}

        {leaderboard && leaderboard.sessionId && !leaderboard.submissionsOpen && (
          <div className="mb-6 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow p-4 text-gray-800 dark:text-gray-100">
            {winner ? (
              <p>
                Submissions are currently paused. Latest winner:{' '}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {winner.name}
                </span>
                .
              </p>
            ) : (
              <p>Submissions are currently paused.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Entry Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              Welcome to the raffle! 🎲
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              Enter below to participate
            </p>

          <TwitchLogin />

          {submitted ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Thank you for entering!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                You are now registered. Good luck! 🍀
              </p>
            </div>
          ) : !effectiveSessionActive ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M4.93 4.93l14.14 14.14"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                The raffle is paused
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                The broadcaster hasn&apos;t started a new session yet. Please check back during the next stream.
              </p>
            </div>
          ) : submissionsClosed ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M12 8v.01"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Submissions are closed
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                The broadcaster has closed submissions for now. Please check back when the next round opens.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder={session.user.name || 'Your display name'}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  If left empty, your Twitch display name will be used
                </p>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Entering...' : 'Enter Raffle'}
              </button>
            </form>
          )}
          </div>

          {/* Right Column: Top 20 Leaderboard */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
              📊 Top 20 Leaderboard
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center">
              Win probability based on weights
            </p>

            {loadingLeaderboard ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading leaderboard...</p>
              </div>
            ) : leaderboard && leaderboard.entries.length > 0 ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {leaderboard.entries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-8 text-center">
                        <span className="font-bold text-lg text-gray-700 dark:text-gray-300">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {entry.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Weight: {entry.weight.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                          {entry.probability.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No entries yet. Be the first to enter!
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <SessionProvider>
      <RaffleForm />
    </SessionProvider>
  )
}
