# Documentation Versions Reference

**⚠️ CRITICAL: Always check documentation for the EXACT versions listed below, not the latest versions.**

This file serves as a reference for which documentation versions to use when working on this project.

## Core Dependencies

### Next.js
- **Installed Version**: `16.0.1` (exact, no range)
- **Docs**: https://nextjs.org/docs (filtered for v16)
- **App Router**: Yes (this project uses App Router)
- **Important Notes**:
  - ⚠️ `runtime` values: `'nodejs'`, `'edge'`, `'experimental-edge'` (NOT `'node'`)
  - Route segments: https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
  - **CRITICAL**: Next.js 16.0.1 does NOT accept `runtime = 'node'` - must use `'nodejs'`

### NextAuth.js (Auth.js)
- **Installed Version**: `5.0.0-beta.30` (exact beta version)
- **Docs**: https://authjs.dev/getting-started/installation
- **Beta Documentation**: https://authjs.dev/reference/nextjs
- **Important Notes**:
  - ⚠️ Uses `export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)`
  - Handlers are `handlers.GET` and `handlers.POST` (not direct export)
  - Session strategy can be `'database'` or `'jwt'`
  - Prisma adapter: `@auth/prisma-adapter@^2.11.1`
  - **DO NOT** use NextAuth v4 patterns - this is v5 beta

### Prisma
- **Installed Version**: `6.18.0` (exact)
- **Prisma Client**: `@prisma/client@6.18.0` (exact)
- **Docs**: https://www.prisma.io/docs (Prisma 6.x)
- **Important Notes**:
  - App Router compatible
  - Client generation: `prisma generate --no-engine` (for production)
  - Migrations: `prisma migrate dev`

### React
- **Installed Version**: `19.2.0` (exact)
- **React DOM**: `19.2.0` (exact)
- **Docs**: https://react.dev (React 19)
- **Important Notes**:
  - Using Server Components by default
  - Client Components require `'use client'` directive
  - **DO NOT** use React 18 patterns - this is React 19

### TypeScript
- **Version**: Check with `npx tsc --version`
- **Docs**: https://www.typescriptlang.org/docs

### Zod
- **Installed Version**: `4.1.12` (exact)
- **Docs**: https://zod.dev (check for v4.x documentation)
- **Important**: 
  - ⚠️ Version 4 has breaking changes from v3
  - Use `parsed.error.issues` (NOT `parsed.error.errors`)
  - SafeParse returns `{ success: boolean, data?: T, error?: ZodError }`

## Additional Dependencies

### @auth/prisma-adapter
- **Version**: `^2.11.1`
- **Docs**: https://authjs.dev/reference/adapter/prisma
- Used with NextAuth v5 beta

### @twurple/api
- **Version**: `^7.4.0`
- **Docs**: https://twurple.js.org/
- **Twitch API**: https://dev.twitch.tv/docs/api

### @twurple/auth
- **Version**: `^7.4.0`
- **Docs**: https://twurple.js.org/packages/auth

### Tailwind CSS
- **Version**: `^4`
- **Docs**: https://tailwindcss.com/docs
- **PostCSS**: `@tailwindcss/postcss@^4`

## Twitch API References

- **EventSub**: https://dev.twitch.tv/docs/eventsub
- **Helix API**: https://dev.twitch.tv/docs/api
- **Webhook Events**: https://dev.twitch.tv/docs/eventsub/handling-webhook-events
- **Subscription Types**: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types

## Common Mistakes to Avoid

1. ❌ **Next.js runtime**: Using `runtime = 'node'` → ✅ Use `runtime = 'nodejs'`
2. ❌ **NextAuth v4 patterns** → ✅ Use NextAuth v5 beta patterns
3. ❌ **Zod v3 syntax** → ✅ Use Zod v4 syntax (`parsed.error.issues`, not `parsed.error.errors`)
4. ❌ **Pages Router patterns** → ✅ Use App Router patterns
5. ❌ **React 18 patterns** → ✅ Use React 19 compatible patterns

## How to Check Documentation

When encountering errors or uncertainties:

1. **First**: Open `DOCUMENTATION_VERSIONS.md` (this file)
2. **Check package.json** for exact version if not listed here
3. **Run version check**: `npm list <package-name>` to see exact installed version
4. **Use version-specific docs**: Look for version selector on documentation site
5. **Check migration guides**: Look for breaking changes between versions
6. **Verify runtime/edge compatibility**: Some features differ between `nodejs` and `edge` runtimes
7. **Common mistakes**: Check "Common Mistakes to Avoid" section below

## Version Check Commands

```bash
# Check exact installed versions
npm list next next-auth @prisma/client react react-dom zod

# Check Next.js version
npx next --version

# Check Prisma version
npx prisma --version
```

---

**Last Updated**: 2025-01-29
**Project**: Demo Raffle v1

