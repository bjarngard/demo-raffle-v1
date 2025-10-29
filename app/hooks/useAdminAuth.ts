'use client'

import { useState, useEffect, useCallback } from 'react'

export function useAdminAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  // Check auth status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/auth')
      if (response.ok) {
        const data = await response.json()
        setAuthenticated(data.authenticated)
      } else {
        setAuthenticated(false)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      setAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (token: string) => {
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setAuthenticated(true)
          return { success: true }
        }
      }
      return { success: false, error: 'Invalid token' }
    } catch (error) {
      console.error('Error logging in:', error)
      return { success: false, error: 'Login failed' }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/admin/auth', {
        method: 'DELETE',
      })
      setAuthenticated(false)
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }, [])

  return {
    authenticated,
    loading,
    login,
    logout,
    checkAuth,
  }
}

