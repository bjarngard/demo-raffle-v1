export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ImportErrorDetails = {
  step: 'env import' | 'auth import'
  error: string
  stack?: string[]
}

type EnvCheck = {
  NEXTAUTH_SECRET?: string
  TWITCH_CLIENT_ID?: string
  NEXTAUTH_URL?: string
}

export async function GET() {
  try {
    // Test imports individually to isolate the error
    let importError: ImportErrorDetails | null = null
    let env: EnvCheck | null = null
    let authFn: ((...args: unknown[]) => Promise<unknown>) | null = null
    
    try {
      const envModule = await import('@/lib/env')
      env = envModule.env
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown env import error')
      importError = { step: 'env import', error: error.message, stack: error.stack?.split('\n').slice(0, 5) }
    }
    
    try {
      const authModule = await import('@/auth')
      authFn = authModule.auth
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown auth import error')
      importError = importError || { step: 'auth import', error: error.message, stack: error.stack?.split('\n').slice(0, 5) }
      if (importError.step !== 'auth import') {
        importError = { step: 'auth import', error: error.message, stack: error.stack?.split('\n').slice(0, 5) }
      }
    }
    
    if (importError) {
      return Response.json({ ok: false, importError }, { status: 500 })
    }
    
    const envCheck = {
      hasSecret: !!env?.NEXTAUTH_SECRET,
      hasClientId: !!env?.TWITCH_CLIENT_ID,
      hasUrl: !!env?.NEXTAUTH_URL,
      secretLength: env?.NEXTAUTH_SECRET?.length || 0,
    }
    
    if (!authFn) {
      return Response.json({ ok: false, error: 'auth function not available' }, { status: 500 })
    }

    try {
      const session = await authFn()
      return Response.json({ ok: true, session, envCheck })
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown auth() error')
      return Response.json({
        ok: false,
        step: 'auth() call',
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 15).join('\n'),
        name: error.name,
        envCheck,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('AUTH_ERROR in debug route:', error)
    return Response.json(
      {
        ok: false,
        step: 'top-level',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 15).join('\n') : undefined,
        name: error instanceof Error ? error.name : undefined,
      },
      { status: 500 }
    )
  }
}
