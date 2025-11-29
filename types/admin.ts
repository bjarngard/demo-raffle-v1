export type AdminEntry = {
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

