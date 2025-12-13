export type AdminEntry = {
  id: number
  name: string
  username: string
  displayName: string
  demoLink: string | null
  notes?: string | null
  totalWeight: number
  weightBreakdown: {
    baseWeight: number
    loyalty: {
      monthsComponent: number
      resubComponent: number
      total: number
    }
    support: {
      cheerWeight: number
      donationsWeight: number
      giftedSubsWeight: number
      total: number
    }
    carryOverWeight: number
    totalWeight: number
    isSubscriber: boolean
    isFollower: boolean
    subMonths: number
  }
  createdAt: string
  userId: string | null
}

export type CarryOverUser = {
  id: string
  displayName: string
  username: string
  carryOverWeight: number
  totalWeight: number
  lastActive: string | null
}

