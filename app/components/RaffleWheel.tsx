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
  const [winner, setWinner] = useState<RaffleWinner | null>(null)
  const [error, setError] = useState('')

  const handleDraw = async () => {
    setIsDrawing(true)
    setError('')
    setWinner(null)
    setScrollingName('')

    // Animation: scroll through names
    let currentIndex = 0
    const scrollInterval = setInterval(() => {
      if (entries.length > 0) {
        const entry = entries[currentIndex % entries.length]
        setScrollingName(entry.name)
        currentIndex++
      }
    }, 100) // Change name every 100ms

    try {
      const response = await fetch('/api/pick-winner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data: PickWinnerResponse = await response.json()

      if (data.success && data.winner) {
        const winnerData = data.winner
        // Stop scrolling after 2 seconds, then show winner
        setTimeout(() => {
          clearInterval(scrollInterval)
          
          // Final scroll animation to winner
          let scrollCount = 0
          const finalScroll = setInterval(() => {
            if (entries.length > 0) {
              const entry = entries[currentIndex % entries.length]
              setScrollingName(entry.name)
              currentIndex++
              scrollCount++
              
              // Slow down as we approach the winner
              if (scrollCount > 15) {
                clearInterval(finalScroll)
                // Final reveal
                setTimeout(() => {
                  setScrollingName(winnerData.name)
                  setWinner(winnerData)
                  setIsDrawing(false)
                  onWinnerPicked(winnerData)
                }, 300)
              }
            }
          }, scrollCount < 10 ? 80 : 120)
        }, 2000)
      } else {
        clearInterval(scrollInterval)
        setError(data.error || 'Failed to draw winner')
        setIsDrawing(false)
      }
    } catch (error) {
      console.error('Error drawing winner:', error)
      setError('An error occurred')
      setIsDrawing(false)
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

      {!winner && (
        <div className="text-center mb-6">
          <button
            onClick={handleDraw}
            disabled={isDrawing}
            className="bg-indigo-600 text-white py-4 px-8 rounded-lg font-bold text-xl hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
          >
            {isDrawing ? 'Drawing...' : '🎲 DRAW WINNER'}
          </button>
        </div>
      )}

      {(isDrawing || scrollingName) && (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg p-8 mb-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-white mb-4 animate-pulse">
              {scrollingName || '...'}
            </div>
          </div>
        </div>
      )}

      {winner && (
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h4 className="text-3xl font-bold text-white mb-2">Winner!</h4>
          <p className="text-2xl font-semibold text-white">{winner.name}</p>
          <p className="text-lg text-white/90 mt-2">
            Weight: {winner.weight?.toFixed(2) || 'N/A'}x
          </p>
        </div>
      )}
    </div>
  )
}

