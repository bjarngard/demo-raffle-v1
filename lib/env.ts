/**
 * Environment variable validation
 * Validates required env vars at boot time
 */
import { z } from 'zod'

// DIRECT_URL is required by Prisma schema when directUrl is specified
// For non-Supabase users, set DIRECT_URL to the same value as DATABASE_URL
// For Supabase users, DIRECT_URL should be the direct connection (port 5432)
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  // Auto-fallback to DATABASE_URL for non-Supabase users
  // This ensures Prisma schema doesn't fail when DIRECT_URL is missing
  process.env.DIRECT_URL = process.env.DATABASE_URL
  console.warn('⚠️  DIRECT_URL not set, using DATABASE_URL as fallback. For Supabase, set DIRECT_URL to direct connection (port 5432).')
}

const envSchema = z.object({
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_BROADCASTER_ID: z.string().min(1),
  TWITCH_WEBHOOK_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(), // Required by Prisma schema (auto-fallback to DATABASE_URL if not set)
  ADMIN_TOKEN: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
})

const parsed = envSchema.safeParse({
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
  TWITCH_BROADCASTER_ID: process.env.TWITCH_BROADCASTER_ID,
  TWITCH_WEBHOOK_SECRET: process.env.TWITCH_WEBHOOK_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
})

if (!parsed.success) {
  console.error('❌ Environment variable validation failed:')
  parsed.error.issues.forEach((err) => {
    console.error(`  - ${err.path.join('.')}: ${err.message}`)
  })
  throw new Error('Missing or invalid environment variables. Check logs above.')
}

export const env = parsed.data

