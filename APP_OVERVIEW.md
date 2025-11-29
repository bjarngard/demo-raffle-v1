# Demo Raffle v1 – Current Architecture Overview

> Single source of truth for how the Twitch-integrated raffle system works **right now**.

---

## 1. What the App Does

Demo Raffle v1 lets Twitch viewers authenticate with their Twitch account, sync Twitch engagement data (follow flag, subscription info, gifted subs, bits, donations, carry-over weight), and submit demos into a weighted raffle. Leaderboards refresh in real time, winners are drawn deterministically via a broadcaster-only admin panel, and Twitch EventSub keeps engagement stats up to date.

---

## 2. Tech Stack

| Layer | Details |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript 5 |
| Auth | Auth.js (NextAuth v5) + PrismaAdapter, single Twitch OAuth/OIDC provider (`openid user:read:email`, PKCE + state) |
| Database | Prisma 6.18 targeting Supabase/Vercel Postgres (pooled `DATABASE_URL`, non-pooled `DIRECT_URL`) |
| UI | Tailwind CSS 4, server + client components |
| Twitch Integration | Custom Helix fetchers, EventSub webhook, broadcaster token refresh helper |
| Utilities | Zod env validation, dev-only rate limiter, shared admin guard |

---

## 3. Authentication Flow

- **Provider setup (`lib/auth.ts`)** – Twitch OIDC with PKCE and state. `allowDangerousEmailAccountLinking` is enabled so returning users with the same email can be linked.
- **Sign-in callback** – Runs only for Twitch accounts with an access token. Calls `updateUserTwitchData(user.id, account.access_token)` inside a `try/catch`. Any error is logged in development and sign-in still returns `true` (logins never fail because of follow status or sync failures).
- **updateUserTwitchData** – Uses the viewer’s access token to fetch profile + email via `getUserInfo`, then tries to obtain a broadcaster token through `getBroadcasterAccessToken`. When a broadcaster token exists it calls:
  - `checkUserFollowsChannel(userId, broadcasterToken)` (Helix `channels/followers`).
  - `getUserSubscription(userId, broadcasterToken)` (Helix `subscriptions`).
  Each helper is wrapped in its own `try/catch` with safe defaults if Twitch is unavailable. The function upserts the User row (profile, isFollower, isSubscriber, sub months, timestamps).
- **Broadcaster token management (`lib/twitch-oauth.ts`)** – Reads the broadcaster’s `Account` + `User` records, refreshes tokens when the expiry buffer hits, persists new tokens back into both tables, and throws a descriptive error if no refresh token exists (caught upstream so login still succeeds).
- **Session callback** – Ensures `session.user.id` mirrors the JWT `sub`, fetches the User row to expose `session.isFollower`, and marks broadcaster sessions when the JWT state references `env.TWITCH_BROADCASTER_ID`. Admin APIs and server components rely on these flags through `requireAdminSession`.

---

## 4. Database Models (Prisma)

- **User** – Twitch identity plus engagement stats:
  - Keys: `id` (cuid), `twitchId` (unique), `email` (optional unique).
  - Profile fields: `username`, `displayName`, `image`, OAuth tokens.
  - Engagement: `isFollower`, `isSubscriber`, `subMonths`, `totalSubs`, `totalCheerBits`, `totalDonations`, `totalGiftedSubs`, `resubCount`.
  - Raffle data: `currentWeight`, `carryOverWeight`, `totalWeight`, `lastUpdated`, `lastActive`.
  - Relations: `entries`, `accounts`, `sessions`.
- **Entry** – Viewer submission associated with `userId`. Stores `name`, optional `email`, optional `demoLink`, `isWinner`, optional `streamId`, timestamps.
- **Account / Session** – Standard NextAuth tables populated by PrismaAdapter; Account rows mirror Twitch access/refresh tokens.
- **ProcessedWebhookEvent** – Deduplicates Twitch EventSub payloads (`messageId` unique key).
- **WeightSettings** – Single-row configuration for weight multipliers, caps, divisors, and carry-over multiplier; cached for 60 s in `lib/weight-settings.ts`.

---

## 5. Twitch Integration

- **Helix Endpoints Used**
  - `getUserInfo` (viewer token) – `/helix/users` to pull login, display name, avatar, email.
  - `checkUserFollowsChannel` (broadcaster token) – `/helix/channels/followers?broadcaster_id=<broadcaster>&user_id=<viewer>`.
  - `getUserSubscription` (broadcaster token) – `/helix/subscriptions?broadcaster_id=<broadcaster>&user_id=<viewer>`.
  Each helper logs failures and returns safe defaults so the calling code can continue.
- **Viewer vs Broadcaster Tokens**
  - Viewer access tokens arrive from Auth.js and are stored in the NextAuth Account row.
  - Broadcaster tokens are retrieved via `getBroadcasterAccessToken()`, refreshed proactively, and mirrored to both Account and User tables so Helix calls that require elevated scopes (followers, subs, bulk sync) can succeed.
- **EventSub (`app/api/twitch/webhook/route.ts`)**
  - Validates Twitch HMAC headers + timestamp drift, answers verification challenges, deduplicates events via `ProcessedWebhookEvent`, and updates User engagement counters for `channel.subscribe`, `channel.subscription.message`, `channel.subscription.gift`, `channel.cheer`, and `channel.follow`. Each event triggers a weight recalculation so odds stay consistent across the app.
- **Viewer Sync API (`POST /api/twitch/sync`)**
  - Requires an authenticated session, enforces a per-user cooldown, loads stored access tokens, re-syncs follower/subscriber status via broadcaster tokens, recalculates weights with `calculateUserWeight`, and returns the sanitized User payload for UI components.

---

EventSub handlern svarar alltid med 2XX även om intern behandling skulle misslyckas.
Fel loggas, men Twitch får aldrig 4XX/5XX så prenumerationen inte riskerar att stängas ned.

---

## 6. Raffle System

### Entry Flow (`POST /api/enter`)

1. Validates session via `auth()`.
2. Applies IP (10/hour) and per-user (5/hour) limits using the in-memory limiter.
3. Loads the User row. If missing, returns 404.
4. **Follow requirement is enforced here only.** If `user.isFollower` is false, responds with HTTP 403 and `{ error: 'NOT_FOLLOWING' }`. Auth.js sign-in never blocks for this rule.
5. Ensures one active non-winning entry per user, validates optional demo links (SoundCloud, Google Drive, Dropbox), and builds `Prisma.EntryCreateInput` with `user: { connect: { id: session.user.id } }`.
6. Persists the entry and returns `{ success: true, id }`.

### Weight System

- `calculateUserWeight` uses cached `WeightSettings` to sum:
  - Base weight.
  - Capped contributions from subscription months, resubs, bits, donations, gifted subs.
  - Carry-over multiplier applied to leftover weight from previous raffles.
- Admin maintenance endpoints (`/api/twitch/update-weights`, `/api/twitch/carry-over`, `/api/demo-played`) recalibrate weights in batches after new engagement data arrives or after a demo is played.

### Leaderboards & Winner Selection

- `GET /api/leaderboard` – Returns `submissionsOpen`, `totalEntries`, and the top 20 entries with probability percentages. Clients poll every 5 seconds.
- `GET /api/winner` – Fetches the latest winner (or `null`).
- `POST /api/pick-winner` – Broadcaster-only. Loads all open entries, performs a weighted random draw inside a Prisma transaction, marks the winner, resets relevant engagement counters, recalculates weights, and returns deterministic animation metadata (`spinList`, `seed`, `winner`) for `RaffleWheel`.
- `POST /api/twitch/carry-over` – Applies 50% carry-over weight to non-winners (or resets weights when requested).
- `POST /api/demo-played` – Resets bits/gifted subs for a specific user after their demo airs.

---

## 7. Admin Functionality

- **UI (`app/demo-admin`)**
  - Server component gate uses `auth()`; only broadcaster sessions reach the dashboard.
  - `AdminDashboardClient` hydrates with `initialEntries` + `initialSettings`, then polls `/api/admin/dashboard` and `/api/leaderboard`.
  - Tabs:
    1. **Users** – `AdminUserTable` with search/sort/remove (backs `/api/admin/entries` + `DELETE /api/admin/entries/[id]`).
    2. **Weights** – `AdminWeightsForm` editing `WeightSettings` via `PUT /api/admin/weight-settings`.
    3. **Raffle** – `RaffleWheel` trigger for `/api/pick-winner` plus a Top 20 snapshot for overlays.

- **APIs (all call `requireAdminSession`)**
  - `/api/admin/dashboard` – Bundled entries + weight settings for hydration.
  - `/api/admin/entries` – Search/sort listing.
  - `/api/admin/entries/[id]` – Deletion endpoint.
  - `/api/admin/weight-settings` – Fetch/update multipliers.
  - `/api/admin/auth` – Session heartbeat for the client shell.
  - `/api/demo-played`, `/api/twitch/update-weights`, `/api/twitch/carry-over` – Maintenance utilities described above.

- **Legacy `/admin`** – Still in the repo but only checks `ADMIN_TOKEN`; modern APIs ignore that token. Treat as deprecated UI.

---

## 8. Other Systems & Utilities

- **Rate limiter (`lib/rate-limit.ts`)** – Map-based in-memory limiter used by `/api/enter`; documented as a development fallback.
- **Env validation (`lib/env.ts`)** – Zod schema ensures `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_ID`, `TWITCH_WEBHOOK_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `DIRECT_URL`, and `ADMIN_TOKEN` exist before boot.
- **Prisma client (`lib/prisma.ts`)** – Singleton with dev-mode global caching and eager connection attempts for faster failure when env vars are wrong.
- **Admin data helper (`lib/admin-data.ts`)** – Shared entry formatting for both admin APIs and React components.
- **Docs (`/docs`)** – Contain setup, Twitch configuration, Supabase provisioning, and deployment guides.

---

## 9. Key Behavioral Rules

1. **Login always succeeds for valid Twitch accounts.** The Auth.js `signIn` callback never returns `false`; it only logs failures from `updateUserTwitchData`.
2. **Follow enforcement lives exclusively in `/api/enter`.** Non-followers receive `403 { error: 'NOT_FOLLOWING' }` and the frontend must surface the “follow the channel” CTA (link to `https://www.twitch.tv/bossfight`).
3. **Broadcaster tokens are required for Helix follower/subscription checks** and are refreshed automatically when nearing expiry.
4. **Admin actions require broadcaster sessions.** `requireAdminSession` blocks every sensitive route; the legacy `ADMIN_TOKEN` UI no longer grants API access.
5. **EventSub + sync endpoints recalculate weights through shared helpers**, so odds remain consistent across the app, admin dashboard, and backend selection logic.

---

## Repository Layout (high level)

- app/
  - page.tsx – Public landing + basic leaderboard
  - demo-portal/ – Authenticated viewer dashboard
  - demo-admin/ – Broadcaster-only admin UI
  - api/
    - enter/ – Entry creation endpoint
    - leaderboard/ – Public leaderboard data
    - winner/ – Latest winner
    - twitch/{sync, webhook, update-weights, carry-over}/ – Twitch sync & maintenance
    - admin/{dashboard, entries, weight-settings, auth}/ – Admin API
    - health/{app, db}/ – Health checks
- lib/
  - auth.ts – Auth.js config and callbacks
  - twitch-api.ts – Helix helpers
  - twitch-oauth.ts – Broadcaster token management
  - weight-settings.ts – Weight config + calculator
  - rate-limit.ts, admin-auth.ts, admin-data.ts, env.ts, prisma.ts – infra helpers
- prisma/
  - schema.prisma – DB models
  - migrations/ – Schema history
- docs/ – Setup, Twitch, Supabase, deployment guides




This document should be updated whenever authentication behavior, Twitch integration, or raffle logic changes so future contributors can trust it as an accurate map of the system.

