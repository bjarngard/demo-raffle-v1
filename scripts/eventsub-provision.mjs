#!/usr/bin/env node
import 'dotenv/config'

const {
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_BROADCASTER_ID,
  TWITCH_WEBHOOK_SECRET,
  NEXTAUTH_URL,
  EVENTSUB_CALLBACK_BASE_URL,
} = process.env

const REQUIRED_ENV_VARS = [
  'TWITCH_CLIENT_ID',
  'TWITCH_CLIENT_SECRET',
  'TWITCH_BROADCASTER_ID',
  'TWITCH_WEBHOOK_SECRET',
]

const ACTIVE_STATUSES = new Set(['enabled', 'webhook_callback_verification_pending'])

let cachedSubscriptions = []

async function getAppAccessToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.error('[eventsub:env] Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET')
    process.exit(1)
  }

  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  })

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const body = await safeReadBody(response)
    console.error('[eventsub:auth] Failed to obtain app access token', {
      status: response.status,
      body,
    })
    process.exit(1)
  }

  const json = await response.json()
  if (!json.access_token) {
    console.error('[eventsub:auth] Response missing access_token', { json })
    process.exit(1)
  }

  return json.access_token
}

async function listSubscriptions(token) {
  if (!TWITCH_CLIENT_ID) {
    console.error('[eventsub:env] Missing TWITCH_CLIENT_ID')
    process.exit(1)
  }

  const all = []
  let cursor = null

  do {
    const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions')
    if (cursor) {
      url.searchParams.set('after', cursor)
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    })

    if (!response.ok) {
      const body = await safeReadBody(response)
      console.error('[eventsub:list] Failed to fetch subscriptions', {
        status: response.status,
        body,
      })
      process.exit(1)
    }

    const json = await response.json()
    const data = Array.isArray(json.data) ? json.data : []
    data.forEach((item) => {
      console.log('[eventsub:list]', {
        id: item.id,
        type: item.type,
        status: item.status,
        version: item.version,
        callback: item.transport?.callback,
        condition: item.condition,
      })
    })
    all.push(...data)
    cursor = json.pagination?.cursor ?? null
  } while (cursor)

  cachedSubscriptions = all
  return all
}

async function ensureSubscriptions(token, callbackUrl) {
  const existing = cachedSubscriptions.length > 0 ? cachedSubscriptions : await listSubscriptions(token)
  const desired = [
    {
      type: 'channel.follow',
      version: '2',
      condition: {
        broadcaster_user_id: TWITCH_BROADCASTER_ID,
        moderator_user_id: TWITCH_BROADCASTER_ID,
      },
    },
    {
      type: 'channel.subscribe',
      version: '1',
      condition: { broadcaster_user_id: TWITCH_BROADCASTER_ID },
    },
    {
      type: 'channel.subscription.message',
      version: '1',
      condition: { broadcaster_user_id: TWITCH_BROADCASTER_ID },
    },
    {
      type: 'channel.subscription.gift',
      version: '1',
      condition: { broadcaster_user_id: TWITCH_BROADCASTER_ID },
    },
    {
      type: 'channel.cheer',
      version: '1',
      condition: { broadcaster_user_id: TWITCH_BROADCASTER_ID },
    },
  ]

  for (const target of desired) {
    const match = existing.find(
      (sub) =>
        sub.type === target.type &&
        sub.transport?.method === 'webhook' &&
        sub.transport?.callback === callbackUrl &&
        ACTIVE_STATUSES.has(sub.status),
    )

    if (match) {
      console.log('[eventsub:provision] exists', {
        type: target.type,
        id: match.id,
        status: match.status,
      })
      continue
    }

    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: target.type,
        version: target.version,
        condition: target.condition,
        transport: {
          method: 'webhook',
          callback: callbackUrl,
          secret: TWITCH_WEBHOOK_SECRET,
        },
      }),
    })

    if (!response.ok) {
      const body = await safeReadBody(response)
      console.error('[eventsub:provision] error', {
        type: target.type,
        status: response.status,
        body,
      })
      continue
    }

    const json = await response.json()
    const created = Array.isArray(json.data) ? json.data[0] : null
    if (created) {
      cachedSubscriptions.push(created)
    }

    console.log('[eventsub:provision] created', {
      type: created?.type ?? target.type,
      id: created?.id,
      status: created?.status,
    })
  }
}

async function safeReadBody(response) {
  try {
    return await response.text()
  } catch (error) {
    return `<failed to read body: ${error}>`
  }
}

async function main() {
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      console.error(`[eventsub:env] Missing ${key}`)
      process.exit(1)
    }
  }

  const baseUrl = resolveBaseUrl()
  const callbackUrl = `${baseUrl}/api/twitch/eventsub`

  const token = await getAppAccessToken()
  const existing = await listSubscriptions(token)
  console.log('[eventsub:list] total', existing.length)
  await ensureSubscriptions(token, callbackUrl)
}

function resolveBaseUrl() {
  const baseUrl = (NEXTAUTH_URL ?? EVENTSUB_CALLBACK_BASE_URL)?.trim()
  if (!baseUrl) {
    console.error('[eventsub:env] Missing NEXTAUTH_URL or EVENTSUB_CALLBACK_BASE_URL')
    process.exit(1)
  }
  return baseUrl.replace(/\/$/, '')
}

main().catch((error) => {
  console.error('[eventsub] fatal', error)
  process.exit(1)
})

