# APP System Reference

> Definitive internal map of the current `demo-raffle-v1` Twitch raffle implementation. Update this file whenever authentication, session, or raffle behavior changes.

---

## 1. Overview & Purpose

`demo-raffle-v1` is a Twitch-authenticated demo raffle. Viewers sign in with Twitch, sync their engagement data, and submit exactly one demo per active raffle session. Entries are weighted using Twitch subscription stats, cheering, donations, gifted subs, and carry-over weight. The broadcaster-controlled admin dashboard manages raffle sessions, toggles submissions, applies carry-over, and deterministically picks winners without affecting the submissions toggle.

---

## 2. Tech Stack & Versions

| Layer | Details (from `package.json`) |
| --- | --- |
| Framework | Next.js **16.0.1** (App Router) |
| UI Runtime | React **19.2.0** + React DOM **19.2.0** |
| Language | TypeScript **^5** (strict, `tsconfig.json`) |
| Auth | Auth.js / NextAuth **5.0.0-beta.30** with PrismaAdapter |
| ORM | Prisma **6.18.0** (`@prisma/client` + CLI) |
| Styling | Tailwind CSS **^4** (via `@tailwindcss/postcss`) |
| Twitch SDK | `@twurple/api` **7.4.0**, `@twurple/auth` **7.4.0** |
| Validation / Tooling | Zod **4.1.12**, ESLint **9**, `tsx` runner **4.20.6** |

> External behavior (Auth.js, Prisma, Twitch Helix) must follow the official documentation for the versions listed above.

---

## 3. Application Architecture & Routing

### 3.1 App Router Pages

- `/` – Public landing + viewer entry form + top 20 leaderboard snapshot. Uses client components with `SessionProvider`.
- `/demo-portal` – Authenticated viewer dashboard (status card, submission form, leaderboard, latest winner messaging). Polls `/api/leaderboard` and `/api/winner`.
- `/demo-admin` – Broadcaster-only dashboard. Server component guard via `auth()`, client-side polling via `AdminDashboardClient`.
- `/admin` – Deprecated legacy UI guarded only by `ADMIN_TOKEN` (kept for backwards compatibility; APIs rely on broadcaster auth instead).

### 3.2 API Surface (App Router `/api/**`)

| Route | Method | Auth | Description |
| --- | --- | --- | --- |
| `/api/enter` | POST | Viewer session (`auth()`) | Creates a new raffle entry if submissions are open, a session is active, the user follows, and they have no pending entry. Returns `{ success: true, id }` or structured error codes. |
| `/api/leaderboard` | GET | Public | Returns `{ submissionsOpen, totalEntries, entries[], sessionId }` scoped to the active session (or empty payload if none). |
| `/api/winner` | GET | Public | Returns latest winner for the active session; falls back to the most recent ended session. |
| `/api/user/submission` | GET | Viewer session | Returns `{ hasSubmission, submission }` prioritizing the current session, then any pending entry. |
| `/api/pick-winner` | POST | `requireAdminSession` | Picks a weighted winner among non-winning entries in the active session, marks them as winner, recalculates weight, and returns raffle wheel metadata. Never toggles submissions. |
| `/api/admin/dashboard` | GET | `requireAdminSession` | Hydrates admin UI with entries (active session only), weight settings, submissions flag, and current/last sessions. |
| `/api/admin/entries` | GET | `requireAdminSession` | Search/sort listing of entries for the active session. |
| `/api/admin/entries/[id]` | DELETE | `requireAdminSession` | Removes a specific entry (used for moderation). |
| `/api/admin/submissions` | GET/POST | `requireAdminSession` | Reads or toggles the global submissions-open sentinel entry. This is the only place that calls `setSubmissionsOpen()`. |
| `/api/admin/session/start` | POST | `requireAdminSession` | Starts a new `RaffleSession` (optional `name` in body). Throws `ACTIVE_SESSION_EXISTS` if one is already active; also moves non-winning entries from the latest ended session into the new one. |
| `/api/admin/session/end` | POST | `requireAdminSession` | Ends the current session, applies carry-over via `applyCarryOverForSession`, and returns `{ session, carryOver }`. Accepts optional `{ resetWeights?: boolean }`. |
| `/api/admin/weight-settings` | GET/PUT | `requireAdminSession` | Fetches or updates the single-row `WeightSettings` table. |
| `/api/admin/auth` | GET | `requireAdminSession` | Lightweight heartbeat for the admin shell. |
| `/api/twitch/sync` | POST | Viewer session | Forces Twitch data sync (follower/sub state) with cooldown. Uses broadcaster token for Helix follower/subscription endpoints. |
| `/api/twitch/carry-over` | POST | `requireAdminSession` | Applies carry-over using the shared helper. Accepts `{ sessionId?, resetWeights? }`, otherwise defaults to the current session. Returns errorCode `NO_ACTIVE_SESSION` if neither is provided. |
| `/api/twitch/update-weights` | POST | `requireAdminSession` | Recalculates user weights in bulk (implementation unchanged by session work). |
| `/api/twitch/check-follow` | POST | Viewer session | Re-validates follow status (used by frontend gating). |
| `/api/twitch/webhook` | POST | Public (Twitch) | Handles EventSub verification, HMAC validation, and engagement updates. Always responds 2xx to avoid subscription invalidation. |
| `/api/demo-played` | POST | `requireAdminSession` | Resets bits/gifted subs metrics after a user’s demo is played. |
| `/api/health/app`, `/api/health/db` | GET | Public | Health checks for deployment. |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js handlers | Generated by NextAuth (no custom logic here). |

---

## 4. Data Model (Prisma)

All models live in `prisma/schema.prisma`. Key tables:

### `User`
- `id String @id @default(cuid())`
- `twitchId String? @unique`
- `email String?` (optional, no global unique constraint)
- Profile: `username`, `displayName`, `image`.
- Engagement counters: `isFollower`, `isSubscriber`, `subMonths`, `resubCount`, `totalCheerBits`, `totalDonations`, `totalGiftedSubs`, `totalSubs`.
- Weight fields: `currentWeight`, `carryOverWeight`, `totalWeight`, `lastUpdated`, `lastActive`.
- Relations: `entries` (`Entry[]`), `sessions` (NextAuth sessions), `accounts` (NextAuth accounts).

### `Entry`
- `id Int @id @default(autoincrement())`
- `userId String?` → optional relation to `User`.
- `name String`, `email String?`, `demoLink String?`, `createdAt DateTime @default(now())`, `isWinner Boolean @default(false)`, `streamId String?` (legacy metadata).
- `sessionId String` → required relation to `RaffleSession`.
- Indexes: `@@index([sessionId])`, `@@unique([sessionId, userId])` to enforce "one entry per user per session".
- **Sentinel row:** `lib/submissions-state.ts` creates/updates a special entry with `email = submissions-state@demo-raffle.local`, `userId = '__SYSTEM_SENTINEL__'`, `streamId = '__STATE__'`, and `sessionId` pointing to the system session. `entryStateExclusion` filters out this entry via `email: { not: SUBMISSIONS_STATE_EMAIL }`.

### `RaffleSession`
- `id String @id @default(cuid())`
- `name String?`
- `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, `endedAt DateTime?`
- `status String @default("ACTIVE")` – semantic values: `'ACTIVE'`, `'ENDED'`, `'SYSTEM'` (system sentinel).
- `entries Entry[]`

### Other Supporting Models
- `Account`, `Session` – standard Auth.js tables.
- `ProcessedWebhookEvent` – stores Twitch EventSub message IDs to avoid reprocessing.
- `WeightSettings` – single-row table storing multipliers/caps/divisors for weight calculations.

---

## 5. Auth, Sessions & Admin Access

- Auth is configured via `lib/auth.ts` using NextAuth 5 + PrismaAdapter.
- Twitch provider scopes: `openid user:read:email user:read:follows moderator:read:followers channel:read:subscriptions` with PKCE + state. `allowDangerousEmailAccountLinking` is enabled to merge returning users by email.
- `signIn` callback only attempts `updateUserTwitchData` (viewer access token + broadcaster token for follow/sub checks). Failures are logged (development) but do not block login.
- `jwt` callback stores Twitch token info and refreshes viewer tokens via `refreshTwitchAccessToken` when inside a 5-minute buffer.
- `session` callback:
  - Ensures `session.user.id` exists.
  - Fetches `isFollower` from the database.
  - Marks `session.isBroadcaster` when the JWT provider account matches `env.TWITCH_BROADCASTER_ID`; the admin UI relies on this flag.
- `requireAdminSession` (`lib/admin-auth.ts`) wraps `auth()` and returns sessions where `session.user.isBroadcaster` is truthy. Every admin API uses this guard.
- Viewer APIs (e.g., `/api/enter`, `/api/user/submission`, `/api/twitch/sync`) call `auth()` directly; they never rely on broadcaster-only flags.

---

## 6. Sessions vs Submissions: Business Rules

### Session Lifecycle (`lib/session.ts`)
- `getCurrentSession()` – returns the latest `RaffleSession` with `status: 'ACTIVE'` and `endedAt: null`.
- `getLatestEndedSession()` – returns the most recently ended session (`status: 'ENDED'`).
- `ensureSystemSession()` – ensures a sentinel session with `status: 'SYSTEM'` exists (used by the submissions sentinel entry).
- `startNewSession(name?)` – throws `ACTIVE_SESSION_EXISTS` if a session is active, creates a new `status: 'ACTIVE'` session, then moves all non-winning entries from the latest ended session into the new session (carry-over entries continue as the same `Entry` row).
- `endCurrentSession()` – sets `endedAt` and `status: 'ENDED'` on the active session.

### Admin Session Controls
- `/api/admin/session/start` – Optional `{ name }` body. Returns `{ success, session }` or 400 if already active.
- `/api/admin/session/end` – Optional `{ resetWeights }`. Applies carry-over via `applyCarryOverForSession`, marks the session as ended, returns `{ session, carryOver }`. Does **not** toggle submissions.

### Submissions Open/Closed (`lib/submissions-state.ts`)
- `getSubmissionsOpen()` – Reads the sentinel entry (`demoLink === 'closed'` => false). If the sentinel is missing, falls back to "open unless any real winner exists", mirroring legacy behavior.
- `setSubmissionsOpen(boolean)` – Upserts the sentinel entry using the system session and sentinel user ID.
- `entryStateExclusion` – Reusable Prisma `where` snippet to exclude the sentinel (`email !== SUBMISSIONS_STATE_EMAIL`).
- Only `/api/admin/submissions` can call `setSubmissionsOpen()`. No other route mutates submissions state.

### Business Invariants

- **One entry per session:** Database constraint (`@@unique([sessionId, userId])`) and `/api/enter` enforcement (checks existing entry in the current session).
- **Global pending entry rule:** `/api/enter` scans for any non-winning entry (even from previous sessions). If found:
  - `ALREADY_SUBMITTED_THIS_SESSION` – existing entry in current session.
  - `PENDING_ENTRY_FROM_PREVIOUS_SESSION` – pending entry carried over from an older session. Users must wait until it wins.
- **Sessions vs submissions are independent axes:** Admins may start/end sessions and open/close submissions in any order. Picking a winner or ending a session never toggles submissions.
- **Sentinel row exclusion:** All entry queries that power user/admin views (`leaderboard`, `pick-winner`, `admin dashboard`, `carry-over`, etc.) include `...entryStateExclusion`.

---

## 7. Twitch Integration

- **OAuth Provider:** Twitch OIDC with scopes listed above. Viewer tokens are stored via PrismaAdapter; broadcaster tokens are stored in the broadcaster’s Account/User rows and refreshed via `lib/twitch-oauth.ts`.
- **Helix Endpoints (via `lib/twitch-api.ts`):**
  - `/helix/users` (viewer token) – profile/email.
  - `/helix/channels/followers` (broadcaster token + `moderator:read:followers`) – follower checks.
  - `/helix/subscriptions` (broadcaster token + `channel:read:subscriptions`) – subscriber tier/months.
- **EventSub (`app/api/twitch/webhook/route.ts`):**
  - Validates HMAC signature (`Twitch-Eventsub-Message-Signature`) + timestamp drift.
  - Deduplicates via `ProcessedWebhookEvent`.
  - Handles `channel.subscribe`, `channel.subscription.message`, `channel.subscription.gift`, `channel.cheer`, `channel.follow`.
  - Updates engagement counters and recalculates weights using shared helpers.
  - Always returns 2xx to comply with Twitch requirements.
- **Viewer Sync (`/api/twitch/sync`)** – Rate-limited fetch that uses broadcaster tokens to refresh follow/sub status and recalculates weight via `calculateUserWeight`.
- **Diagnostic Script (`scripts/twitch-diagnose.ts`, `npm run twitch:diagnose`)** – CLI utility that loads env vars, acquires the broadcaster token, and calls `helix/channels/followers` plus `helix/subscriptions`. Logs HTTP status and snippets to detect missing scopes. Safe for production since it only performs reads.

> Scopes and endpoint requirements may change upstream; consult Twitch Helix docs if requests fail.

---

## 8. Carry-over Logic

- `lib/carry-over.ts` exports `applyCarryOverForSession(sessionId: string, resetWeights = false)`:
  - Finds all users with non-winning entries in the target session (excluding sentinel entry).
  - Processes users in batches of 25, updating each user’s `carryOverWeight`, `currentWeight` (reset to 1.0), `totalWeight` (1.0 + carryOver), and `lastUpdated`.
  - If `resetWeights` is `true`, carry-over is set to `0`.
  - After updating, resets the winner’s `carryOverWeight` (if the session already has a winner) to ensure they start fresh.
- `/api/admin/session/end` automatically calls this helper before marking the session as ended.
- `/api/twitch/carry-over` exposes the helper via API for manual runs or for targeting a specific `sessionId`. Returns `{ success, updatedCount, users[] }`.
- Intent: Each pending entry persists across sessions (same `Entry` row, new `sessionId` on start) and inherits increased weight until it wins; winners reset to base weight plus any fresh engagement.

---

## 9. Frontend Surfaces

### `/` (Public Landing + Entry Form)
- Wrapped in `SessionProvider`. Behavior:
  - **Not logged in:** Shows Twitch login CTA, requirements banner (follow needed).
  - **Logged in but not following:** `/api/twitch/check-follow` informs UI; shows “Follow required” card and reuses Twitch login button.
  - **Logged in & following:** Renders entry form with state derived from `/api/leaderboard`.
    - **No active session (`sessionId` null):** Inline info card (“The raffle is not currently running”); form disabled.
    - **Submissions closed:** Inline card referencing latest winner (from `/api/winner` if available). Form disabled.
    - **Submissions open + active session:** Form enabled unless user already submitted.
  - Success state shows “Thank you for entering!” card.
- Error handling from `/api/enter`:
  - `SUBMISSIONS_CLOSED` → “Submissions are currently closed.”
  - `NO_ACTIVE_SESSION` → “The raffle is not currently running.”
  - `ALREADY_SUBMITTED_THIS_SESSION` → “You already have an active submission for this session.”
  - `PENDING_ENTRY_FROM_PREVIOUS_SESSION` → “You already have a pending submission with accumulated weight...”
  - `EMAIL_ALREADY_REGISTERED` → Unique email conflict.
  - `NOT_FOLLOWING` (403) → Not explicitly coded with `errorCode`, but upstream UI already blocks form for non-followers.

### `/demo-portal` (Viewer Dashboard)
- Client page with `SessionProvider`. Polls `/api/leaderboard`, `/api/winner`, `/api/admin/weight-settings` (for weight table), and `/api/user/submission`.
- Inline messaging mirrors `/api/leaderboard` response:
  - No active session (`sessionId` null) → Yellow banner “No active session”.
  - Submissions closed + winner → “Submissions are currently closed. Latest winner: <name>.”
  - Submissions closed + no winner → “Submissions are currently closed.”
- `DemoSubmissionForm` receives `submissionsOpen` + `sessionActive` flags, disables itself when either is false, and surfaces all error codes described above.
- Additional components: `MyStatusCard` (viewer’s submission + sync data), `TopList` (leaderboard), `WeightTable`.

### `/demo-admin`
- Server component ensures broadcaster session; otherwise shows “Admin Access Required” card.
- Fetches `weightSettings`, `submissionsOpen`, `currentSession`, `lastEndedSession`, and current-session entries for hydration.
- `AdminDashboardClient` (client component):
  - Polls `/api/admin/dashboard` + `/api/leaderboard` every 10s.
  - Displays session status panel (active vs none, last ended timestamp) with buttons:
    - “Start new session” → `/api/admin/session/start`.
    - “End session” → `/api/admin/session/end`.
  - Displays separate submissions panel for toggling `/api/admin/submissions`.
  - Tabs for user table, weight settings form, and raffle wheel (triggers `/api/pick-winner`).

---

## 10. Error Codes & Expected Responses

| Code / Message | Endpoint(s) | Meaning | UI Handling |
| --- | --- | --- | --- |
| `SUBMISSIONS_CLOSED` | `/api/enter` | Submissions toggle is off; form must be disabled. | Landing page + demo portal show closed messaging. |
| `NO_ACTIVE_SESSION` | `/api/enter`, `/api/twitch/carry-over` | No active session is running; entries/carry-over blocked until admin starts one (or supplies sessionId). | Forms show “raffle not running” message; admin endpoints instruct to start a session. |
| `ALREADY_SUBMITTED_THIS_SESSION` | `/api/enter` | User already has a non-winning entry in the current session. | Form shows “You already have an active submission for this session.” |
| `PENDING_ENTRY_FROM_PREVIOUS_SESSION` | `/api/enter` | User has a carry-over entry from an older session; must wait for it to win. | Form shows “pending submission with accumulated weight...” |
| `EMAIL_ALREADY_REGISTERED` | `/api/enter` | Prisma unique constraint triggered (same email reused). | Form shows “This email is already registered for this round.” |
| `NOT_FOLLOWING` | `/api/enter` (403, plain string) | Viewer doesn’t follow the channel. | UI instructs user to follow on Twitch. |
| `NO_ACTIVE_SESSION` (admin JSON) | `/api/admin/session/end`, `/api/twitch/carry-over` | There is nothing to end or carry over. | Admin UI surfaces toast/message. |
| Generic `{ success: false, error: 'Unauthorized access' }` | All admin APIs | Missing broadcaster session. | Client redirects or shows login prompt. |

Other endpoints primarily return descriptive `error` strings without named `errorCode`; admin UI logs them in console.

---

## 11. Design Invariants & Guidelines for Future Development

1. **Never auto-toggle submissions.** Only `/api/admin/submissions` may call `setSubmissionsOpen()`. Session start/end, winner selection, or carry-over operations must not change submissions state implicitly.
2. **Always scope logic by `RaffleSession`.** Any new queries for entries, winners, leaderboards, or carry-over must include `sessionId` filters and continue excluding the sentinel entry via `entryStateExclusion`.
3. **Enforce “one entry per user per session” + global pending rule.** Do not introduce code paths that bypass the checks in `/api/enter`, and never disable the `@@unique([sessionId, userId])` constraint.
4. **Treat submissions and sessions as orthogonal.** Admins can close submissions mid-session or open them multiple times; code must not assume one implies the other.
5. **Respect Twitch/Auth.js contracts.** When touching Auth.js callbacks or Twitch helpers, consult official docs for the versions listed in §2. Update this document if scopes or token flow changes.
6. **Use Prisma migrations for schema edits.** Never modify the database schema outside of `prisma/migrations`. Keep `schema.prisma`, migrations, and generated client in sync.
7. **Preserve sentinel semantics.** The submissions-state sentinel entry must keep using the system session and sentinel user ID. All queries that power business logic must continue to exclude it.
8. **Carry-over must remain deterministic.** `applyCarryOverForSession` is the single source of truth. New features should reuse it or extend it rather than reimplementing per-route logic.
9. **Admin guard is mandatory.** Any new maintenance API must call `requireAdminSession`. Viewer APIs should never accept the legacy `ADMIN_TOKEN`.
10. **Document major changes here.** When altering sessions, submissions, Twitch scopes, or raffle math, update `APP_SYSTEM_REFERENCE.md` (this file) and `APP_OVERVIEW.md` together to keep future engineers aligned.

---

## 12. Repository Structure (Top-level)

```
/
├─ app/
│  ├─ page.tsx                     → Public landing + entry form
│  ├─ demo-portal/page.tsx         → Viewer dashboard
│  ├─ demo-admin/                  → Admin dashboard (page + client components)
│  ├─ components/                  → Shared UI pieces (submission form, Twitch login, etc.)
│  └─ api/
│     ├─ admin/                    → Admin-only APIs (dashboard, entries, sessions, submissions, weights, auth)
│     ├─ twitch/                   → Twitch sync, webhook, carry-over, update-weights, check-follow
│     ├─ user/submission/          → Viewer submission status endpoint
│     ├─ enter/                    → Entry creation endpoint
│     ├─ leaderboard/, winner/     → Public data APIs
│     ├─ pick-winner/              → Winner selection API
│     ├─ demo-played/, health/     → Utility endpoints
│     └─ auth/[...nextauth]/       → Auth.js handlers
├─ lib/
│  ├─ auth.ts, admin-auth.ts       → Auth.js config & admin guard
│  ├─ session.ts, submissions-state.ts, carry-over.ts
│  ├─ twitch-api.ts, twitch-oauth.ts
│  ├─ prisma.ts, env.ts            → Infra helpers
│  ├─ rate-limit.ts, weight-settings.ts, admin-data.ts
│  └─ (other shared helpers)
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ scripts/
│  └─ twitch-diagnose.ts
├─ docs/                           → Setup and deployment docs
├─ APP_OVERVIEW.md
├─ APP_SYSTEM_REFERENCE.md
├─ package.json / tsconfig.json / .env* (not committed)
└─ ... miscellaneous config files
```

_Last updated: 2025-11-30 via automated documentation task._

