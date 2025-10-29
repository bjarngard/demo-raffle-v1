'use client'

interface LeaderboardEntry {
  id: number
  name: string
  weight: number
  probability: number
}

interface TopListProps {
  entries: LeaderboardEntry[]
  loading?: boolean
}

export default function TopList({ entries, loading }: TopListProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-500 text-center">Loading leaderboard...</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-500 text-center">No entries yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Top {entries.length} Leaderboard
      </h3>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {entries.map((entry, index) => (
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
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                {entry.probability.toFixed(2)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

