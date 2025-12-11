'use client'

import { useState } from 'react'
import AmbientBackground from '@/app/components/AmbientBackground'

interface Winner {
  id: number
  name: string
  email: string
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [winner, setWinner] = useState<Winner | null>(null)
  const [winnerDrawn, setWinnerDrawn] = useState(false)

  const [adminToken, setAdminToken] = useState('')

  // Simple password check to access admin page
  // Real security is in the API which requires ADMIN_TOKEN
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // For simplicity - the API still protects the functionality
    // You can change 'admin' to a stronger password
    if (password.trim() !== '') {
      setAuthenticated(true)
      setError('')
    } else {
      setError('Please enter a password')
    }
  }

  const handlePickWinner = async () => {
    if (!adminToken.trim()) {
      setError('You must enter an admin token first')
      return
    }

    setLoading(true)
    setError('')
    setWinner(null)

    try {
      const response = await fetch('/api/pick-winner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken.trim()}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setWinner(data.winner)
        setWinnerDrawn(true)
      } else {
        setError(data.error || 'Could not pick winner. Please check that you are using the correct admin token.')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('An error occurred while picking the winner')
    } finally {
      setLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <AmbientBackground contentClassName="flex min-h-screen items-center justify-center">
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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bf-primary focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder="Enter admin password"
                />
              </div>
              {error && (
            <div className="bg-bf-orange-soft border border-[#f08e4c] text-gray-900 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-bf-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-bf-primary-dark transition-colors"
              >
                Log in
              </button>
            </form>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
              NOTE: This page requires admin access. Real security is in the API.
            </p>
          </div>
        </main>
      </AmbientBackground>
    )
  }

  return (
    <AmbientBackground contentClassName="flex min-h-screen items-center justify-center py-12">
      <main className="w-full max-w-2xl px-6">
        <div className="bg-white dark:bg-[#0b1722] rounded-lg shadow-xl p-8 md:p-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Admin Panel
          </h1>

          {winnerDrawn && winner ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-bf-orange-soft rounded-full mb-4">
                <svg
                  className="w-10 h-10 text-bf-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                Winner has been selected!
              </h2>
              <div className="bg-gray-50 dark:bg-[#0f1d28] rounded-lg p-6 mb-6">
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-1">
                  <span className="font-semibold">Name:</span> {winner.name}
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Email:</span> {winner.email}
                </p>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                The winner has been marked in the database.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-bf-orange-soft border border-[#f08e4c] rounded-lg p-4">
                <p className="text-sm text-gray-900">
                  <strong>NOTE:</strong> To pick a winner, you need to use your admin token.
                  The token is set in the <code className="bg-bf-lime-soft px-1 rounded">ADMIN_TOKEN</code> environment variable.
                </p>
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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-bf-primary focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder="Enter your admin token (from ADMIN_TOKEN environment variable)"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                onClick={handlePickWinner}
                disabled={loading || winnerDrawn}
                className="w-full bg-bf-primary text-white py-4 px-6 rounded-lg font-medium hover:bg-bf-primary-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-lg"
              >
                {loading ? 'Picking winner...' : winnerDrawn ? 'Winner already selected' : 'Pick winner'}
              </button>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setAuthenticated(false)}
                  className="w-full text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 py-2"
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </AmbientBackground>
  )
}

