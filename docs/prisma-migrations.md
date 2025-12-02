## Prisma Migration Notes

### Current Baseline (December 2025)
- The shared Postgres database was reset once via `npx prisma migrate reset` so that the stored migration history matches the files under `prisma/migrations/`.
- Existing data was intentionally discarded during this reset; the repo now expects the current migration set to be treated as the canonical baseline.

### Required Workflow Going Forward
- Never modify or delete migration folders that have already been merged/applied. Treat every folder in `prisma/migrations/` as immutable history.
- All schema changes must flow through `npx prisma migrate dev --name <meaningful_name>` and the resulting migration folder should be committed.
- On prod-like environments (Vercel, Supabase, etc.), apply schema changes with `npx prisma migrate deploy` instead of `migrate dev`.
- If you need a local scratch database reset, use `npx prisma migrate reset` (WARNING: this drops all data) and rerun `npm run dev` afterward to regenerate seed data as needed.

### How to Run This
1. `npx prisma migrate reset` (⚠️ drops all data; run only on non-prod databases that are safe to wipe).
2. Optionally inspect tables with `npx prisma studio`.
3. Start the app or deployments as usual, e.g. `npm run dev` locally or your normal Vercel workflow.

