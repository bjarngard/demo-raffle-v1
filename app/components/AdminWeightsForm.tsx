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
  carryOverMaxBonus: number
  loyaltyMaxBonus: number
  supportMaxBonus: number
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
    <div className="bf-glass-card rounded-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Weight Settings
      </h3>
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-bf-lime-soft border border-[#c4cf48] text-gray-900'
              : 'bg-bf-orange-soft border border-[#f08e4c] text-gray-900'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Everyone starts at this weight each session.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subscriber Bonus Multiplier
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Static bonus added once for active subscribers.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subscriber Bonus Cap (months)
            </label>
            <input
              type="number"
              value={settings.subMonthsCap}
              onChange={(e) =>
                setSettings({ ...settings, subMonthsCap: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Treated as “effective months” cap for the static sub bonus.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cheer Bits Divisor
            </label>
            <input
              type="number"
              step="1"
              value={settings.cheerBitsDivisor}
              onChange={(e) =>
                setSettings({ ...settings, cheerBitsDivisor: parseFloat(e.target.value) || 1 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Every this many bits adds +1.0× before caps.
            </p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum bonus from bits alone (before combined support cap).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gifted Subs Multiplier
            </label>
            <input
              type="number"
              step="0.01"
              value={settings.giftedSubsMultiplier}
              onChange={(e) =>
                setSettings({ ...settings, giftedSubsMultiplier: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Bonus per gifted sub before caps.
            </p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maximum bonus from gifted subs alone (before combined support cap).
            </p>
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Portion of session weight that converts to carry-over if you don&apos;t win.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Carry-Over Max Bonus
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.carryOverMaxBonus}
              onChange={(e) =>
                setSettings({ ...settings, carryOverMaxBonus: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Caps the accumulated carry-over bonus across sessions.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Loyalty Max Bonus
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.loyaltyMaxBonus}
              onChange={(e) =>
                setSettings({ ...settings, loyaltyMaxBonus: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Overall cap for subscriber-tenure loyalty contributions.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Support Max Bonus
            </label>
            <input
              type="number"
              step="0.1"
              value={settings.supportMaxBonus}
              onChange={(e) =>
                setSettings({ ...settings, supportMaxBonus: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Caps the combined cheer bits and gifted subs bonus.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-bf-primary text-white py-3 px-6 rounded-lg font-medium hover:bg-bf-primary-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

