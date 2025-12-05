import { prisma } from './prisma'
import { getCurrentSession } from './session'
import { entryStateExclusion } from './submissions-state'

export type RaffleSubmissionState =
  | { kind: 'NO_ACTIVE_SESSION' }
  | { kind: 'ELIGIBLE'; sessionId: string }
  | { kind: 'HAS_ENTRY_IN_ACTIVE_SESSION'; sessionId: string; entryId: number }

/**
 * Determine whether a user may submit an entry right now.
 * Returns the active session id when eligible, or the blocking entry/session
 * so admin tooling can reference the exact row.
 */
export async function resolveRaffleSubmissionState(userId: string): Promise<RaffleSubmissionState> {
  const activeSession = await getCurrentSession()

  if (!activeSession) {
    return { kind: 'NO_ACTIVE_SESSION' }
  }

  const entry = await prisma.entry.findFirst({
    where: {
      sessionId: activeSession.id,
      userId,
      ...entryStateExclusion,
    },
    select: {
      id: true,
    },
  })

  if (entry) {
    return {
      kind: 'HAS_ENTRY_IN_ACTIVE_SESSION',
      sessionId: activeSession.id,
      entryId: entry.id,
    }
  }

  return {
    kind: 'ELIGIBLE',
    sessionId: activeSession.id,
  }
}

