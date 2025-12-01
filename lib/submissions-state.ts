import { prisma } from './prisma'
import { ensureSystemSession } from './session'

const SUBMISSIONS_STATE_EMAIL = 'submissions-state@demo-raffle.local'
const SUBMISSIONS_STATE_STREAM_ID = '__STATE__'
const SUBMISSIONS_STATE_USER_ID = '__SYSTEM_SENTINEL__'

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

  await prisma.entry.upsert({
    where: {
      sessionId_userId: {
        sessionId: systemSession.id,
        userId: SUBMISSIONS_STATE_USER_ID,
      },
    },
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
      userId: SUBMISSIONS_STATE_USER_ID,
      sessionId: systemSession.id,
    },
  })
}

export const entryStateExclusion = {
  OR: [{ email: null }, { email: { not: SUBMISSIONS_STATE_EMAIL } }],
}

export const submissionsStateEmail = SUBMISSIONS_STATE_EMAIL

