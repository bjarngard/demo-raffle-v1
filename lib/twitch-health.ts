import { getBroadcasterAccessToken } from './twitch-oauth'

export type TwitchAuthStatus =
  | { status: 'ok' }
  | { status: 'reauth_required'; reason?: string; missingScopes?: string[] }

const REQUIRED_SCOPES = ['moderator:read:followers', 'channel:read:subscriptions']

export async function getBroadcasterAuthStatus(): Promise<TwitchAuthStatus> {
  try {
    const token = await getBroadcasterAccessToken()

    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` },
      cache: 'no-store',
    })

    if (!response.ok) {
      return { status: 'reauth_required', reason: `validate_${response.status}` }
    }

    const data = (await response.json()) as { scopes?: string[] }
    const scopes = data.scopes ?? []
    const missingScopes = REQUIRED_SCOPES.filter((scope) => !scopes.includes(scope))

    if (missingScopes.length > 0) {
      return { status: 'reauth_required', reason: 'missing_scopes', missingScopes }
    }

    return { status: 'ok' }
  } catch (error) {
    return {
      status: 'reauth_required',
      reason: error instanceof Error ? error.message : 'unknown_error',
    }
  }
}
