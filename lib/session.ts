import { prisma } from './prisma'
export type RaffleSession = Awaited<ReturnType<typeof getCurrentSession>>

const SYSTEM_SESSION_NAME = 'System Sentinel Session'

export async function getCurrentSession() {
  return prisma.raffleSession.findFirst({
    where: {
      isSystem: false,
      endedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })
}

export async function getLatestEndedSession() {
  return prisma.raffleSession.findFirst({
    where: {
      isSystem: false,
      endedAt: {
        not: null,
      },
    },
    orderBy: {
      endedAt: 'desc',
    },
  })
}

export async function ensureSystemSession() {
  let session = await prisma.raffleSession.findFirst({
    where: { isSystem: true },
  })

  if (!session) {
    session = await prisma.raffleSession.create({
      data: {
        name: SYSTEM_SESSION_NAME,
        isSystem: true,
      },
    })
  }

  return session
}

export async function startNewSession(name?: string) {
  const active = await getCurrentSession()
  if (active) {
    throw new Error('ACTIVE_SESSION_EXISTS')
  }

  const session = await prisma.raffleSession.create({
    data: {
      name,
      isSystem: false,
    },
  })

  const previous = await getLatestEndedSession()
  if (previous) {
    await prisma.entry.updateMany({
      where: {
        sessionId: previous.id,
        isWinner: false,
      },
      data: {
        sessionId: session.id,
      },
    })
  }

  return session
}

export async function endCurrentSession() {
  const active = await getCurrentSession()
  if (!active) {
    throw new Error('NO_ACTIVE_SESSION')
  }

  return prisma.raffleSession.update({
    where: { id: active.id },
    data: {
      endedAt: new Date(),
    },
  })
}

