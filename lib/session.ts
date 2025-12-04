import { prisma } from './prisma'
export type RaffleSession = Awaited<ReturnType<typeof getCurrentSession>>

const SYSTEM_SESSION_NAME = 'System Sentinel Session'

export async function getCurrentSession() {
  return prisma.raffleSession.findFirst({
    where: {
      status: 'ACTIVE',
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
      status: 'ENDED',
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
    where: { status: 'SYSTEM' },
  })

  if (!session) {
    session = await prisma.raffleSession.create({
      data: {
        name: SYSTEM_SESSION_NAME,
        status: 'SYSTEM',
      },
    })
  }

  return session
}

export async function startNewSession(name?: string) {
  return prisma.$transaction(async (tx) => {
    const active = await tx.raffleSession.findFirst({
      where: {
        status: 'ACTIVE',
        endedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (active) {
      throw new Error('ACTIVE_SESSION_EXISTS')
    }

    const session = await tx.raffleSession.create({
      data: {
        name,
        status: 'ACTIVE',
      },
    })

    const previous = await tx.raffleSession.findFirst({
      where: {
        status: 'ENDED',
        endedAt: {
          not: null,
        },
      },
      orderBy: {
        endedAt: 'desc',
      },
    })

    if (previous) {
      await tx.entry.updateMany({
        where: {
          sessionId: previous.id,
          isWinner: false,
        },
        data: {
          sessionId: session.id,
        },
      })
    }

    await tx.user.updateMany({
      data: {
        totalCheerBits: 0,
        totalGiftedSubs: 0,
        totalDonations: 0,
      },
    })

    return session
  })
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
      status: 'ENDED',
    },
  })
}

