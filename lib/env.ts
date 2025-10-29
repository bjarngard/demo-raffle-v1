/**
 * Environment variable validation
 * Validates required env vars at boot time
 */
import { z } from 'zod'

const envSchema = z.object({
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_BROADCASTER_ID: z.string().min(1),
  TWITCH_WEBHOOK_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().url(),
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

