'use client'

import { useState, useEffect } from 'react'

interface Winner {
  id: number
  name: string
}

export default function Home() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [winner, setWinner] = useState<Winner | null>(null)
  const [loadingWinner, setLoadingWinner] = useState(true)

  // Fetch winner on page load
  useEffect(() => {
    async function fetchWinner() {
      try {
        const response = await fetch('/api/winner')
        
        // Check if response is JSON
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
    fetchWinner()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

      try {
        const response = await fetch('/api/enter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, email }),
        })

        // Check if response is JSON
        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text()
          console.error('API did not return JSON:', text)
          setError('An unexpected error occurred. Please try again later.')
          return
        }

        const data = await response.json()

        if (data.success) {
          setSubmitted(true)
          setName('')
          setEmail('')
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

  // Om vinnare finns, visa vinnarmeddelande
  if (!loadingWinner && winner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <main className="w-full max-w-2xl px-6 py-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-100 dark:bg-yellow-900 rounded-full mb-4">
                <svg
                  className="w-10 h-10 text-yellow-600 dark:text-yellow-400"
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
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              The raffle has ended!
            </h1>
            <p className="text-xl text-gray-700 dark:text-gray-300 mb-2">
              Congratulations <span className="font-semibold text-indigo-600 dark:text-indigo-400">{winner.name}</span> on winning! 🎉
            </p>
            <p className="text-gray-500 dark:text-gray-400 mt-4">
              Thank you to everyone who participated!
            </p>
          </div>
        </main>
      </div>
    )
  }

  // Om inget finns ännu och sidan laddas
  if (loadingWinner) {
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

  // Regular registration page
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <main className="w-full max-w-2xl px-6 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            Welcome to the raffle! 🎲
          </h1>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Enter below to participate in our raffle
          </p>

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
              <button
                onClick={() => setSubmitted(false)}
                className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Enter someone else
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
                  placeholder="your.email@example.com"
                />
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
                {loading ? 'Registering...' : 'Enter raffle'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
