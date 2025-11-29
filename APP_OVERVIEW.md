# Demo Raffle v1 – Current Application Overview

> A factual snapshot of how the Twitch-integrated raffle app is implemented **today**. Every section below is sourced directly from the repository so new contributors can trust it while debugging, extending, or deploying the project.

---

## Contents

1. [Product Scope](#product-scope)
2. [Technology Stack](#technology-stack)
3. [Repository Layout](#repository-layout)
4. [Data Model (Prisma)](#data-model-prisma)
5. [Authentication & Broadcaster Flow](#authentication--broadcaster-flow)
6. [Twitch Integration](#twitch-integration)
7. [API Surface](#api-surface)
8. [Frontend Surfaces & Components](#frontend-surfaces--components)
9. [Raffle, Weight & Entry Flows](#raffle-weight--entry-flows)
10. [Supporting Libraries](#supporting-libraries)
11. [Configuration & Deployment Notes](#configuration--deployment-notes)
12. [Additional Docs](#additional-docs)

---

## Product Scope

Demo Raffle v1 lets Twitch viewers log in, prove they follow the broadcaster, and enter a weighted raffle whose odds reflect long-term engagement (subs, bits, donations, gifted subs, carry-over weight). Key behaviors that exist in the codebase:

- **Twitch OAuth + follow gate** – Everyone must sign in with Twitch (`next-auth`) and be recorded as a follower in our DB before entering.
- **Weighted raffle logic** – `lib/weight-settings.ts` caps every weight source, while admin endpoints recompute weights in batches to prevent whales.
- **Live leaderboards & status** – `/api/leaderboard` powers both the landing page and the demo portal, with 5s polling on the client.
- **Carry-over + reset tooling** – `/api/twitch/carry-over` and `/api/demo-played` move weight between streams and reset bonus weight after a demo is played.
- **Broadcaster-only admin** – `/app/demo-admin` is a NextAuth-protected panel for the broadcaster to manage entries, edit weight settings, and draw a winner. The legacy `/admin` page remains but no longer grants real access.
- **EventSub ingestion** – `/api/twitch/webhook` verifies Twitch HMAC signatures, deduplicates events (`ProcessedWebhookEvent`), and folds subscription/cheer/follow data back into `User` weights.

---

## Technology Stack

| Layer | Libraries / Services |
| --- | --- |
| Runtime | Next.js 16.0.1 (App Router), React 19.2, TypeScript 5 |
| Auth | NextAuth.js 5 beta + Prisma adapter, Twitch OAuth/OIDC |
| Database | PostgreSQL (Supabase/Vercel Postgres compatible), Prisma 6.18 |
| UI | Tailwind CSS 4 (through PostCSS), client/server components |
| Twitch APIs | Custom Helix fetchers, EventSub webhook handler, `@twurple/*` packages (used by scripts/tests) |
| Validation / Tooling | Zod (env validation), ESLint 9, dotenv for scripts |

---

## Repository Layout

```
app/
  api/                 # Route handlers (serverless on Vercel)
    admin/             # Broadcaster-only CRUD + dashboard data
    auth/              # NextAuth handler + /debug inspection route
    demo-played/
    enter/
    health/{app,db}/
    leaderboard/
    pick-winner/
    twitch/{sync,check-follow,update-weights,carry-over,webhook}
    user/submission/
    winner/
  admin/               # Legacy password/token-gated UI (not session-aware)
  components/          # Reusable client components (forms, tables, wheel, etc.)
  demo-admin/          # Modern admin dashboard (server component + client shell)
  demo-portal/         # Authenticated user hub
  page.tsx             # Public landing page + entry form
lib/
  admin-auth.ts        # `requireAdminSession()` helper
  admin-data.ts        # Shared entry listing logic for admin APIs/UI
  auth.ts              # NextAuth config (see section below)
  env.ts               # Zod-based env validation
  prisma.ts            # Prisma client w/ dev hot-reload guard
  rate-limit.ts        # Dev-only in-memory limiter used by `/api/enter`
  draw-lock.ts         # Documented no-op (transactions handle locking)
  twitch-api.ts        # Helix helpers (followers, subscriptions, user info)
  twitch-oauth.ts      # Token refresh + broadcaster access token retrieval
  weight-settings.ts   # Cached weight config + calculator
prisma/
  schema.prisma        # Models: User, Entry, Account, Session, ProcessedWebhookEvent, WeightSettings
  migrations/          # Historical migrations
types/
  admin.ts             # Entry shape for admin UI/API
  next-auth.d.ts       # Session/user extensions (isFollower/isBroadcaster)
docs/                  # Additional setup + deployment guides
APP_OVERVIEW.md        # This file
auth.ts                # Re-exports `NextAuth(authOptions)`
```

---

## Data Model (Prisma)

- **User** – Core Twitch identity (id, twitchId, username, displayName, avatar, OAuth mirror fields). Tracks engagement metrics (`totalCheerBits`, `totalDonations`, `totalGiftedSubs`, `resubCount`), subscription state (`isSubscriber`, `subMonths`, `totalSubs`), follow flag, calculated weights (`currentWeight`, `carryOverWeight`, `totalWeight`), and timestamps (`lastUpdated`, `lastActive`). Relations to `Entry`, `Account`, and `Session`.
- **Entry** – Raffle entry tied to a user (optional because historical entries might predate required login). Stores `demoLink`, email, `isWinner`, optional `streamId`.
- **Account/Session** – NextAuth tables generated by Prisma adapter; Account rows mirror Twitch tokens.
- **ProcessedWebhookEvent** – Deduplication log (unique `messageId`, `eventType`, `twitchUserId`, `processedAt` indexes).
- **WeightSettings** – Single-row config containing every multiplier/cap the calculator uses. IDs are `cuid()` and `getWeightSettings()` keeps a 60s in-memory cache to cut DB load.

---

## Authentication & Broadcaster Flow

All logic lives in `lib/auth.ts` and is exported through `auth.ts` for route handlers and server components.

### Provider configuration
- Twitch provider uses **OIDC scopes** (`openid user:read:email`) plus `state` and `pkce` checks, aligning with Auth.js v5 guidance.
- Prisma adapter is used with JWT sessions (`strategy: 'jwt'`) and `trustHost: true` for App Router deployments.

### `updateUserTwitchData(userId, accessToken)`
- Fetches the viewer’s profile via `getUserInfo` (user access token).
- Attempts to fetch a broadcaster token using `getBroadcasterAccessToken()`. If that throws (e.g., broadcaster hasn’t signed in yet), we log a warning **only in development** and continue with `null`.
- Only when a broadcaster token exists do we call `checkUserFollowsChannel()` and `getUserSubscription()`. Each call is wrapped in its own `try/catch`; failures log and fall back to safe defaults (`isFollower = false`, `subscription = non-subscriber`).
- Upserts the user record with fresh Twitch profile data, latest follow/subscriber booleans, subscription months, and timestamps. Any error propagates to the caller (the sign-in callback handles the throwable).

### Sign-in callback
- Runs only for Twitch provider logins with an access token.
- Computes `isBroadcasterAccount` by comparing `account.providerAccountId` to `env.TWITCH_BROADCASTER_ID`.
- Calls `updateUserTwitchData` inside a `try/catch`. Errors never block login; in development we log `console.error('updateUserTwitchData failed…')`.
- **Follow gate for viewers**: Non-broadcaster accounts trigger a DB lookup (`prisma.user.findUnique({ select: { isFollower } })`). If the viewer still isn’t marked as a follower after the sync, sign-in returns `false` and NextAuth aborts the login.
- Broadcaster accounts are always allowed through (we already need their session online to refresh tokens and use the admin panel).

### JWT callback
- Stores Twitch tokens (`access_token`, `refresh_token`, `expires_at`) on `token.twitch`.
- Checks a 5-minute buffer (`TOKEN_REFRESH_BUFFER_MS`) and refreshes via `refreshTwitchAccessToken()` when needed.
- Writes refreshed tokens back to the Prisma `Account` row when `providerAccountId` is known.

### Session callback
- Ensures `session.user.id` is always populated (reads from JWT `sub`).
- Looks up the user to expose `session.isFollower`.
- Marks broadcaster sessions by inspecting the JWT twitch state (`providerAccountId === env.TWITCH_BROADCASTER_ID`) and mirrors that to both `session.isBroadcaster` and `session.user.isBroadcaster`.

### Admin guard
- `lib/admin-auth.ts` wraps `auth()` and returns the session only if `session.user.isBroadcaster` is true. Every admin API route uses this helper, so any request without an authenticated broadcaster session receives `401 Unauthorized`.

---

## Twitch Integration

### Helix helpers (`lib/twitch-api.ts`)
- `checkUserFollowsChannel` and `getUserSubscription` fetch the broadcaster token lazily. A 30 s in-memory cache prevents repeated DB queries for the same invocation.
- Each helper logs and returns safe defaults instead of throwing. Consumers expect booleans and fallback subscription objects, so failure never blocks login/sync flows.

### Broadcaster tokens (`lib/twitch-oauth.ts`)
- `getBroadcasterAccessToken` reads the Twitch `Account` row for `TWITCH_BROADCASTER_ID`.
- If `refresh_token` is missing, it throws a clear error prompting the broadcaster to sign in (caught upstream).
- Uses `TOKEN_REFRESH_BUFFER_SECONDS` to refresh via the standard Twitch OAuth endpoint and persists new tokens back to Prisma.

### User sync (`app/api/twitch/sync`)
- Requires an authenticated viewer session.
- Enforces a per-user 60s cooldown (`USER_SYNC_COOLDOWN_MS`).
- Loads the viewer’s Twitch `Account` access token from Prisma, fetches their follow/subscriber state via the broadcaster token, and recalculates weights with `calculateUserWeight`. The response exposes the sanitized `User` shape for UI components like `TwitchLogin` and `MyStatusCard`.

### EventSub webhook (`app/api/twitch/webhook/route.ts`)
- Validates Twitch HMAC signatures, rejects stale timestamps (>10 min), and handles verification challenges (returns plaintext `challenge`).
- Uses `ProcessedWebhookEvent` to dedupe events inside a transaction before touching user data.
- Processes: `channel.subscribe`, `channel.subscription.message`, `channel.subscription.gift`, `channel.cheer`, `channel.follow`. Each handler updates the relevant counters on `User` and calls the shared weight recalculator.
- Even on processing errors, the handler responds with 2XX to avoid webhook revocation (errors are logged).

---

## API Surface

### Public (no session required)
- `GET /api/leaderboard` – Returns `{ submissionsOpen, totalEntries, entries[] }`. It derives `submissionsOpen` from `Entry.isWinner` and includes probability-per-entry for the top 20 weights.
- `GET /api/winner` – Returns the first winner or `null`.
- `GET /api/health/app` – Process uptime + version.
- `GET /api/health/db` – Runs `SELECT 1` via Prisma to confirm DB connectivity.

### Authenticated viewer routes
- `POST /api/enter` – Validates session, follow flag, rate limits by IP (`checkRateLimit('ip:…', 10/hr)`) and user (5/hr), enforces unique active entries, verifies demo links (SoundCloud / Drive / Dropbox) and creates a Prisma `Entry` with optional demo link + email.
- `POST /api/twitch/check-follow` – Returns `{ isFollower }` from the stored `User` record.
- `POST /api/twitch/sync` – Described above; returns `{ success, user, skipped? }`.
- `GET /api/user/submission` – Returns the viewer’s current non-winning entry if one exists.

### Broadcaster-only admin routes (all call `requireAdminSession`)
- `GET /api/admin/dashboard` – Bundles entries (`getAdminEntries`) and `WeightSettings` for initial render.
- `GET /api/admin/entries` – Accepts `search`, `sortBy=name|weight`, `sortOrder=asc|desc` query params before returning formatted entries for the table.
- `DELETE /api/admin/entries/[id]` – Deletes an entry (validates numeric `id`).
- `GET /api/admin/weight-settings` / `PUT /api/admin/weight-settings` – Fetch and update `WeightSettings`. PUT accepts partial payloads, coercing numbers and validating everything before saving.
- `GET /api/admin/auth` – Simple `{ authenticated, user }` response for client polling (POST/DELETE return 405).
- `POST /api/pick-winner` – Runs a weighted random draw inside a 5 s Prisma transaction, marks the winner, resets some engagement counters, recalculates weight for the winning user, and returns metadata for the `RaffleWheel`.
- `POST /api/demo-played` – Resets bits/gifted subs for a specific user and recalculates their weight.
- `POST /api/twitch/update-weights` – Optionally filters by `streamId`, batches users (25 per chunk), recomputes weights via `calculateUserWeight`, and writes current/total weight inside a transaction.
- `POST /api/twitch/carry-over` – Accepts `{ streamId?, resetWeights? }`, finds non-winners, sets their `carryOverWeight` to either 0 or `user.totalWeight * 0.5`, normalizes `currentWeight`, and clears the winner’s carry-over if needed.

### Legacy routes
- `/app/admin` still exists for reference and still asks for `ADMIN_TOKEN`, but every modern API ignores that header and trusts NextAuth broadcaster sessions instead. Treat it as a deprecated UI.
- `POST /api/twitch/webhook` – Discussed above.
- `app/api/auth/debug` – Diagnostic endpoint that tries to import `env` and `auth()` separately to surface runtime issues.

---

## Frontend Surfaces & Components

### Landing page (`app/page.tsx`)
- Client component wrapped in a `SessionProvider`.
- Fetches `/api/winner` once, `/api/leaderboard` every 5 s, and `/api/twitch/check-follow` after login.
- Shows `TwitchLogin`, entry form (name only—demo links handled in the portal), live status banner, and a scrollable Top 20 leaderboard.

### Demo portal (`app/demo-portal/page.tsx`)
- Authenticated “viewer dashboard” with the same status banner, `TwitchLogin`, `DemoSubmissionForm` (calls `/api/enter` + `/api/user/submission`), `MyStatusCard` (weights from `/api/twitch/sync`) and a read-only `WeightTable`. Uses 5 s polling for leaderboard and displays weight settings fetched from `/api/admin/weight-settings` (read-only).

### Admin dashboard (`app/demo-admin`)
- Server component gate uses `auth()`; non-broadcaster sessions see an “Admin Access Required” screen.
- `AdminDashboardClient` mounts with `initialEntries`/`initialSettings`, polls `/api/admin/dashboard` + `/api/leaderboard` every 10 s, and exposes three tabs:
  - **Users** – `AdminUserTable` with search/sort, delete buttons (calls `/api/admin/entries/[id]`).
  - **Weights** – `AdminWeightsForm` that PUTs new settings to `/api/admin/weight-settings` and notifies the parent via `onSettingsChange`.
  - **Raffle** – `RaffleWheel` that POSTs `/api/pick-winner` and a Top 20 view for stream overlay reference.

### Shared components
- `TwitchLogin` – Sign in/out CTA plus a purple stats card that pings `/api/twitch/sync` every 2 minutes (ignores 429) and shows follower/subscriber state + weight breakdown.
- `DemoSubmissionForm` – Keeps local state, calls `/api/enter`, and renders either a submission form or the viewer’s existing entry (via `/api/user/submission`).
- `MyStatusCard` – Mirrors backend weight math client-side for a quick breakdown; polls `/api/twitch/sync`.
- `TopList` – Presentational leaderboard used by multiple pages.
- `WeightTable` – Read-only view of current multipliers/caps.
- `AdminUserTable`, `AdminWeightsForm`, `RaffleWheel` – Admin-specific UI described above.

---

## Raffle, Weight & Entry Flows

1. **Viewer login** – NextAuth handles Twitch OAuth. During `signIn`, `updateUserTwitchData` populates the `User` row and ensures viewers are marked as followers. Broadcaster accounts bypass the follow gate so they can maintain admin access even if Twitch follower data is temporarily unavailable.
2. **Entry creation** – `/api/enter` enforces login, follow state, one active entry per user, IP/user rate limits via `checkRateLimit`, and domain checks for demo links. Entries always connect to the `User` via `user: { connect: { id } }`.
3. **Weight calculation** – `calculateUserWeight` pulls cached settings (refresh every minute) and stacks contributions from sub months, resubs, bits, donations, gifted subs, and carry-over. Admin maintenance endpoints call this helper whenever engagement data changes.
4. **Raffle draw** – `/api/pick-winner` fetches all non-winning entries, performs a weighted random draw, wraps the mutation in a Prisma transaction (re-reading the specific entry for consistency), updates the winner, resets certain stats, and recalculates the winner’s weight afterwards. The response includes `spinList`, `totalWeight`, and `seed` so the client animation can replay deterministically.
5. **Carry-over** – `/api/twitch/carry-over` loops over batches of non-winners and applies 50% carry-over weight (unless `resetWeights` is true). Winners have their `carryOverWeight` zeroed.
6. **Demo played** – `/api/demo-played` is a manual reset that zeroes bits/gifted subs once a viewer’s track was featured live.

---

## Supporting Libraries

- `lib/rate-limit.ts` – Simple in-memory counter keyed by string. It is only reliable in development (documented at the top) but still helps catch obvious abuse locally. Production code must remain idempotent.
- `lib/draw-lock.ts` – Explicitly returns `true` and documents that concurrency protection relies on database transactions now.
- `lib/env.ts` – Validates all required environment variables with Zod up front (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_ID`, `TWITCH_WEBHOOK_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `ADMIN_TOKEN`). Falls back to `DIRECT_URL = DATABASE_URL` (with a dev warning) if unset.
- `lib/prisma.ts` – Creates a singleton Prisma client, logs errors/warnings in development, and attempts an eager connection to fail fast when `DATABASE_URL` is wrong.
- `lib/admin-data.ts` – Centralizes the admin entry query and filtering (search/sort) so both routes and client components share the same formatting logic.

---

## Configuration & Deployment Notes

Required environment variables (validated in `lib/env.ts`):

| Variable | Description |
| --- | --- |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Twitch App credentials |
| `TWITCH_BROADCASTER_ID` | Numeric Twitch user ID of the channel that owns the raffle/admin panel |
| `TWITCH_WEBHOOK_SECRET` | Shared secret for EventSub signature verification |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET` | Standard NextAuth config (URL must match deployment host) |
| `DATABASE_URL` | Pooled Postgres connection string (PgBouncer/Supabase) |
| `DIRECT_URL` | Direct Postgres connection for migrations (defaults to `DATABASE_URL` if omitted) |
| `ADMIN_TOKEN` | Only referenced by the legacy `/admin` page; modern APIs ignore it |

Deployment expectations:

- Vercel is the default target (`runtime = 'nodejs'`, `dynamic = 'force-dynamic'` on every route). No Edge runtimes are used.
- `npm run build` triggers Next.js build; `postinstall` runs `prisma generate`; `prisma migrate deploy` should run as part of deployment (documented in `/docs/deployment`).
- Health checks are exposed at `/api/health/app` and `/api/health/db`.
- EventSub must be configured in the Twitch Developer Console to point at `/api/twitch/webhook`.

---

## Additional Docs

- `docs/architecture/ARCHITECTURE.md` – Deep dive into the original system design.
- `docs/setup/SUPABASE_SETUP.md` / `docs/setup/TWITCH_SETUP.md` – Environment provisioning guides.
- `docs/deployment/*.md` – CI/CD and Vercel deployment walkthroughs.
- `docs/reference/DOCUMENTATION_VERSIONS.md` – Tracks historical fixes.

---

## Summary

The current Demo Raffle v1 codebase pairs a modern Next.js 16 App Router frontend with strict Auth.js (NextAuth) enforcement, Prisma-backed persistence, and Twitch Helix/EventSub integrations. Broadcaster sessions are the single source of truth for admin access, and new error-handling in `lib/auth.ts` ensures viewer logins never fail just because broadcaster tokens are missing. All API routes, components, and helper libraries documented above match the real implementation so contributors can confidently extend the raffle, weight, or admin functionality without second-guessing the architecture.

