type UserLike = {
  id?: string | null
  displayName?: string | null
  username?: string | null
  twitchId?: string | null
  twitchLogin?: string | null
}

/**
 * Returns a non-empty display name for a user, preferring displayName, then username,
 * then Twitch-specific handles, and finally a short id fallback. Never returns an
 * empty string.
 */
export function getUserDisplayName(user: UserLike | null | undefined): string {
  if (!user) return 'Twitch user'

  const displayName = (user.displayName ?? '').trim()
  if (displayName) return displayName

  const username = (user.username ?? '').trim()
  if (username) return username

  const twitchLogin = (user.twitchLogin ?? user.twitchId ?? '').trim()
  if (twitchLogin) return twitchLogin

  const id = (user.id ?? '').trim()
  if (id) return id.slice(0, 8)

  return 'Twitch user'
}

