import { prisma } from './prisma'
import { ensureSystemSession } from './session'

const SUBMISSIONS_STATE_EMAIL = 'submissions-state@demo-raffle.local'
const SUBMISSIONS_STATE_STREAM_ID = '__STATE__'

type StateEntry = {
  demoLink: string | null
}

async function readStateEntry(): Promise<StateEntry | null> {
  return prisma.entry.findUnique({
    where: { email: SUBMISSIONS_STATE_EMAIL },
    select: { demoLink: true },
  })
}

export async function getSubmissionsOpen(): Promise<boolean> {
  const stateEntry = await readStateEntry()
  if (stateEntry) {
    return stateEntry.demoLink !== 'closed'
  }

  const hasWinner = await prisma.entry.findFirst({
    where: {
      isWinner: true,
      email: { not: SUBMISSIONS_STATE_EMAIL },
    },
    select: { id: true },
  })

  return !hasWinner
}

export async function setSubmissionsOpen(submissionsOpen: boolean): Promise<void> {
  const name = submissionsOpen ? 'Submissions Open' : 'Submissions Closed'
  const demoLink = submissionsOpen ? 'open' : 'closed'
  const systemSession = await ensureSystemSession()

  await prisma.entry.upsert({
    where: { email: SUBMISSIONS_STATE_EMAIL },
    update: {
      name,
      demoLink,
      isWinner: false,
      streamId: SUBMISSIONS_STATE_STREAM_ID,
      sessionId: systemSession.id,
    },
    create: {
      name,
      demoLink,
      email: SUBMISSIONS_STATE_EMAIL,
      isWinner: false,
      streamId: SUBMISSIONS_STATE_STREAM_ID,
      sessionId: systemSession.id,
    },
  })
}

export const entryStateExclusion = {
  email: { not: SUBMISSIONS_STATE_EMAIL },
}

export const submissionsStateEmail = SUBMISSIONS_STATE_EMAIL

