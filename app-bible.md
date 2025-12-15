# Demo Raffle v1 — App Bible

_Purpose: single-source map of how the app is built, how data flows, and where logic lives. Focused on current code in `demo-raffle-v1` (Next.js App Router, TypeScript, Prisma, Supabase/Postgres, NextAuth)._  

---

## 1) High-level architecture
- **Framework:** Next.js App Router (app dir), client-heavy pages with API routes for server logic.
- **DB/ORM:** Postgres via Prisma (`prisma/schema.prisma`).
- **Auth:** NextAuth with Twitch provider (`app/api/auth/[...nextauth]/route.ts`, `lib/auth.ts`, `types/next-auth.d.ts`). Sessions persisted in DB `Session` model.
- **Runtime:** Node (serverless-friendly). No websockets/SSE; relies on polling + jitter.
- **Key surfaces:**
  - Viewer root `/` (app/page.tsx) — primary viewer portal with entry form, status banners, leaderboard; TwitchLogin pulls personal weight/odds via `/api/weight/me` (but no MyStatusCard/WeightTable UI).
  - Viewer `/demo-portal` — alternate/secondary viewer page with MyStatusCard, WeightTable, TopList, DemoSubmissionForm (still routed but not primary).
  - Admin dashboard `/demo-admin` — management UI (entries, weight settings, sessions, carry-over).
  - API routes under `/api/**` for auth, status, leaderboard, weights, admin CRUD, twitch sync, etc.
- **Styling:** Tailwind + custom classes in `app/globals.css` (ambient background, glass cards).
- **Background:** `AmbientBackground` renders orbs, noise, particles; wrapped around viewer/admin surfaces for consistent animated backdrop.

---

## 2) Data model (prisma/schema.prisma)
- **User**: Twitch identity and weight state (`totalWeight`, `carryOverWeight`, `currentWeight`, subs/follows/cheers/donations/gifted info, `needsResync`, `lastTwitchSyncAt`, `lastActive`). Relations: `entries`, `sessions`, `accounts`.
- **Entry**: One per user per active `RaffleSession` (`@@unique([sessionId, userId])`). Fields: `name`, `demoLink`, `notes`, `isWinner`, timestamps.
- **RaffleSession**: Tracks sessions (`status`, `createdAt`, `endedAt`). Links to entries.
- **WeightSettings**: Tunable multipliers/caps for weight computation (loyalty, support, carry-over).
- **ProcessedWebhookEvent**: Deduplication for Twitch EventSub.
- **Account/Session**: NextAuth persistence.

---

## 3) Core library utilities (lib/*)
- **prisma.ts**: Prisma client singleton.
- **env.ts**: Safe env loader (DATABASE_URL, DIRECT_URL, Twitch creds, auth secret, etc.).
- **session.ts**: Helpers `getCurrentSession()`, `getLatestEndedSession()`, session resolution.
- **submissions-state.ts**: `entryStateExclusion` to filter invalid/sentinel entries.
- **raffle-logic.ts**: `resolveRaffleSubmissionState(userId)` → eligibility vs existing entry vs no session.
- **weight-settings.ts**: `describeWeightBreakdown` (calculates base, loyalty, support, carry-over, totals with caps) using `WeightSettings`.
- **leaderboard-data.ts**: Fetches leaderboard entries with weights/probabilities.
- **admin-data.ts**: Admin-facing aggregations (`getAdminEntries`, `getCarryOverUsersForSession`, etc.), formatting with weight breakdown and display names.
- **carry-over.ts**: Carry-over management for ended sessions.
- **twitch-api.ts / twitch-oauth.ts / twitch-sync.ts / follow-status.ts**: Twitch API integration (sync user data, eventsub, follow/sub status).
- **rate-limit.ts**: Simple limiter utility.
- **polling.ts**: `withJitter(baseMs)` used for staggered polling intervals.
- **user-display-name.ts**: Normalized display name fallback logic.
- **format-number.ts / format-chance.ts**: Formatting helpers.
- **admin-auth.ts / auth.ts**: Guards and helpers for admin and general auth.

---

## 4) API surface (app/api/**)
_All are Next.js route handlers (App Router). Only highlights the intent & data flow._

- **/api/health/app**, **/api/health/db**: Basic health checks (app alive, DB connectivity).
- **/api/auth/[...nextauth]**: NextAuth Twitch provider, session handling.
- **/api/auth/debug**: Introspection for auth (debug-only).
- **Viewer-facing data**
  - **/api/status**: Lightweight status (hasActiveSession, submissionsOpen, sessionId, lastEntryAt, updatedAt); used for frequent polling.
  - **/api/leaderboard**: Returns current/last-session leaderboard entries with weights/probabilities and totals.
  - **/api/winner**: Latest winner info.
  - **/api/weight/me**: Viewer’s personal weight and chance (`chancePercent`), plus breakdown/status.
  - **/api/user/submission**: Current user submission state/details.
  - **/api/enter**: Submit entry (uses `resolveRaffleSubmissionState`, validates, writes Entry).
  - **/api/demo-played**: Marks a demo as played (admin utility); resets certain support counters (e.g., cheer bits, gifted subs) and recomputes weight.
- **Admin**
  - **/api/admin/dashboard**: Aggregated admin data (entries, weights, leaderboard, sessions, carry-over when no active session).
  - **/api/admin/entries[/[id]]**: Manage entries (list/update/delete or get by id).
  - **/api/admin/submissions**: Toggle submissions open/closed.
  - **/api/admin/session/start | end**: Start/end raffle sessions.
  - **/api/admin/weight-settings**: Read/update WeightSettings (requires admin session; `WeightTable` reads from here).
  - **/api/admin/auth**: Admin auth guard endpoint.
  - **UI route:** `/demo-admin` (`app/demo-admin/page.tsx`) renders admin shell → delegates to client component. **API namespace:** `/api/admin/*` contains admin endpoints. Admin actions also use top-level `/api/pick-winner`.
  - **/api/pick-winner**: Weighted random draw; marks winner.
  - **/api/twitch/carry-over**: Carry-over operations for Twitch sync/weights.
  - **/api/twitch/check-follow**: Verifies follow status for logged-in user.
  - **/api/twitch/eventsub**: EventSub webhook receiver with dedupe (`ProcessedWebhookEvent`).
  - **/api/twitch/sync**: Manual/auto sync of Twitch data to user weights.
  - **/api/twitch/update-weights**: Recompute user weights from Twitch data.
  - **/api/twitch/*** other utilities for sync/playout.
  - **/api/weight/me** (shared viewer/admin consumption for weight breakdown).
  - **/api/status** also used by admin to auto-refresh on new entries.

_Flow notes:_ Most write endpoints validate session/activity, use Prisma mutations, and often trigger weight recompute or status refetch on client (optimistic refetch). Admin routes are guarded (see `lib/admin-auth.ts` or middleware pattern).

---

## 5) Frontend pages & components

### Layout & global
- **app/layout.tsx**: Root layout, includes fonts, global styles.
- **app/globals.css**: Tailwind + custom CSS; `bf-ambient-bg` sets radial gradient, orbs/noise/particles.
- **AmbientBackground**: Client component wrapping content; renders orbs/noise/particles; root `min-h-screen` to avoid background cutoff.

### Viewer primary `/` (app/page.tsx)
- Main viewer portal with TwitchLogin + entry form + TopList (leaderboard) + WeightInfoModal, wrapped in `SessionProvider`. Does **not** show MyStatusCard/WeightTable, but TwitchLogin uses `useWeightData` → `/api/weight/me` to show personal odds/stats when signed in.
- Data sources: `/api/status` (useStatus), `/api/leaderboard`, `/api/winner`, `/api/enter`, `/api/twitch/check-follow`, `/api/weight/me` (via TwitchLogin/useWeightData).
- Behaviors: jittered polling for leaderboard; gating by session/submissions/follow; submit posts `/api/enter` then refetches status/leaderboard.
- Layout: AmbientBackground (`min-h-screen`, flex col) with `LegalFooter` inside the same wrapper.

### Viewer `/demo-portal` (app/demo-portal/page.tsx)
- Alternate viewer page that is still routed at `/demo-portal`. Similar but not identical to `/`: uses DemoSubmissionForm + MyStatusCard + WeightTable + TopList, polls leaderboard/winner every 5s. `/` is the primary viewer page; `/demo-portal` remains accessible but secondary and could be removed/merged later.

### Admin dashboard `/demo-admin` (app/demo-admin/page.tsx + AdminDashboardClient.tsx)
- Client-heavy dashboard:
  - Tabs: Entries, Users/CarryOver, Settings, Leaderboard (depending on session state).
  - Fetches admin data + leaderboard via `/api/admin/dashboard` and `/api/leaderboard`.
  - Reacts to `/api/status` `lastEntryAt` with immediate refresh (useStatus hook, Promise.all on change).
  - Winner pick triggers immediate refresh.
  - Carry-over view when no active session (uses `carryOverUsers` from dashboard API).
  - Forms for weight settings, session controls, submissions toggle, entry management.
  - Displays current weight values card with counts/bonuses.

### Shared viewer/admin components
- **TwitchLogin**: Auth entry; shows current chance (uses `formatChancePercent`).
- **MyStatusCard**: Personal stats; uses `useWeightData` (polling every 20s, refetch exposed) and `formatChancePercent`; shows weight breakdown and “refresh now”.
- **TopList / WeightTable**: Leaderboard and weight rules display.
- **WeightInfoModal**: Explains odds calculation.
- **LegalFooter/LegalModal**: Footer with privacy/rules modals (content embedded strings).
- **RaffleWheel**: Visual raffle wheel (if used).
- **Admin components**: `AdminUserTable`, `AdminWeightsForm` etc. for dashboard.

---

## 6) Hooks & polling
- **useStatus** (`app/hooks/useStatus.ts`): Polls `/api/status` with jitter (`BASE_POLL_MS = 4000`, setTimeout loop); returns `{data, loading, error, refetch}`. Data includes submissionsOpen, hasActiveSession, sessionId, lastEntryAt, updatedAt.
- **useWeightData** (`app/hooks/useWeightData.ts`): Polls `/api/weight/me` on a jittered setTimeout loop (base 20s) using `withJitter`; returns personal weight/chance data and `refetch`. Same enable conditions as before (only when signed in + enabled).
- **withJitter** (`lib/polling.ts`): Adds randomized delay around base interval; used by both status and weight polling to avoid herd spikes.

---

## 7) Business logic highlights
- **Weight computation:** Based on `WeightSettings` caps/multipliers; breakdown covers base, loyalty, support, carry-over. `describeWeightBreakdown` enforces caps. Resub and generic donations are currently neutralized (resub component = 0; donationsWeight = 0) while bits and gifted subs remain active.
- **Chance % (viewer):** `/api/weight/me` computes `chancePercent` as user’s `totalWeight` / sum of participants’ `totalWeight` in active session (only when the user has an entry). Exposed to MyStatusCard/TwitchLogin.
- **Submission gating:** `resolveRaffleSubmissionState` prevents multiple entries per active session and blocks when no active session. API errors include codes (e.g., NO_ACTIVE_SESSION, SUBMISSIONS_CLOSED, NOT_FOLLOWING).
- **Carry-over:** Tracked per user; `getCarryOverUsersForSession` exposes users with carry-over from last ended session (admin view when no active session).
- **Status/lightweight sync:** `/api/status` minimal payload to speed perceived sync (submissions/session/lastEntryAt); admin/viewer poll frequently.
- **Winner selection:** `/api/pick-winner` uses weighted random draw over active session entries (weights from users), marks winner and likely updates states; viewers see winner via `/api/winner`.
- **Twitch sync:** EventSub + on-demand endpoints to update user stats/weights based on Twitch activity (subs, gifted, bits, follows).

### Business logic (deeper)
- **Weight calculation path:** `lib/weight-settings.describeWeightBreakdown` reads current `WeightSettings`, computes:
  - Base weight (default 1.0).
  - Loyalty: months multiplier (capped); resub component is hardcoded to 0 (intentionally ignored).
  - Support: cheerWeight = bits/divisor (capped); donationsWeight is hardcoded to 0 (generic donations ignored); giftedSubsWeight = giftedSubs * multiplier (capped); total support capped.
  - Carry-over: carryOverWeight (capped via settings).
  - Totals: `carryOver + base + loyalty.total + support.total`, then `totalWeight` stored on user and used for draws/leaderboard.
- **Known gotchas:** resub component is hardcoded to 0 (no extra weight). Donations are currently neutralized (weight 0); if re-enabled, ensure units for `totalDonations` (cents/öre) are correct or you risk 100× skew.
- **Entry submission:** `/api/enter` checks `resolveRaffleSubmissionState` (active session? existing entry?) and follow/sub constraints; writes `Entry` (unique per session/user), may sync names/demo/notes, then status/leaderboard refetch on client.
- **Pick winner:** `/api/pick-winner` fetches active session entries (excluding winners/sentinels), uses weighted random (weights from users’ `totalWeight`), marks winner, can update carry-over/flags. Viewer/admin see via `/api/winner` and refresh loops.
- **Carry-over lifecycle:** When a session ends, carryOverWeight can be applied to users for next session (admin sees via `carryOverUsers` when no active session).

---

## 8) Styling & UX principles
- Ambient background uses `.bf-ambient-bg min-h-screen`; orbs/noise/particles are positioned via CSS; content sits above. Not a fixed inset-0 container—full height is via min-h.
- Glass cards (`bf-glass-card`) for primary panels; dark theme bias with accent colors (pink/magenta/lime).
- Forms/buttons use Tailwind; important CTAs have borders/shadows for contrast.
- Footer is transparent and rendered inside ambient wrapper on viewer pages; admin uses AmbientBackground without footer.

---

## 9) Data flows (end-to-end examples)

### Entering the raffle (viewer, `/`)
1. Page loads → `useStatus` polls `/api/status` for session/submissions state.
2. Leaderboard + winner fetched from `/api/leaderboard` and `/api/winner`; polled with jitter.
3. User logs in via NextAuth/Twitch (TwitchLogin); session stored in DB.
4. Submit form → POST `/api/enter` with displayName/demoLink/notes.
5. Server validates (active session, no existing entry, follow status if required) and writes `Entry`.
6. Client refetches status + leaderboard; UI shows banners accordingly.

### Viewer personal odds (TwitchLogin / MyStatusCard)
1. `useWeightData` polls `/api/weight/me` on a ~20s jittered loop or manual `refetch`.
2. API computes current `totalWeight` and `chancePercent` vs sum of active session participants (only if user has an entry).
3. UI shows a compact chance/weight summary in TwitchLogin on `/`; full breakdown (weight components, carry-over, subscriber/follower flags, chance %, last update) lives in MyStatusCard on `/demo-portal`.

### Admin auto-refresh on new entries
1. Admin dashboard uses `useStatus` (4s jittered) to get `lastEntryAt`.
2. When `lastEntryAt` changes for active session, it triggers `Promise.all([fetchAdminData(), fetchLeaderboard()])`, debounced by refs to avoid overlap.
3. Admin views entries/weights updated without manual refresh.

### Pick winner (admin)
1. Admin triggers `/api/pick-winner`; server draws weighted random from entries in active session.
2. Entry marked winner; downstream: viewers see winner via `/api/winner`, admin refreshes data.

### Carry-over when no active session
1. `/api/admin/dashboard` detects no active session → fetches `lastEndedSession` and `getCarryOverUsersForSession`.
2. Admin UI shows `CarryOverTable` instead of active entries.

---

## 10) Configuration & deployment
- **Env vars:** DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, Twitch client id/secret, NEXTAUTH_TWITCH_REDIRECT (see `lib/env.ts`, `docs/setup/TWITCH_SETUP.md`).
- **Deployment:** Targeted at Vercel (serverless). Scripts in `docs/deployment/*.md` cover auto/manual deploy and domain setup.
- **Lint/build:** `npm run lint`, `npm run build`.
- **TypeScript:** Config in `tsconfig.json`; App Router conventions apply.

---

## 11) Testing & operational notes
- **Status and weight polling are jittered** (useStatus, useWeightData) to avoid thundering herd; base intervals 4s and 20s respectively.
- **Status endpoint is lightweight** and should be cheap for frequent polling.
- **Auth-required routes** rely on NextAuth session and admin guard (`lib/admin-auth.ts`); ensure cookies/session tokens valid.
- **EventSub dedupe** via `ProcessedWebhookEvent` to prevent double-processing Twitch events.
- **Unique constraints:** Entry unique per (sessionId, userId); User.twitchId unique; email unique if present.

---

## 12) Quick file map (by concern)
- **Viewer root (primary):** `app/page.tsx`; components used there include `TwitchLogin`, `TopList`, `WeightInfoModal`, `LegalFooter`, `AmbientBackground`, plus the inline `RaffleForm`. (No MyStatusCard/WeightTable on `/`.)
- **Viewer portal (legacy/alt):** `app/demo-portal/page.tsx` (uses `MyStatusCard`, `WeightTable`, `TopList`, `DemoSubmissionForm`, etc.)
- **Admin:** `app/demo-admin/AdminDashboardClient.tsx`, `app/demo-admin/page.tsx`, `app/components/Admin*`
- **Status/weight hooks:** `app/hooks/useStatus.ts`, `app/hooks/useWeightData.ts`
- **API:** `app/api/**` (status, leaderboard, weight/me, winner, enter, admin/*, twitch/*)
- **Logic:** `lib/{raffle-logic,weight-settings,leaderboard-data,admin-data,carry-over,session,submissions-state}`
- **Twitch integration:** `lib/{twitch-api,twitch-oauth,twitch-sync,follow-status}`, `app/api/twitch/*`
- **Auth:** `lib/auth.ts`, `lib/admin-auth.ts`, `auth.ts`, `types/next-auth.d.ts`, `app/api/auth/[...nextauth]/route.ts`
- **Styling:** `app/globals.css`, `app/components/AmbientBackground.tsx`, shared Tailwind classes.

---

## 13) API payload cheat-sheet (indicative)
- **GET /api/status** → `{ submissionsOpen: boolean, hasActiveSession: boolean, sessionId: string|null, lastEntryAt: ISO|null, updatedAt: ISO }`
- **GET /api/weight/me** → `{ user: {...}, breakdown: WeightBreakdown, settings: WeightSettings, chancePercent: number|null }` (chancePercent non-null only when active session + user has an entry)
- **GET /api/leaderboard** → `{ submissionsOpen: boolean, totalEntries: number, sessionId: string|null, entries: [{ id, name, weight, probability }] }`
- **GET /api/admin/dashboard** → If active session: entries, weightSettings, session info, leaderboard, counts. If no active session: `carryOverUsers` from last ended session, plus weightSettings/session metadata.
- **POST /api/enter** → body `{ displayName?, demoLink, notes? }`; errors include codes like `NO_ACTIVE_SESSION`, `SUBMISSIONS_CLOSED`, `ALREADY_SUBMITTED`, `NOT_FOLLOWING`, etc.
- **POST /api/pick-winner** → draws weighted winner for active session; returns winner payload.
- _Indicative shapes; for exact types see the TypeScript definitions (e.g., `StatusResponse`, `WeightResponse`). This section is overview, not a strict contract._

## 14) Auth/session flow (textual)
- User clicks Twitch login (NextAuth provider). After OAuth, NextAuth stores a session (DB `Session` + cookie). `useSession()` supplies client state. Admin routes additionally check `lib/admin-auth.ts` (role/allow-list via env or DB as configured). Viewer pages gate on `session?.user` and sometimes follow/sub status (`/api/twitch/check-follow`).

## 15) ER-style overview (text)
- **User** 1—* **Entry** (one per session per user; unique (sessionId, userId)).
- **RaffleSession** 1—* **Entry**.
- **WeightSettings** singleton-ish (latest used for calculations).
- **ProcessedWebhookEvent** standalone (EventSub dedupe).
- **Account/Session** link NextAuth accounts to User.

## 16) End-to-end flows (narrative)
- **Enter raffle:** load `/` → poll `/api/status` + `/api/leaderboard` → login → POST `/api/enter` → refetch status/leaderboard → weight shown via `/api/weight/me`.
- **Viewer odds:** `useWeightData` polls `/api/weight/me` → UI shows `chancePercent` and weight breakdown; manual “refresh now” calls `refetch`.
- **Admin sees new entries:** `useStatus` polls `/api/status` (4s jitter). On `lastEntryAt` change, auto `fetchAdminData + fetchLeaderboard`.
- **Pick winner:** admin calls `/api/pick-winner` → marks winner → viewers/admin refetch via existing polling.
- **Carry-over when idle:** if no active session, `/api/admin/dashboard` returns `carryOverUsers` from last ended session for admin view.

---

## 17) Twitch interaction (how it works)
- **Auth via Twitch/NextAuth:** User clicks Twitch login → NextAuth OAuth → tokens stored in `Account`; `User` linked by `twitchId`; session cookie set. `useSession()` exposes user on client.
- **Follow check:** `/api/twitch/check-follow` calls Twitch API (see `lib/twitch-api.ts` / `follow-status.ts`) to ensure `isFollower`; informs gating in `/api/enter`.
- **Sub/engagement data:** EventSub webhook (`/api/twitch/eventsub`) receives events (subs, gifts, cheers, etc.), deduped by `ProcessedWebhookEvent`; data merged into `User` stats (subs, gifted, bits; resub events are currently ignored). On-demand sync via `/api/twitch/sync` or `/api/twitch/update-weights`.
- **Needs resync flag:** `needsResync` on User can be set when data may be stale; sync endpoints clear/update it.
- **OAuth refresh:** Tokens stored in `Account` (access/refresh/expires); Twitch API helpers use stored tokens to call Twitch; refresh flows handled in `twitch-oauth.ts`.

---

## 18) Database interaction patterns
- **Prisma client (`lib/prisma.ts`)**: used across API routes and lib helpers.
- **Aggregations:** `prisma.user.aggregate` for total weight sums (chance %), `prisma.entry.aggregate` for lastEntryAt (status endpoint).
- **FindMany with projections:** Admin queries select user fields for weight breakdowns to avoid N+1; `getAdminEntries` uses in-memory post-filter for search + explicit sorting.
- **Uniqueness guards:** `@@unique([sessionId, userId])` prevents duplicate entries; code checks state before writes.
- **Soft exclusion:** `entryStateExclusion` spreads into where clauses to omit sentinel/invalid entries.
- **Event dedupe:** `ProcessedWebhookEvent` unique on (messageId, eventType, twitchUserId) to skip double handling.

## 19) Known UX/runtime behaviors
- No realtime sockets; perceived realtime via frequent, jittered polling (status + weight).
- Background is always full-viewport; footer stays inside ambient wrapper on viewer pages.
- Admin auto-refreshes on `lastEntryAt`; viewer manually/automatically refreshes weight/leaderboard.
- Carry-over only shown to admin when no active session; hidden otherwise.

---

## 20) How to extend safely
- Reuse existing hooks (`useStatus`, `useWeightData`) for polling; prefer lightweight endpoints for high-frequency checks.
- Respect unique constraints (one entry per user per session).
- When adding new weight logic, update `WeightSettings` model, `describeWeightBreakdown`, and dependent API routes.
- Keep `/api/status` minimal to stay cheap for polling; heavier aggregates belong in dashboard/leaderboard routes.
- For UI changes, ensure `AmbientBackground` wraps content so the background remains continuous.

---

## 21) Viewer & admin truth table (current repo)

| Route          | Purpose                               | Hooks used                                     | API endpoints (direct or via children)                                                                                         | Main components rendered                                                                                                                                           |
|----------------|---------------------------------------|------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/`            | Primary viewer (enter + view odds/leaderboard) | `useStatus` (page), `useWeightData` (via `TwitchLogin`) | `/api/status`, `/api/leaderboard`, `/api/winner`, `/api/enter`, `/api/twitch/check-follow`, `/api/weight/me`                   | `AmbientBackground`, `TwitchLogin` (compact odds summary via weight/me), inline `RaffleForm` (entry form), `TopList`, `WeightInfoModal`, `LegalFooter`            |
| `/demo-portal` | Secondary/alt viewer (owner/internal; exposes WeightTable via admin-guarded settings) | `useSession` (page), `useWeightData` (via `MyStatusCard`) | `/api/leaderboard` (5s poll), `/api/winner`, `/api/admin/weight-settings` (requires admin session; used for read in WeightTable), `/api/enter` (via `DemoSubmissionForm`), `/api/weight/me` (via `MyStatusCard`) | `AmbientBackground`, `TwitchLogin`, `DemoSubmissionForm`, `MyStatusCard`, `WeightTable`, `TopList`, `LegalFooter`                                                 |
| `/demo-admin`  | Admin dashboard                         | `useStatus` (admin client)                     | `/api/admin/dashboard`, `/api/leaderboard`, `/api/status` (auto-refresh), plus actions like `/api/pick-winner`, `/api/admin/submissions`, `/api/admin/session/start|end`, `/api/admin/weight-settings` | `AmbientBackground` (no footer), `AdminDashboardClient` (entries/users/carry-over tables, weight settings form, winner controls, submissions/session toggles, leaderboard) |

Note: `/demo-portal` is mainly useful for admin/owner since `WeightTable` depends on admin-guarded `/api/admin/weight-settings`; regular viewers won’t see weight settings there.
