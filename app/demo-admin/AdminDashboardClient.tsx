'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AmbientBackground from '@/app/components/AmbientBackground'
import AdminUserTable from '@/app/components/AdminUserTable'
import AdminWeightsForm from '@/app/components/AdminWeightsForm'
import RaffleWheel, { type RaffleWinner } from '@/app/components/RaffleWheel'
import TopList from '@/app/components/TopList'
import type { AdminEntry, CarryOverUser } from '@/types/admin'
import type { WeightSettings } from '@/lib/weight-settings'
import useStatus from '../hooks/useStatus'
import { formatNumber } from '@/lib/format-number'
import { withJitter } from '@/lib/polling'

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

type TwitchAuth =
  | { status: 'ok' }
  | { status: 'reauth_required'; reason?: string; missingScopes?: string[] }

type AdminDashboardClientProps = {
  initialEntries: AdminEntry[]
  initialSettings: AdminWeightSettings
  initialSubmissionsOpen: boolean
  initialSession: DashboardSession | null
  lastEndedSession: DashboardSession | null
  initialTwitchAuth: TwitchAuth
}

type UserSearchResult = {
  id: string
  username: string
  displayName: string
  totalWeight: number
  currentWeight: number
  carryOverWeight: number
  sessionBonus: number
  isSubscriber: boolean
  isFollower: boolean
  subMonths: number
  lastUpdated: string | null
}

export default function AdminDashboardClient({
  initialEntries,
  initialSettings,
  initialSubmissionsOpen,
  initialSession,
  lastEndedSession,
  initialTwitchAuth,
}: AdminDashboardClientProps) {
  const [entries, setEntries] = useState<AdminEntry[]>(initialEntries)
  const [weightSettings, setWeightSettings] = useState<AdminWeightSettings>(initialSettings)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [twitchAuth, setTwitchAuth] = useState<TwitchAuth>(initialTwitchAuth)
  const [winnerModalEntry, setWinnerModalEntry] = useState<AdminEntry | null>(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'weights' | 'raffle'>('users')
  const [submissionsOpen, setSubmissionsOpen] = useState(initialSubmissionsOpen)
  const [isTogglingSubmissions, setIsTogglingSubmissions] = useState(false)
  const [sessionInfo, setSessionInfo] = useState<DashboardSession | null>(initialSession)
  const [previousSession, setPreviousSession] = useState<DashboardSession | null>(lastEndedSession)
  const [sessionActionLoading, setSessionActionLoading] = useState(false)
  const [sessionActionMessage, setSessionActionMessage] = useState<string | null>(null)
  const [carryOverUsers, setCarryOverUsers] = useState<CarryOverUser[]>([])
  const { data: statusData } = useStatus()
  const lastEntryAtRef = useRef<string | null>(null)
  const refreshInFlightRef = useRef(false)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [recalcMessage, setRecalcMessage] = useState<string | null>(null)
  const [bonusModalOpen, setBonusModalOpen] = useState(false)
  const [bonusSearch, setBonusSearch] = useState('')
  const [bonusResults, setBonusResults] = useState<UserSearchResult[]>([])
  const [bonusLoading, setBonusLoading] = useState(false)
  const [bonusMessage, setBonusMessage] = useState<string | null>(null)
  const [bonusError, setBonusError] = useState<string | null>(null)
  const [bonusInput, setBonusInput] = useState<Record<string, string>>({})

  const fetchAdminData = useCallback(async () => {
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
        if ('carryOverUsers' in data) {
          setCarryOverUsers(data.carryOverUsers ?? [])
        }
        if ('twitchAuth' in data) {
          setTwitchAuth(data.twitchAuth ?? { status: 'ok' })
        }
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
    }
  }, [])

  const handleForceRecalc = useCallback(async () => {
    const confirm = window.confirm(
      'Force recalculation of all user weights? This will recalc using current settings. Avoid running during a live draw.'
    )
    if (!confirm) return
    setRecalcLoading(true)
    setRecalcMessage(null)
    try {
      const response = await fetch('/api/admin/recalc-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to recalc weights')
      }
      setRecalcMessage(`Recalculated weights for ${data.processed ?? 0} users.`)
      await fetchAdminData()
    } catch (error) {
      setRecalcMessage(error instanceof Error ? error.message : 'Failed to recalc weights')
    } finally {
      setRecalcLoading(false)
    }
  }, [fetchAdminData])

  const handleBonusSearch = useCallback(async () => {
    setBonusLoading(true)
    setBonusError(null)
    setBonusMessage(null)
    try {
      const params = new URLSearchParams()
      if (bonusSearch.trim()) params.set('search', bonusSearch.trim())
      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to search users')
      }
      setBonusResults(data.users ?? [])
    } catch (error) {
      setBonusError(error instanceof Error ? error.message : 'Failed to search users')
    } finally {
      setBonusLoading(false)
    }
  }, [bonusSearch])

  const handleSaveBonus = useCallback(
    async (userId: string) => {
      const raw = bonusInput[userId]
      const value = raw !== undefined ? parseFloat(raw) : NaN
      if (!Number.isFinite(value) || value < 0) {
        setBonusError('Ange ett giltigt icke-negativt bonusvärde')
        return
      }
      setBonusLoading(true)
      setBonusError(null)
      setBonusMessage(null)
      try {
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, sessionBonus: value }),
        })
        const data = await response.json()
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to update bonus')
        }
        setBonusMessage(`Bonus uppdaterad för ${data.user?.displayName ?? data.user?.username ?? userId}`)
        await handleBonusSearch()
        await fetchAdminData()
      } catch (error) {
        setBonusError(error instanceof Error ? error.message : 'Failed to update bonus')
      } finally {
        setBonusLoading(false)
      }
    },
    [bonusInput, fetchAdminData, handleBonusSearch]
  )

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true)
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
    } finally {
      setLeaderboardLoading(false)
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
        await fetchLeaderboard()
      } catch (error) {
        console.error('Error toggling submissions:', error)
      } finally {
        setIsTogglingSubmissions(false)
      }
    },
    [fetchAdminData, fetchLeaderboard]
  )

  useEffect(() => {
    fetchLeaderboard()
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      await fetchAdminData()
      await fetchLeaderboard()
      if (!cancelled) {
        pollTimer = setTimeout(poll, withJitter(15_000))
      }
    }

    pollTimer = setTimeout(poll, withJitter(15_000))

    return () => {
      cancelled = true
      if (pollTimer) {
        clearTimeout(pollTimer)
      }
    }
  }, [fetchAdminData, fetchLeaderboard])

  const handleWinnerPicked = useCallback(
    async (winnerData: RaffleWinner) => {
      const entry = entries.find((candidate) => candidate.id === winnerData.id)
      if (entry) {
        setWinnerModalEntry(entry)
      } else {
        console.warn('[admin] winner entry not found in current list', winnerData)
      }

      await Promise.all([fetchAdminData(), fetchLeaderboard()])
    },
    [entries, fetchAdminData, fetchLeaderboard]
  )

  useEffect(() => {
    if (!statusData) {
      return
    }

    if (!statusData.hasActiveSession) {
      lastEntryAtRef.current = null
      refreshInFlightRef.current = false
      return
    }

    if (!statusData.lastEntryAt) {
      return
    }

    const previous = lastEntryAtRef.current
    if (previous && previous === statusData.lastEntryAt) {
      return
    }

    if (refreshInFlightRef.current) {
      return
    }

    refreshInFlightRef.current = true

    const nextLastEntryAt = statusData.lastEntryAt

    const runRefresh = async () => {
      try {
        await Promise.all([fetchAdminData(), fetchLeaderboard()])
        lastEntryAtRef.current = nextLastEntryAt
      } finally {
        refreshInFlightRef.current = false
      }
    }

    void runRefresh()
  }, [statusData, fetchAdminData, fetchLeaderboard])

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

  const formatBonus = (value: number | null | undefined, decimals = 2) => {
    if (value === null || value === undefined) return '—'
    return `+${formatNumber(value, decimals)}×`
  }

  const subscriberBonus = weightSettings?.subMonthsMultiplier ?? null
  const bitsPer500 = weightSettings ? 500 / (weightSettings.cheerBitsDivisor || 1) : null
  const giftBonus = weightSettings?.giftedSubsMultiplier ?? null

  return (
    <AmbientBackground contentClassName="min-h-screen py-6 px-4">
      {twitchAuth.status === 'reauth_required' && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
            <p className="font-semibold">Twitch-auth behöver uppdateras (reauth krävs).</p>
            {twitchAuth.reason && <p className="text-sm text-red-800">Orsak: {twitchAuth.reason}</p>}
            {twitchAuth.missingScopes && twitchAuth.missingScopes.length > 0 && (
              <p className="text-sm text-red-800">
                Saknade scopes: {twitchAuth.missingScopes.join(', ')}
              </p>
            )}
            <p className="text-sm text-red-800">
              Logga in som broadcastern igen för att återställa follow/sub och kör därefter sync.
            </p>
          </div>
        </div>
      )}
      <main className="max-w-7xl mx-auto">
        <div className="lg:flex lg:items-start lg:gap-4">
          <section className="flex-1">
            <div className="bf-glass-card rounded-lg p-5 mb-5">
              <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
                {(['users', 'weights', 'raffle'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`heading-text px-4 py-2 font-medium transition-colors ${
                      activeTab === tab
                        ? 'border-b-2 border-[var(--bf-lime)] text-bf-lime'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    {tab === 'users' ? 'Users' : tab === 'weights' ? 'Weights' : 'Raffle'}
                  </button>
                ))}
              </div>

              {activeTab === 'users' && (
                sessionInfo ? (
                  <>
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        {recalcMessage && (
                          <p className="text-sm text-gray-700 dark:text-gray-300">{recalcMessage}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleForceRecalc}
                        disabled={recalcLoading}
                        className="inline-flex items-center justify-center rounded-lg border border-[var(--bf-lime)] px-4 py-2 text-sm font-semibold text-[var(--bf-lime)] hover:bg-[var(--bf-lime)] hover:text-black transition disabled:opacity-60"
                      >
                        {recalcLoading ? 'Recalculating…' : 'Force recalc weights'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBonusModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg border border-sky-500 px-4 py-2 text-sm font-semibold text-sky-600 hover:bg-sky-50 dark:border-sky-400 dark:text-sky-300 dark:hover:bg-sky-900/40 transition"
                      >
                        Add temp session bonus
                      </button>
                    </div>
                    <AdminUserTable
                      entries={entries}
                      onRefresh={fetchAdminData}
                    />
                  </>
                ) : (
                  <CarryOverTable
                    users={carryOverUsers}
                  />
                )
              )}

              {activeTab === 'weights' && (
                <AdminWeightsForm
                  settings={weightSettings}
                  onSettingsChange={setWeightSettings}
                />
              )}

              {activeTab === 'raffle' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={fetchLeaderboard}
                      disabled={leaderboardLoading}
                      className={`inline-flex items-center px-3 py-1.5 rounded-md border text-xs font-medium transition ${
                        leaderboardLoading
                          ? 'border-gray-700 text-gray-500 cursor-not-allowed opacity-60'
                          : 'border-gray-500 text-gray-200 hover:border-[var(--bf-lime)] hover:text-[var(--bf-lime)] hover:bg-[#0f1d28]'
                      }`}
                    >
                      {leaderboardLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                  <RaffleWheel entries={raffleEntries} onWinnerPicked={handleWinnerPicked} />
                  <TopList
                    entries={leaderboard}
                    loading={leaderboardLoading}
                    maxHeightClass="max-h-[800px]"
                    hideRefreshingText
                  />
                </div>
              )}
            </div>
          </section>

          <aside className="mt-4 lg:mt-0 lg:w-80 flex-shrink-0 space-y-3">
            <div className="bf-glass-card p-5 rounded-lg">
              <div className="flex items-center justify-between gap-3">
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
                <AdminToggle
                  label="Session"
                  leftLabel="Active"
                  rightLabel="Closed"
                  on={Boolean(sessionInfo)}
                  disabled={sessionActionLoading}
                  onToggle={() => (sessionInfo ? handleEndSession() : handleStartSession())}
                />
              </div>
              {sessionActionMessage && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                  {sessionActionMessage}
                </p>
              )}
            </div>

            <div className="bf-glass-card p-5 rounded-lg">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Submissions Status</p>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {sessionInfo ? (submissionsOpen ? 'Open' : 'Paused') : 'No active session'}
                  </p>
                </div>
                <AdminToggle
                  label="Submissions"
                  leftLabel="Open"
                  rightLabel="Paused"
                  on={Boolean(sessionInfo) && submissionsOpen}
                  disabled={!sessionInfo || isTogglingSubmissions}
                  neutral={!sessionInfo}
                  onToggle={() => toggleSubmissions(!submissionsOpen)}
                />
              </div>
            </div>

            <div className="bf-glass-card p-5 rounded-lg">
              <p className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
                Current weight values
              </p>
              {weightSettings ? (
                <dl className="space-y-3 text-base text-gray-900 dark:text-gray-100">
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-800 dark:text-gray-100">Active entries</dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                      {entries.length}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-800 dark:text-gray-100">Subscriber bonus</dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatBonus(subscriberBonus)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-800 dark:text-gray-100">500 bits</dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatBonus(bitsPer500, 2)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-gray-800 dark:text-gray-100">1 gifted sub</dt>
                    <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatBonus(giftBonus, 2)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading settings…</p>
              )}
            </div>
          </aside>
        </div>
      </main>
      {winnerModalEntry && (
        <AdminWinnerModal entry={winnerModalEntry} onClose={() => setWinnerModalEntry(null)} />
      )}

      {bonusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Temp session bonus (endast denna session)
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sök användare, ange bonus (≥ 0), sparar direkt och räknar om vikten. Bonus nollas när sessionen avslutas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBonusModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={bonusSearch}
                onChange={(e) => setBonusSearch(e.target.value)}
                placeholder="Sök username/display name"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <button
                type="button"
                onClick={handleBonusSearch}
                disabled={bonusLoading}
                className="rounded-lg bg-[var(--bf-lime)] px-3 py-2 text-sm font-semibold text-black hover:bg-[var(--bf-lime)]/80 transition disabled:opacity-60"
              >
                {bonusLoading ? 'Söker…' : 'Sök'}
              </button>
            </div>

            {bonusError && <p className="text-sm text-red-600 mb-2">{bonusError}</p>}
            {bonusMessage && <p className="text-sm text-green-700 mb-2">{bonusMessage}</p>}

            <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table className="min-w-full text-sm text-left text-gray-900 dark:text-gray-100">
                <thead className="text-xs uppercase text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3 text-right">Current</th>
                    <th className="py-2 px-3 text-right">Carry</th>
                    <th className="py-2 px-3 text-right">Bonus</th>
                    <th className="py-2 px-3 text-right">Set bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {bonusResults.length === 0 ? (
                    <tr>
                      <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-400" colSpan={5}>
                        {bonusLoading ? 'Laddar…' : 'Inga träffar'}
                      </td>
                    </tr>
                  ) : (
                    bonusResults.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-3">
                          <div className="font-semibold">{u.displayName || u.username}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{u.username}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {u.isSubscriber ? 'Sub' : 'Ej sub'} · {u.isFollower ? 'Follow' : 'Ej follow'} · m:{u.subMonths}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">{formatNumber(u.currentWeight, 2)}x</td>
                        <td className="py-2 px-3 text-right">+{formatNumber(u.carryOverWeight, 2)}x</td>
                        <td className="py-2 px-3 text-right">+{formatNumber(u.sessionBonus ?? 0, 2)}x</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={bonusInput[u.id] ?? ''}
                              onChange={(e) =>
                                setBonusInput((prev) => ({
                                  ...prev,
                                  [u.id]: e.target.value,
                                }))
                              }
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveBonus(u.id)}
                              disabled={bonusLoading}
                              className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-500 transition disabled:opacity-60"
                            >
                              Spara
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AmbientBackground>
  )
}

function AdminWinnerModal({
  entry,
  onClose,
}: {
  entry: AdminEntry
  onClose: () => void
}) {
  const displayName =
    entry.displayName?.trim() ||
    entry.name?.trim() ||
    entry.username?.trim() ||
    'Winner'
  const demoLink = entry.demoLink ?? null
  const demoLabel = demoLink ? formatDemoLinkLabel(demoLink) : null
  const notes = entry.notes?.trim()
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          aria-label="Close winner modal"
        >
          ✕
        </button>
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold text-gray-800 dark:text-gray-100">{displayName}</p>
          {demoLink ? (
            <a
              href={demoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-bf-primary text-white hover:bg-bf-primary-dark transition"
            >
              {demoLabel}
            </a>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No demo link provided.</p>
          )}
          {notes && (
            <div className="w-full rounded-lg bg-gray-100 dark:bg-gray-800/60 px-4 py-3 text-left">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Notes
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">
                {notes}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg border border-bf-primary text-bf-primary hover:bg-bf-orange-soft transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDemoLinkLabel(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length <= 80) return trimmed
  return `${trimmed.slice(0, 77)}…`
}

// Rendered only when there is NO active session; shows who will enter the next session with carry-over weight.
function CarryOverTable({
  users,
}: {
  users: CarryOverUser[]
}) {
  return (
    <div className="bf-glass-card rounded-lg p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Carry-over for next session
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            These users currently have carry-over weight and will start the next session with a buff.
          </p>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">No users currently have carry-over weight.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-900 dark:text-gray-100">
            <thead className="text-xs uppercase text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4 text-right">Total weight</th>
                <th className="py-2 pr-4 text-right">Carry-over</th>
                <th className="py-2 pr-4 text-right">Last active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4">
                    <div className="font-semibold">{user.displayName}</div>
                    {user.username && user.username !== user.displayName && (
                      <div className="text-xs text-gray-600 dark:text-gray-400">{user.username}</div>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right">{formatNumber(user.totalWeight)}x</td>
                  <td className="py-2 pr-4 text-right">+{formatNumber(user.carryOverWeight)}x</td>
                  <td className="py-2 pr-4 text-right">
                    {user.lastActive ? new Date(user.lastActive).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

type AdminToggleProps = {
  label: string
  leftLabel: string
  rightLabel: string
  on: boolean
  disabled?: boolean
  neutral?: boolean
  onToggle: () => void
}

function AdminToggle({ label, leftLabel, rightLabel, on, disabled, neutral, onToggle }: AdminToggleProps) {
  const toggleClasses = [
    'relative inline-flex h-6 w-11 items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--bf-lime)]',
    on ? 'bg-[var(--bf-lime)] border-[var(--bf-lime)]' : 'bg-gray-500 border-gray-500',
    disabled ? 'opacity-60 cursor-not-allowed' : '',
  ]

  const handleClasses = [
    'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
    on ? 'translate-x-5' : 'translate-x-1',
  ]

  const isNeutral = neutral && disabled

  const leftLabelClasses = [
    isNeutral ? 'text-gray-500 dark:text-gray-400' : on ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400',
    'font-semibold',
  ]

  const rightLabelClasses = [
    isNeutral ? 'text-gray-500 dark:text-gray-400' : on ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white',
    'font-semibold',
  ]

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col">
        <span className="heading-text text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 mt-1">
          <span className={leftLabelClasses.join(' ')}>{leftLabel}</span>
          <button
            type="button"
            onClick={disabled ? undefined : onToggle}
            className={toggleClasses.join(' ')}
            aria-pressed={on}
            disabled={disabled}
          >
            <span
              className={handleClasses.join(' ')}
            />
          </button>
          <span className={rightLabelClasses.join(' ')}>{rightLabel}</span>
        </div>
      </div>
    </div>
  )
}

