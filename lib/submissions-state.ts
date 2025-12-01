import { prisma } from './prisma'
import { ensureSystemSession } from './session'

const SUBMISSIONS_STATE_EMAIL = 'submissions-state@demo-raffle.local'
const SUBMISSIONS_STATE_STREAM_ID = '__STATE__'
type StateEntry = {
  demoLink: string | null
}

async function readStateEntry(): Promise<StateEntry | null> {
  return prisma.entry.findFirst({
    where: { email: SUBMISSIONS_STATE_EMAIL },
    select: { demoLink: true },
  })
}

export async function getSubmissionsOpen(): Promise<boolean> {
  const stateEntry = await readStateEntry()
  if (stateEntry) {
    return stateEntry.demoLink !== 'closed'
  }

  return true
}

export async function setSubmissionsOpen(submissionsOpen: boolean): Promise<void> {
  const name = submissionsOpen ? 'Submissions Open' : 'Submissions Closed'
  const demoLink = submissionsOpen ? 'open' : 'closed'
  const systemSession = await ensureSystemSession()
  const sentinelEntry = await prisma.entry.findFirst({
    where: {
      sessionId: systemSession.id,
      streamId: SUBMISSIONS_STATE_STREAM_ID,
      email: SUBMISSIONS_STATE_EMAIL,
    },
    select: { id: true },
  })

  if (sentinelEntry) {
    await prisma.entry.update({
      where: { id: sentinelEntry.id },
      data: {
        name,
        demoLink,
        isWinner: false,
        streamId: SUBMISSIONS_STATE_STREAM_ID,
        sessionId: systemSession.id,
        userId: null,
      },
    })
  } else {
    await prisma.entry.create({
      data: {
        name,
        demoLink,
        email: SUBMISSIONS_STATE_EMAIL,
        isWinner: false,
        streamId: SUBMISSIONS_STATE_STREAM_ID,
        sessionId: systemSession.id,
        userId: null,
      },
    })
  }
}

export const entryStateExclusion = {
  OR: [{ email: null }, { email: { not: SUBMISSIONS_STATE_EMAIL } }],
}

export const submissionsStateEmail = SUBMISSIONS_STATE_EMAIL

