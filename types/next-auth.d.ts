import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isBroadcaster?: boolean
    }
    isFollower?: boolean
    isBroadcaster?: boolean
  }

  interface User {
    id: string
  }
}

