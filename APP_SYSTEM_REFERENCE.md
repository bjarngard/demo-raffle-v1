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
| `/api/weight/me` | GET | Viewer session | Returns the viewer’s canonical weight breakdown. Reads from DB, and lazily triggers `syncUserFromTwitch` when `needsResync` is true or cached data is older than the stale window. |
| `/api/twitch/sync` | POST | Viewer session (manual) | Explicit sync trigger (admin/support fallback). Uses the same helper as `/api/weight/me` but should not be called by UI flows. |
| `/api/twitch/carry-over` | POST | `requireAdminSession` | Applies carry-over using the shared helper. Accepts `{ sessionId?, resetWeights? }`, otherwise defaults to the current session. Returns errorCode `NO_ACTIVE_SESSION` if neither is provided. |
| `/api/twitch/update-weights` | POST | `requireAdminSession` | Recalculates user weights in bulk (implementation unchanged by session work). |
| `/api/twitch/check-follow` | POST | Viewer session | Re-validates follow status (used by frontend gating). |
| `/api/twitch/eventsub` | POST | Public (Twitch) | Verifies EventSub signatures/timestamps, deduplicates via `ProcessedWebhookEvent`, marks `User.needsResync = true`, and returns 2xx. No weight math runs here. |
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
- Weight fields: `currentWeight`, `carryOverWeight`, `totalWeight`, `lastUpdated`, `lastActive`, `needsResync` (dirty flag set by EventSub to request a fresh Twitch sync).
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
- `ProcessedWebhookEvent` – stores Twitch EventSub message IDs + type + twitchUserId to avoid reprocessing (unique on all three columns; `twitchUserId` is non-null).
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
- **EventSub (`app/api/twitch/eventsub/route.ts`):**
  - Validates HMAC signature + timestamp drift using `TWITCH_WEBHOOK_SECRET`.
  - Deduplicates via `ProcessedWebhookEvent` (unique on `messageId + eventType + twitchUserId`).
  - Handles `channel.follow`, `channel.subscribe`, `channel.subscription.message`, `channel.subscription.gift`, `channel.cheer`.
  - Extracts the Twitch user id and marks `User.needsResync = true` (ignoring broadcaster/self events).
  - Does **not** run weight math; it simply records the hint and returns 204.
- **Viewer weight endpoint (`/api/weight/me`)** – Canonical UI entry point. Reads the cached `User` row; if `needsResync = true` or `lastUpdated` is older than the stale window (6h), calls `syncUserFromTwitch` and then returns the DB-driven breakdown/settings.
- **Manual sync (`/api/twitch/sync`)** – Legacy/admin trigger that forces `syncUserFromTwitch`. Frontend no longer calls this route automatically.
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
6. **Use Prisma migrations for schema edits.** Every schema change must follow `schema → prisma migrate dev → commit migration → prisma migrate deploy in prod/stage`. Never run `prisma db push` against production. CI/CD must run `prisma migrate deploy` *before* the app boots on every release. Backwards-compatible migrations (e.g., adding nullable columns) can ship ahead of code; breaking ones (making fields NOT NULL, dropping columns, changing uniques) require a two-step rollout: first deploy code that tolerates both shapes, then tighten constraints once all instances run the new version.
7. **Preserve sentinel semantics.** The submissions-state sentinel entry must keep using the system session and sentinel user ID. All queries that power business logic must continue to exclude it.
8. **Carry-over must remain deterministic.** `applyCarryOverForSession` is the single source of truth. New features should reuse it or extend it rather than reimplementing per-route logic.
9. **Admin guard is mandatory.** Any new maintenance API must call `requireAdminSession`. Viewer APIs should never accept the legacy `ADMIN_TOKEN`.
10. **EventSub → needsResync → lazy sync.** Webhooks only mark `User.needsResync`; `/api/weight/me` (and explicit admin syncs) call `syncUserFromTwitch`, which is the only helper allowed to talk to Helix followers/subscriptions. UIs must keep polling our own endpoints, never Twitch directly.
11. **Document major changes here.** When altering sessions, submissions, Twitch scopes, or raffle math, update `APP_SYSTEM_REFERENCE.md` (this file) and `APP_OVERVIEW.md` together to keep future engineers aligned.

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

---

## 13. Raffle State Machine & Central Logic (Authoritative Spec)

### 13.1 Purpose

This section defines the **intended** long-term architecture and business rules for the raffle logic.  
The rest of this document describes the current implementation; this section describes the **target model** that code should converge towards.

Whenever there is ambiguity or conflict between older descriptions and this section, this section is authoritative for future changes.

### 13.2 Core Concepts

We introduce three key ideas:

1. **Raffle state machine** – a finite set of user/session states that govern whether a viewer may submit.
2. **Central "raffle brain" module** – a single module in `lib/` that encapsulates the raffle rules.
3. **Database as final enforcer** – the Prisma/DB constraint on `(sessionId, userId)` remains the final guard against multiple entries in the same session.

### 13.3 Target Module: `lib/raffle-logic.ts`

A new module should be introduced:

- File: `lib/raffle-logic.ts`

It should export:

```ts
export type UserRaffleState =
  | 'NO_SESSION'
  | 'NO_ENTRY'
  | 'HAS_ENTRY_THIS_SESSION'
  | 'HAS_PENDING_FROM_PREVIOUS_SESSION'
  | 'CAN_SUBMIT'

export type ResolveUserRaffleStateInput = {
  userId: string
  currentSessionId: string | null
}

export type ResolveUserRaffleStateResult = {
  state: UserRaffleState
  blockingEntry: Entry | null
  pendingEntry: Entry | null
}
```

And a core resolver:

```ts
export async function resolveUserRaffleState(
  input: ResolveUserRaffleStateInput
): Promise<ResolveUserRaffleStateResult> {
  // Implementation details go here in code,
  // but the behavior MUST follow the state machine and rules below.
}
```

> Note: The exact imports (e.g., `Entry` type) and Prisma calls are left to the implementation, but MUST follow the semantics described here.

### 13.4 State Machine: User + Session

Given:

* `currentSessionId` (string or null),
* any existing entries for the user,

the resolver MUST classify the user into one of the `UserRaffleState` values according to these rules:

1. **NO_SESSION**

   * When there is no active `RaffleSession`.
   * Submissions MUST be blocked with `NO_ACTIVE_SESSION`.

2. **HAS_ENTRY_THIS_SESSION**

   * When the user already has an entry in the current session (matching `(sessionId, userId)`).
   * This entry may be pending or already winner; in both cases, the user must not submit another entry for the same session.
   * Submissions MUST be blocked with `ALREADY_SUBMITTED_THIS_SESSION`.

3. **HAS_PENDING_FROM_PREVIOUS_SESSION**

   * When the user has at least one pending entry (`isWinner = false`) from a **previous** session (not `currentSessionId`).
   * This represents a carry-over entry.
   * Submissions MUST be blocked with `PENDING_ENTRY_FROM_PREVIOUS_SESSION`.
   * This remains true until that pending entry is drawn as a winner.

4. **NO_ENTRY**

   * When:

     * there is an active session,
     * the user has no entry for the current session,
     * the user has no pending entries in any session.
   * This is a transient state that resolves to `CAN_SUBMIT`.

5. **CAN_SUBMIT**

   * When:

     * there is an active session AND
     * the user has no conflicting pending entries AND
     * the user has not yet submitted in the current session.
   * In this state, the resolver signals that `/api/enter` may proceed to create a new `Entry` row.

### 13.5 Hard Business Invariants (Target Model)

The following invariants MUST be respected by all future code changes:

1. **One entry per session per user**

   * Enforced at DB level by `@@unique([sessionId, userId])`.
   * No code is allowed to bypass or disable this constraint.
   * If `prisma.entry.create()` throws `P2002` on `(sessionId, userId)`, this MUST always be interpreted as “user already has an entry in this session” and surfaced as `ALREADY_SUBMITTED_THIS_SESSION`.

2. **Global pending entry rule**

   * A “pending entry” is any `Entry` with `isWinner = false`.
   * If a user has ANY pending entry (any session), that entry blocks new submissions until:

     * it is drawn as a winner, **and**
     * the user does not already have a row for the current session.

3. **Carry-over behavior**

   * Pending entries may carry over across sessions.
   * A carry-over entry from a previous session remains pending until it wins in a later session.
   * When a carry-over entry wins:

     * The user’s “pending block” is cleared.
     * The user may submit a new entry, subject to the per-session rule (only one row per session).

4. **Visibility invariant**

   * Any pending entry (`isWinner = false`) MUST be visible:

     * in the main viewer leaderboard (for the appropriate session),
     * in the admin “Active Entries” / “Raffle” views.
   * No pending entries may silently exist only in the database while being invisible in the UI.

5. **Sessions vs submissions**

   * Sessions and submissions-open/closed remain orthogonal (as documented in §6).
   * The state machine is layered on top of that:

     * even if submissions are open, `resolveUserRaffleState` may still block the user (e.g., pending carry-over).

### 13.6 `/api/enter` Endpoint Integration (Target Behavior)

The `/api/enter` handler MUST eventually be refactored to:

1. Resolve the active session:

   * If none → return `NO_ACTIVE_SESSION`.

2. Call `resolveUserRaffleState({ userId, currentSessionId })`:

   * If `NO_SESSION` → map to `NO_ACTIVE_SESSION`.
   * If `HAS_ENTRY_THIS_SESSION` → return `ALREADY_SUBMITTED_THIS_SESSION`.
   * If `HAS_PENDING_FROM_PREVIOUS_SESSION` → return `PENDING_ENTRY_FROM_PREVIOUS_SESSION`.
   * If `CAN_SUBMIT` → proceed to DB insert.

3. Attempt to create the entry:

```ts
try {
  const entry = await prisma.entry.create({ data: entryData })
  // return success payload
} catch (error) {
  // If Prisma error code === 'P2002' on (sessionId, userId)
  // → map to ALREADY_SUBMITTED_THIS_SESSION
  // Otherwise rethrow or map to generic error.
}
```

The DB acts as the final enforcer against race conditions and double-click submission.

### 13.7 Leaderboard & Admin as Views on the Same Truth

The leaderboard and admin APIs must be considered **views** over the same underlying state:

* They must both:

  * respect the session scoping,
  * show pending entries correctly,
  * not hide real entries with extra, ad-hoc filters.

Key points:

* Viewer leaderboard:

  * Focuses on entries for the **current** session.
  * Pending entries for the current session must appear here.
* Admin “Active Entries” / “Raffle”:

  * Shows all pending entries relevant to the current raffle context.
  * May include carry-over entries explicitly, but must never hide pending rows that block the user from submitting.

If the database has an `Entry` row that causes a user to be blocked from submitting, that same entry MUST be observable in at least one admin view, and — if it belongs to the current session — in the viewer leaderboard.

### 13.8 Migration Path

This section defines the target behavior. The current implementation (as documented above in sections 1–12) may diverge from this in details.

Future refactors should:

1. Introduce `lib/raffle-logic.ts` with the API defined here.
2. Gradually move the scattered conditional logic from:

   * `/api/enter`,
   * `/api/leaderboard`,
   * admin entry APIs,

     into the central resolver and simple helper functions.
3. Keep every change aligned with:

   * The state machine in §13.4.
   * The invariants in §13.5.
   * The endpoint behavior in §13.6–13.7.

---

_Last updated: 2025-12-01 – added raffle state machine & central logic spec (section 13)._

_Last updated: 2025-11-30 via automated documentation task._

