import { auth } from '@/auth'
import { getAdminEntries } from '@/lib/admin-data'
import { getWeightSettings } from '@/lib/weight-settings'
import { getSubmissionsOpen } from '@/lib/submissions-state'
import { getCurrentSession, getLatestEndedSession } from '@/lib/session'
import AdminDashboardClient from './AdminDashboardClient'
import { getBroadcasterAuthStatus } from '@/lib/twitch-health'

export default async function DemoAdminPage() {
  const session = await auth()

  if (!session?.user?.isBroadcaster) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Admin Access Required
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please sign in as the broadcaster&apos;s Twitch account to access the admin dashboard.
          </p>
        </div>
      </div>
    )
  }

  const [weightSettings, submissionsOpen, currentSession, lastEndedSession, twitchAuth] =
    await Promise.all([
      getWeightSettings(),
      getSubmissionsOpen(),
      getCurrentSession(),
      getLatestEndedSession(),
      getBroadcasterAuthStatus(),
    ])

  const serializeSession = (session: Awaited<ReturnType<typeof getCurrentSession>>) =>
    session
      ? {
          id: session.id,
          name: session.name,
          createdAt: session.createdAt.toISOString(),
          endedAt: session.endedAt ? session.endedAt.toISOString() : null,
        }
      : null

  const entries = currentSession
    ? await getAdminEntries({ sessionId: currentSession.id })
    : []

  return (
    <AdminDashboardClient
      initialEntries={entries}
      initialSettings={weightSettings}
      initialSubmissionsOpen={submissionsOpen}
      initialSession={serializeSession(currentSession)}
      lastEndedSession={serializeSession(lastEndedSession)}
      initialTwitchAuth={twitchAuth}
    />
  )
}

