'use client'

import { useState } from 'react'

interface WeightSettings {
  baseWeight: number
  subMonthsMultiplier: number
  subMonthsCap: number
  resubMultiplier: number
  resubCap: number
  cheerBitsDivisor: number
  cheerBitsCap: number
  donationsDivisor: number
  donationsCap: number
  giftedSubsMultiplier: number
  giftedSubsCap: number
  carryOverMultiplier: number
}

interface AdminWeightsFormProps {
  settings: WeightSettings
  onSettingsChange?: (settings: WeightSettings) => void
}

export default function AdminWeightsForm({
  settings: initialSettings,
  onSettingsChange,
}: AdminWeightsFormProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/weight-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      })

      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        onSettingsChange?.(data.settings)
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
      } else {
        const error = await response.json()
        setMessage({ type: 'error', text: error.error || 'Failed to save settings' })
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setMessage({ type: 'error', text: 'An error occurred while saving' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Weight Settings
      </h3>
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Base Weight
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.baseWeight}
              onChange={(e) =>
                setSettings({ ...settings, baseWeight: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sub Months Multiplier
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.subMonthsMultiplier}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  subMonthsMultiplier: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sub Months Cap
            </label>
            <input
              type="number"
              value={settings.subMonthsCap}
              onChange={(e) =>
                setSettings({ ...settings, subMonthsCap: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Resub Multiplier
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.resubMultiplier}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  resubMultiplier: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Resub Cap
            </label>
            <input
              type="number"
              value={settings.resubCap}
              onChange={(e) =>
                setSettings({ ...settings, resubCap: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cheer Bits Cap
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.cheerBitsCap}
              onChange={(e) =>
                setSettings({ ...settings, cheerBitsCap: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Donations Cap
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.donationsCap}
              onChange={(e) =>
                setSettings({ ...settings, donationsCap: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gifted Subs Cap
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.giftedSubsCap}
              onChange={(e) =>
                setSettings({ ...settings, giftedSubsCap: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Carry-Over Multiplier
          </label>
          <input
            type="number"
            step="0.01"
            value={settings.carryOverMultiplier}
            onChange={(e) =>
              setSettings({ ...settings, carryOverMultiplier: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

