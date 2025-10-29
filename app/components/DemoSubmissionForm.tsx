'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface Submission {
  id: number
  name: string
  demoLink: string | null
  createdAt: string
}

export default function DemoSubmissionForm() {
  const { data: session } = useSession()
  const [demoLink, setDemoLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [loadingSubmission, setLoadingSubmission] = useState(true)

  // Fetch existing submission
  useEffect(() => {
    if (session?.user?.id) {
      fetchSubmission()
    }
  }, [session])

  const fetchSubmission = async () => {
    try {
      const response = await fetch('/api/user/submission')
      if (response.ok) {
        const data = await response.json()
        if (data.hasSubmission && data.submission) {
          setSubmission(data.submission)
        }
      }
    } catch (error) {
      console.error('Error fetching submission:', error)
    } finally {
      setLoadingSubmission(false)
    }
  }

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
        body: JSON.stringify({
          demoLink: demoLink.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setDemoLink('')
        await fetchSubmission() // Refresh submission status
      } else {
        setError(data.error || 'Failed to submit')
      }
    } catch (error) {
      console.error('Error submitting:', error)
      setError('An error occurred during submission')
    } finally {
      setLoading(false)
    }
  }

  if (loadingSubmission) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (submission) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600 dark:text-green-400"
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
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
            You have an active submission
          </h3>
        </div>
        {submission.demoLink && (
          <div className="mt-4">
            <p className="text-sm text-green-700 dark:text-green-300 mb-2">
              Demo Link:
            </p>
            <a
              href={submission.demoLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              {submission.demoLink}
            </a>
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="demoLink"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Demo Link (Optional)
        </label>
        <input
          type="url"
          id="demoLink"
          value={demoLink}
          onChange={(e) => setDemoLink(e.target.value)}
          placeholder="https://soundcloud.com/... or https://drive.google.com/..."
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white outline-none transition"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Paste your SoundCloud, Google Drive, or other demo link here
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Demo'}
      </button>
    </form>
  )
}

