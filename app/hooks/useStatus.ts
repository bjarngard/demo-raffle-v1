'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { withJitter } from '@/lib/polling'

type StatusData = {
  submissionsOpen: boolean
  hasActiveSession: boolean
  sessionId: string | null
  lastEntryAt: string | null
  updatedAt: string
}

type UseStatusResult = {
  data: StatusData | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const BASE_POLL_MS = 4_000

async function fetchStatusOnce(): Promise<StatusData> {
  const response = await fetch('/api/status', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Failed to fetch status')
  }
  return response.json()
}

export default function useStatus(): UseStatusResult {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const isMountedRef = useRef(true)

  const refetch = useCallback(async () => {
    try {
      const payload = await fetchStatusOnce()
      if (!isMountedRef.current) return
      setData(payload)
      setError(null)
    } catch (err) {
      if (!isMountedRef.current) return
      const fallbackError = err instanceof Error ? err : new Error('Unknown error')
      setError(fallbackError)
    } finally {
      if (!isMountedRef.current) return
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      await refetch()
      if (!cancelled) {
        timer = setTimeout(poll, withJitter(BASE_POLL_MS))
      }
    }

    // Initial fetch plus jittered loop
    poll()

    return () => {
      cancelled = true
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [refetch])

  return {
    data,
    loading,
    error,
    refetch,
  }
}

