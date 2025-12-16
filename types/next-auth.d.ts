import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isBroadcaster?: boolean
      twitchId?: string
      username?: string
      displayName?: string
    }
    isFollower?: boolean
    isBroadcaster?: boolean
  }

  interface User {
    id: string
    twitchId?: string
    username?: string
    displayName?: string
  }
}

