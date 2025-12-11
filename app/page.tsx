'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionProvider, useSession } from 'next-auth/react'
import TwitchLogin from './components/TwitchLogin'
import WeightInfoModal from './components/WeightInfoModal'

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
  const [demoLink, setDemoLink] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingWinner, setLoadingWinner] = useState(true)
  const [winner, setWinner] = useState<Winner | null>(null)
  const [followStatus, setFollowStatus] = useState<'checking' | 'following' | 'not_following' | 'unknown' | null>(null)
  const [followReason, setFollowReason] = useState<string | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)
  const [sessionOverride, setSessionOverride] = useState<boolean | null>(null)
  const [submissionsOverride, setSubmissionsOverride] = useState<boolean | null>(null)
  const [weightInfoOpen, setWeightInfoOpen] = useState(false)
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
      if (!response.ok) {
        setFollowStatus('unknown')
        setFollowReason('network_error')
        return
      }
      const data = await response.json()
      setFollowStatus(data.status ?? 'unknown')
      setFollowReason(data.reason ?? null)
    } catch (error) {
      console.error('Error checking follow status:', error)
      setFollowStatus('unknown')
      setFollowReason('network_error')
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
        const response = await fetch('/api/leaderboard', { cache: 'no-store' })
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
      setFollowStatus('checking')
      setFollowReason(null)
      checkFollowStatus()
    } else {
      setFollowStatus(null)
      setFollowReason(null)
    }

    return () => clearInterval(interval)
  }, [session?.user?.id, checkFollowStatus])

  useEffect(() => {
    setSessionOverride(null)
    setSubmitted(false)
    setError('')
  }, [leaderboard?.sessionId])

  useEffect(() => {
    setSubmissionsOverride(null)
  }, [leaderboard?.submissionsOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedDemoLink = demoLink.trim()

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

    if (!trimmedDemoLink) {
      setError('You must add a link to participate.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/enter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: name.trim() || undefined,
          demoLink: trimmedDemoLink,
          notes: notes ? notes : undefined,
        }),
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
        } else if (errorCode === 'ALREADY_WON_THIS_SESSION') {
          setError('You have already won this session. You’ll be eligible again in the next session.')
        } else if (errorCode === 'ALREADY_SUBMITTED_THIS_SESSION' || data.error === 'You already have an active submission') {
          setError('You already have an active submission for this session.')
        } else if (errorCode === 'PENDING_ENTRY_FROM_PREVIOUS_SESSION') {
          setError('You already have a pending submission with accumulated weight. It must be drawn before you can submit again.')
        } else if (errorCode === 'NOT_FOLLOWING') {
          setFollowStatus('not_following')
          setError('You need to follow the channel on Twitch before entering.')
        } else if (errorCode === 'DEMO_LINK_REQUIRED') {
          setError('You must add a link to participate.')
        } else if (errorCode === 'NOTES_TOO_LONG') {
          setError('Notes must be 500 characters or fewer.')
        } else if (errorCode === 'NOTES_INVALID') {
          setError('Notes must be plain text.')
        } else {
          setError(data.error || 'An error occurred')
        }
        return
      }

      if (data.success) {
        setSubmitted(true)
        setName('')
        setDemoLink('')
        setNotes('')
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
      <div className="bf-ambient-bg flex min-h-screen items-center justify-center">
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
      <div className="bf-ambient-bg flex min-h-screen items-center justify-center">
        <main className="w-full max-w-2xl px-6 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12 space-y-6">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white text-center">
              Sign in to enter the demo raffle!
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
              Your subscriber status, bits, and gifted subs improve your odds once you are signed in.
            </p>
            <TwitchLogin />

            <div className="bg-bf-orange-soft border border-[#f08e4c] rounded-lg p-4 mt-6">
              <p className="text-sm text-gray-900 text-center">
                Log in with Twitch and follow the channel to take part in the raffle.
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Gatekeeping (A): only block when Twitch explicitly reports not_following; unknown just warns.
  if (followStatus === 'not_following') {
    return (
      <div className="bf-ambient-bg flex min-h-screen items-center justify-center">
        <main className="w-full max-w-2xl px-6 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 text-center">
              Follow Required ❤️
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              You must follow the channel to enter the raffle
            </p>

            <TwitchLogin />

            <div className="bg-bf-orange-soft border border-[#f08e4c] rounded-lg p-6 mt-6 text-center">
              <p className="text-gray-900 font-semibold mb-2">
                You are not following this channel
              </p>
              <p className="text-sm text-gray-900">
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
    <div className="bf-ambient-bg min-h-screen py-6 px-4">
      <main className="max-w-7xl mx-auto">
        {/* Status Banner */}
        {leaderboard && sessionActive && (
          <div
            className={`mb-6 rounded-lg shadow-lg p-4 ${
              leaderboard.submissionsOpen ? 'bg-[#00c950] text-white' : 'bg-orange-500 text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-[#3be178]' : 'bg-orange-300'
                } animate-pulse`}
              ></div>
              <h2 className="text-3xl font-bold">
                {leaderboard.submissionsOpen ? 'Submissions open' : 'Submissions paused'}
              </h2>
              <div
                className={`w-4 h-4 rounded-full ${
                  leaderboard.submissionsOpen ? 'bg-[#3be178]' : 'bg-orange-300'
                } animate-pulse`}
              ></div>
            </div>
            <p className="text-center text-lg mt-2 opacity-90">
              {leaderboard.totalEntries} {leaderboard.totalEntries === 1 ? 'entry' : 'entries'} total
            </p>
          </div>
        )}

        {leaderboard && !leaderboard.sessionId && (
          <div className="mb-6 rounded-lg bg-bf-orange-soft border border-[#f08e4c] shadow p-4 text-gray-900">
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
          <div className="bg-white dark:bg-[#0b1722] rounded-lg shadow-xl p-6 md:p-8">
            <div className="flex justify-center mb-4">
              <button
                type="button"
                onClick={() => setWeightInfoOpen(true)}
                className="heading-text inline-flex items-center gap-2 text-base md:text-lg font-semibold text-[var(--bf-primary)]/90 hover:text-bf-primary-dark hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bf-lime)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0b1722] transition"
              >
                How are my odds calculated?
              </button>
            </div>

          <TwitchLogin />

          {/* Warning only (A): uncertain follow state never blocks entry, just informs the user. */}
          {followStatus === 'unknown' && (
            <div className="mt-4 mb-6 rounded-lg bg-bf-orange-soft border border-[#f08e4c] p-4">
              <p className="text-sm text-gray-900">
                We couldn&apos;t verify your follow status right now
                {followReason ? ` (${followReason})` : ''}.{' '}
                You should still be able to enter, but please try again later or let the broadcaster know if this keeps happening.
              </p>
            </div>
          )}

          {submitted ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-bf-lime-soft rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-bf-primary"
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-bf-orange-soft rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-bf-primary"
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
              <div className="inline-flex items-center justify-center w-16 h-16 bg-bf-orange-soft rounded-full mb-4">
                <svg
                  className="w-8 h-8 text-bf-primary"
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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bf-primary focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder={session.user.name || 'Your display name'}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  If left empty, your Twitch display name will be used
                </p>
              </div>
              <div>
                <label htmlFor="demoLink" className="block text-sm font-medium text-gray-200 mb-1">
                  Link to your demo
                </label>
                <input
                  id="demoLink"
                  type="url"
                  value={demoLink}
                  onChange={(e) => setDemoLink(e.target.value)}
                  required
                  aria-invalid={Boolean(error) && demoLink.trim().length === 0}
                  className="w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-bf-primary"
                  placeholder="https://..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Paste a direct link to your track (Google Drive, Dropbox, SoundCloud, etc.).
                </p>
              </div>
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-200 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full rounded-md bg-gray-900/60 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-bf-primary"
                  placeholder="What kind of feedback are you looking for? (max 500 characters)"
                />
                <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                  <p>Let the broadcaster know what to listen for or any context we should know.</p>
                  <span>{notes.length}/500</span>
                </div>
              </div>

              {error && (
                <div className="bg-bf-orange-soft border border-[#f08e4c] text-gray-900 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="heading-text w-full bg-[var(--bf-pink)] text-white py-3 px-6 rounded-lg font-medium hover:bg-bf-primary-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Entering...' : 'Enter Raffle'}
              </button>
            </form>
          )}
          </div>

          {/* Right Column: Top 20 Leaderboard */}
          <div className="bg-white dark:bg-[#0b1722] rounded-lg shadow-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 text-center">
              {sessionActive ? 'Leaderboard' : 'Last session results'}
            </h2>
            {!sessionActive && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center">
                Showing the most recent completed session
              </p>
            )}

            {loadingLeaderboard ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading leaderboard...</p>
              </div>
            ) : leaderboard && leaderboard.entries.length > 0 ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {leaderboard.entries.map((entry, index) => (
                  <div
                    key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                        <p className="text-xl font-bold text-bf-primary">
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
        <WeightInfoModal open={weightInfoOpen} onClose={() => setWeightInfoOpen(false)} />
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
