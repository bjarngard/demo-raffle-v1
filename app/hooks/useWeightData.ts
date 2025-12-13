'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WeightBreakdown, WeightSettings } from '@/lib/weight-settings'

export type WeightStatus = 'idle' | 'loading' | 'success' | 'error'

export type WeightResponse = {
  user: {
    id: string
    username: string | null
    displayName: string | null
    isFollower: boolean
    isSubscriber: boolean
    subMonths: number
    resubCount: number
    totalCheerBits: number
    totalDonations: number
    totalGiftedSubs: number
    carryOverWeight: number
    totalWeight: number
  }
  breakdown: WeightBreakdown
  settings: WeightSettings
  chancePercent: number | null
}

export type UseWeightDataOptions = {
  enabled?: boolean
  pollIntervalMs?: number
}

export type UseWeightDataResult = {
  data: WeightResponse | null
  status: WeightStatus
  error: Error | null
  lastUpdated: number | null
  refetch: () => Promise<void>
}

type WeightStoreState = {
  data: WeightResponse | null
  status: WeightStatus
  error: Error | null
  lastUpdated: number | null
}

type Subscriber = (state: WeightStoreState) => void
type SubscriberOptions = { enabled: boolean; interval: number }

// Shared poller for viewer weight data; used by MyStatusCard, WeightInfoModal, TwitchLogin, etc.
const DEFAULT_POLL_INTERVAL = 20_000
const INITIAL_STORE: WeightStoreState = {
  data: null,
  status: 'idle',
  error: null,
  lastUpdated: null,
}

let store: WeightStoreState = { ...INITIAL_STORE }

let pollTimer: ReturnType<typeof setInterval> | null = null
let activeIntervalMs = DEFAULT_POLL_INTERVAL
let fetchPromise: Promise<void> | null = null

const subscribers = new Set<Subscriber>()
const subscriberOptions = new Map<Subscriber, SubscriberOptions>()

function notifySubscribers() {
  for (const subscriber of subscribers) {
    subscriber(store)
  }
}

function updateStore(partial: Partial<WeightStoreState>) {
  store = { ...store, ...partial }
  notifySubscribers()
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function resetStore() {
  store = { ...INITIAL_STORE }
  notifySubscribers()
}

function recomputePolling() {
  let hasEnabled = false
  let nextInterval: number | null = null
  for (const opts of subscriberOptions.values()) {
    if (opts.enabled) {
      hasEnabled = true
      nextInterval =
        nextInterval === null ? opts.interval : Math.min(nextInterval, opts.interval)
    }
  }

  if (!hasEnabled) {
    stopPolling()
    if (
      store.data !== null ||
      store.status !== 'idle' ||
      store.error !== null ||
      store.lastUpdated !== null
    ) {
      resetStore()
    }
    return false
  }

  const desiredInterval = nextInterval ?? DEFAULT_POLL_INTERVAL
  if (pollTimer && desiredInterval === activeIntervalMs) {
    return true
  }

  stopPolling()
  activeIntervalMs = desiredInterval
  pollTimer = setInterval(() => {
    void fetchWeightData()
  }, activeIntervalMs)
  return true
}

async function fetchWeightData() {
  if (fetchPromise) {
    return fetchPromise
  }

  fetchPromise = (async () => {
    if (!store.data && store.status !== 'loading') {
      updateStore({ status: 'loading', error: null })
    }

    try {
      const response = await fetch('/api/weight/me', { cache: 'no-store' })
      if (!response.ok) {
        const message =
          response.status === 401
            ? 'You must be signed in to view your raffle status.'
            : 'Unable to load your weight breakdown right now.'
        updateStore({
          status: 'error',
          error: new Error(message),
        })
        return
      }

      const data: WeightResponse = await response.json()
      updateStore({
        data,
        status: 'success',
        error: null,
        lastUpdated: Date.now(),
      })
    } catch (error) {
      const err =
        error instanceof Error
          ? error
          : new Error('Unable to load your weight breakdown right now.')
      updateStore({
        status: 'error',
        error: err,
      })
    }
  })().finally(() => {
    fetchPromise = null
  })

  return fetchPromise
}

export function useWeightData(
  options?: UseWeightDataOptions
): UseWeightDataResult {
  const enabled = options?.enabled ?? true
  const interval = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL
  const [state, setState] = useState<WeightStoreState>(store)
  const subscriber = useCallback<Subscriber>((nextState) => {
    setState(nextState)
  }, [])

  useEffect(() => {
    subscribers.add(subscriber)

    return () => {
      subscribers.delete(subscriber)
      subscriberOptions.delete(subscriber)
      recomputePolling()
      if (subscribers.size === 0 && !pollTimer) {
        resetStore()
      }
    }
  }, [subscriber])

  useEffect(() => {
    subscriberOptions.set(subscriber, { enabled, interval })
    const hasEnabled = recomputePolling()
    if (enabled && hasEnabled && store.status === 'idle') {
      void fetchWeightData()
    }
  }, [subscriber, enabled, interval])

  const refetch = fetchWeightData

  return {
    data: state.data,
    status: state.status,
    error: state.error,
    lastUpdated: state.lastUpdated,
    refetch,
  }
}

