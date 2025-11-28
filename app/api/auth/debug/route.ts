export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test imports individually to isolate the error
    let importError = null
    let env = null
    let authFn = null
    
    try {
      const envModule = await import('@/lib/env')
      env = envModule.env
    } catch (e: any) {
      importError = { step: 'env import', error: e.message, stack: e.stack?.split('\n').slice(0, 5) }
    }
    
    try {
      const authModule = await import('@/auth')
      authFn = authModule.auth
    } catch (e: any) {
      importError = importError || { step: 'auth import', error: e.message, stack: e.stack?.split('\n').slice(0, 5) }
      if (importError.step !== 'auth import') {
        importError = { step: 'auth import', error: e.message, stack: e.stack?.split('\n').slice(0, 5) }
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
    } catch (e: any) {
      return Response.json({
        ok: false,
        step: 'auth() call',
        error: e.message,
        stack: e.stack?.split('\n').slice(0, 15).join('\n'),
        name: e.name,
        envCheck,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('AUTH_ERROR in debug route:', error)
    return Response.json(
      {
        ok: false,
        step: 'top-level',
        error: error?.message || String(error),
        stack: error?.stack?.split('\n').slice(0, 15).join('\n'),
        name: error?.name,
      },
      { status: 500 }
    )
  }
}
