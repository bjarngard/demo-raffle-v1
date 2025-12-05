'use client'

import { useState } from 'react'

interface Entry {
  id: number
  name: string
  weight: number
}

export type RaffleWinner = {
  id: number
  name: string
  email?: string | null
  userId?: string | null
  weight?: number
}

interface RaffleWheelProps {
  entries: Entry[]
  onWinnerPicked: (winner: RaffleWinner) => void
}

type PickWinnerResponse = {
  success: boolean
  winner?: RaffleWinner
  error?: string
}

export default function RaffleWheel({
  entries,
  onWinnerPicked,
}: RaffleWheelProps) {
  const [isDrawing, setIsDrawing] = useState(false)
  const [scrollingName, setScrollingName] = useState('')
  const [error, setError] = useState('')

  const handleDraw = async () => {
    if (isDrawing || entries.length === 0) {
      return
    }

    setIsDrawing(true)
    setError('')
    setScrollingName('')

    let currentIndex = 0
    let scrollInterval: ReturnType<typeof setInterval> | null = null
    let finalScroll: ReturnType<typeof setInterval> | null = null
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const clearAnimations = () => {
      if (scrollInterval) {
        clearInterval(scrollInterval)
        scrollInterval = null
      }
      if (finalScroll) {
        clearInterval(finalScroll)
        finalScroll = null
      }
      while (timeouts.length) {
        const timer = timeouts.pop()
        if (timer) {
          clearTimeout(timer)
        }
      }
    }

    const startScroll = () => {
      scrollInterval = setInterval(() => {
        if (entries.length === 0) {
          return
        }
        const entry = entries[currentIndex % entries.length]
        setScrollingName(entry.name)
        currentIndex += 1
      }, 100)
    }

    startScroll()

    try {
      const response = await fetch('/api/pick-winner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data: PickWinnerResponse = await response.json()

      if (!data.success || !data.winner) {
        throw new Error(data.error || 'Failed to draw winner')
      }

      const winnerData = data.winner

      timeouts.push(
        setTimeout(() => {
          clearAnimations()

          let scrollCount = 0
          finalScroll = setInterval(() => {
            if (entries.length === 0) {
              return
            }
            const entry = entries[currentIndex % entries.length]
            setScrollingName(entry.name)
            currentIndex += 1
            scrollCount += 1

            if (scrollCount > 15) {
              clearAnimations()
              timeouts.push(
                setTimeout(() => {
                  setScrollingName(winnerData.name)
                  timeouts.push(
                    setTimeout(() => {
                      setScrollingName('')
                      setIsDrawing(false)
                      onWinnerPicked(winnerData)
                    }, 600)
                  )
                }, 300)
              )
            }
          }, scrollCount < 10 ? 80 : 120)
        }, 2000)
      )
    } catch (error) {
      console.error('Error drawing winner:', error)
      clearAnimations()
      setError(error instanceof Error ? error.message : 'An error occurred')
      setIsDrawing(false)
      setScrollingName('')
    }
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <p className="text-gray-500">No entries to draw from</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
        Draw Winner
      </h3>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="text-center mb-6">
        <button
          onClick={handleDraw}
          disabled={isDrawing}
          className="bg-indigo-600 text-white py-4 px-8 rounded-lg font-bold text-xl hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
        >
          {isDrawing ? 'Drawing...' : '🎲 DRAW WINNER'}
        </button>
      </div>

      {(isDrawing || scrollingName) && (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-8 mb-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-4 animate-pulse">
              {scrollingName || '...'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

