'use client'

import { useState } from 'react'

interface Entry {
  id: number
  name: string
  username: string
  displayName: string
  demoLink: string | null
  totalWeight: number
  weightBreakdown: {
    base: number
    subMonths: number
    resubCount: number
    cheerBits: number
    donations: number
    giftedSubs: number
    carryOver: number
  }
  createdAt: string
  userId: string | null
}

interface AdminUserTableProps {
  entries: Entry[]
  onRefresh: () => void
}

export default function AdminUserTable({
  entries,
  onRefresh,
}: AdminUserTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'weight' | 'name'>('weight')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [loading, setLoading] = useState(false)

  const handleRemoveEntry = async (entryId: number) => {
    if (!confirm('Are you sure you want to remove this entry?')) return

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/entries/${entryId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onRefresh() // Refresh the list
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to remove entry')
      }
    } catch (error) {
      console.error('Error removing entry:', error)
      alert('An error occurred while removing the entry')
    } finally {
      setLoading(false)
    }
  }

  const filteredEntries = entries.filter(
    (entry) =>
      entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === 'weight') {
      return sortOrder === 'desc' ? b.totalWeight - a.totalWeight : a.totalWeight - b.totalWeight
    } else {
      return sortOrder === 'desc'
        ? b.name.localeCompare(a.name)
        : a.name.localeCompare(b.name)
    }
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="mb-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Active Entries ({sortedEntries.length})
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'weight' | 'name')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          >
            <option value="weight">Sort by Weight</option>
            <option value="name">Sort by Name</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
          >
            {sortOrder === 'desc' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Name
              </th>
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Demo Link
              </th>
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Weight
              </th>
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Breakdown
              </th>
              <th className="pb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {sortedEntries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="py-3 text-gray-900 dark:text-white">
                  <div>
                    <p className="font-semibold">{entry.name}</p>
                    <p className="text-xs text-gray-500">{entry.username}</p>
                  </div>
                </td>
                <td className="py-3">
                  {entry.demoLink ? (
                    <a
                      href={entry.demoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-xs block"
                    >
                      {entry.demoLink}
                    </a>
                  ) : (
                    <span className="text-gray-400">No link</span>
                  )}
                </td>
                <td className="py-3">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {entry.totalWeight.toFixed(2)}x
                  </span>
                </td>
                <td className="py-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <div>Sub: {entry.weightBreakdown.subMonths}mo</div>
                    <div>Bits: {entry.weightBreakdown.cheerBits.toLocaleString()}</div>
                    <div>Gifts: {entry.weightBreakdown.giftedSubs}</div>
                    {entry.weightBreakdown.carryOver > 0 && (
                      <div>Carry: +{entry.weightBreakdown.carryOver.toFixed(2)}x</div>
                    )}
                  </div>
                </td>
                <td className="py-3">
                  <button
                    onClick={() => handleRemoveEntry(entry.id)}
                    disabled={loading}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

