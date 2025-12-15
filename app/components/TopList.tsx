'use client'

interface LeaderboardEntry {
  id: number
  name: string
  weight: number
  probability: number
}

import { formatNumber } from '@/lib/format-number'

interface TopListProps {
  entries: LeaderboardEntry[]
  loading?: boolean
  maxHeightClass?: string
  hideRefreshingText?: boolean
  title?: string
  subtitle?: string
  showHeader?: boolean
  containerClassName?: string
}

export default function TopList({
  entries,
  loading,
  maxHeightClass,
  hideRefreshingText,
  title = 'Leaderboard',
  subtitle,
  showHeader = true,
  containerClassName,
}: TopListProps) {
  const isInitialLoading = !!loading && entries.length === 0
  const isRefreshing = !!loading && entries.length > 0

  const palette = ['#e2e8f0', '#cbd5e1', '#b8c4d6', '#94a3b8', '#7c8ba8', '#65748f', '#4a5565', '#334155']
  const getBgForIndex = (index: number, total: number) => {
    if (total <= 1) return palette[palette.length - 3]
    const t = index / Math.max(total - 1, 1)
    const idx = Math.round(t * (palette.length - 1))
    return palette[Math.min(Math.max(idx, 0), palette.length - 1)]
  }

  const getLuminance = (hex: string) => {
    const parsed = hex.replace('#', '')
    const r = parseInt(parsed.substring(0, 2), 16) / 255
    const g = parseInt(parsed.substring(2, 4), 16) / 255
    const b = parseInt(parsed.substring(4, 6), 16) / 255
    const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
    const [rl, gl, bl] = [toLinear(r), toLinear(g), toLinear(b)]
    return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
  }

  const getTextClasses = (bg: string) => {
    const isLight = getLuminance(bg) > 0.6
    return {
      primary: isLight ? 'text-gray-900' : 'text-white',
      muted: isLight ? 'text-gray-700' : 'text-gray-200',
      rank: isLight ? 'text-gray-800' : 'text-gray-200',
    }
  }

  if (isInitialLoading) {
    return (
      <div className="bf-glass-card rounded-lg p-6">
        <p className="text-gray-500 text-center">Loading leaderboard...</p>
      </div>
    )
  }

  if (!loading && entries.length === 0) {
    return (
      <div className={containerClassName ?? 'bf-glass-card rounded-lg p-6'}>
        <p className="text-gray-500 text-center">No entries yet</p>
      </div>
    )
  }

  return (
    <div className={containerClassName ?? 'bf-glass-card rounded-lg p-6'}>
      {showHeader && (
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h3 className="heading-text text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
            {isRefreshing && !hideRefreshingText && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Refreshing…</span>
            )}
          </div>
          {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className={`${maxHeightClass ?? 'max-h-[600px]'} overflow-y-auto`}>
        <div className="grid grid-cols-2 gap-2">
          {entries.map((entry, index) => {
            const bg = getBgForIndex(index, entries.length)
            const text = getTextClasses(bg)
            return (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 rounded-lg transition-colors transition-transform duration-150 hover:-translate-y-0.5 hover:brightness-105"
                style={{ backgroundColor: bg }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-8 text-center">
                    <span className={`font-bold text-lg ${text.rank}`}>
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${text.primary}`}>
                      {entry.name}
                    </p>
                    <p className={`text-xs ${text.muted}`}>
                      Weight: {formatNumber(entry.weight)}x
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <p className={`text-xl font-mono font-bold ${text.primary}`}>
                    {formatNumber(entry.probability)}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

