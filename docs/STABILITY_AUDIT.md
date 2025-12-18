# Stability Audit

## Flows (bullet “sequence diagrams”)

- Viewer login callback → ensureUser → updateUserTwitchData  
  1) Twitch OAuth redirect handled by NextAuth callbacks.  
  2) `profile()` maps Twitch IDs (numeric `sub`/`id`) → `twitchId`; email nulled unless `STORE_TWITCH_EMAIL=1`.  
  3) Adapter `createUser` upserts `User` by `twitchId` (name/username/displayName).  
  4) `jwt` stores tokens + resolved `twitchUserId`; may DB-lookup twitchId by `user.id`.  
  5) `session` DB-lookups `User` by `session.user.id`; sets `session.user.twitchId`; computes `isBroadcaster` by twitchId match.  
  6) `signIn` (Twitch only) calls `updateUserTwitchData(user.id, accessToken)`; fetches Twitch user; tries broadcaster token for follow/sub; upserts `User` by twitchId.  
  7) `ensureUser(session.user)` guarantees a row exists for the session user id.

- `/api/weight/me` → ensureUser → twitch-sync trigger → weight calc  
  1) `auth()` for session; `ensureUser(session.user)`.  
  2) Load `User` by id.  
  3) If `twitchId` missing → skip sync (still return DB weight).  
  4) If `shouldSyncTwitch` and trigger present → `syncUserFromTwitch(id, trigger)` (uses broadcaster token).  
  5) Reloaded `resolvedUser` used for `describeWeightBreakdown` and settings via `getWeightSettings`.  
  6) Chance% computed vs active session entries; response includes weight + breakdown.

- EventSub cheer/gift → dedupe → increment → optional instant weight  
  1) Validate signature/timestamp; reject unsupported types.  
  2) Extract `twitchUserId`; ignore broadcaster-id and anonymous gifts/cheers.  
  3) If `IMMEDIATE_SUPPORT_WEIGHT=1`: `processSupportEventWithWeight` runs in `prisma.$transaction`:  
     - lock user row (`FOR UPDATE` by twitchId)  
     - dedupe insert `ProcessedWebhookEvent` (P2002 → ignore)  
     - increment bits/gifts + `needsResync=true`, return updated user  
     - load `weight_settings` in tx  
     - recompute `totalWeight`; set `currentWeight = totalWeight - carryOverWeight`; update user  
  4) On failure or flag off: fallback path still dedupes and marks `needsResync=true`; aggregation updates totals.

- Admin session guard (isBroadcaster)  
  1) `session` callback DB-lookups user by `session.user.id` → `dbTwitchId`.  
  2) `twitchUserId = dbTwitchId ?? token.twitchUserId`.  
  3) `isBroadcaster = twitchUserId === TWITCH_BROADCASTER_ID`.  
  4) Admin routes rely on this boolean (no email/provider fallback).

## Invariants and Enforcement
- Identity is twitchId (Helix ID), not email: `profile()` nulls email unless `STORE_TWITCH_EMAIL=1`; `updateUserTwitchData` writes email only when flag is on.  
- Admin detection only via twitchId match: `session` callback compares `twitchUserId` to `TWITCH_BROADCASTER_ID`; no email/providerAccountId fallback.  
- No guessing twitchId from `user.id`: `jwt` may DB-fetch twitchId by `user.id` but never uses `user.id` as twitchId.  
- Broadcaster token refresh updates by `account.id`, not providerAccountId: `lib/twitch-oauth.ts` update uses `where: { id: account.id }` and normalizes `providerAccountId`.  
- Instant weight correctness under concurrency: user row locked (`FOR UPDATE`) before increment/weight recompute.  
- currentWeight relationship: when instant weight runs, `currentWeight = totalWeight - carryOverWeight` in same transaction.  
- Dedupe before side effects: EventSub support path inserts `ProcessedWebhookEvent` first; P2002 exits.  
- Logs PII-masked and throttled for recurring Helix/OAuth errors: `maskSuffix` used; `throttledError`/`throttledWarn` for noisy cases.

## Known Failure Modes → Log Signatures
- Missing broadcaster token / account drift:  
  - `[twitch-oauth] pathUsed: ..., foundAccount: false|missing refresh`  
  - `Failed to fetch broadcaster token for Twitch sync` (followed by `broadcaster_token_missing` in `/api/weight/me`)  
  - P2025 during `prisma.account.update` now prevented by `where: { id }` normalization.  
- Duplicate EventSub message: `[eventsub] duplicate message ignored` (P2002).  
- Unauthorized Helix (scope/token): `[twitch-api] endpoint: 'subscription' status:401|403` or `follow:401`.  
- Rate limit / 5xx Helix: `[twitch-api] endpoint: ... status:429|5xx` (throttled).  
- Missing twitchId on session user: `[auth] Missing twitchId on user during signIn` or `[session:twitchid_missing]`.  
- DB user missing: `[session:db_missing]` when session id has no user row.  
- Instant weight failure: `[eventsub][support_weight_error]` (when debug flag enabled).

