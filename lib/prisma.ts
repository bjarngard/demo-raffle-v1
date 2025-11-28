import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Test database connection on startup in development mode
if (process.env.NODE_ENV === 'development') {
  prisma.$connect().catch((error) => {
    console.error('Could not connect to database:', error)
    console.error('Check that DATABASE_URL is correct in the .env file')
    console.error('Check that the database server is running (e.g. with "npx prisma dev")')
  })
}

