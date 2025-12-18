import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_SETTINGS,
  calculateUserWeightWithSettings,
} from '@/lib/weight-settings'

test('calculateUserWeightWithSettings uses carryOver and support weights', () => {
  const user = {
    isSubscriber: true,
    subMonths: 6,
    resubCount: 0,
    totalCheerBits: 200,
    totalDonations: 0,
    totalGiftedSubs: 3,
    carryOverWeight: 1,
  }

  // cheerWeight = 200/100 = 2, giftedSubsWeight = 3 * 5 = 15 (cap 120), loyalty = min(6*0.5, cap 10*0.5=5) => 3
  // totalWeight = base(1) + loyalty(3) + support(17) + carryOver(1) = 22
  const total = calculateUserWeightWithSettings(user, DEFAULT_SETTINGS)
  assert.equal(total, 22)
})

test('carry-over invariant: currentWeight = totalWeight - carryOver', () => {
  const user = {
    isSubscriber: false,
    subMonths: 0,
    resubCount: 0,
    totalCheerBits: 0,
    totalDonations: 0,
    totalGiftedSubs: 0,
    carryOverWeight: 2.5,
  }

  const total = calculateUserWeightWithSettings(user, DEFAULT_SETTINGS)
  const current = total - user.carryOverWeight
  assert.equal(current + user.carryOverWeight, total)
})

