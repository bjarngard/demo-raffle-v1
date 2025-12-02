DROP INDEX IF EXISTS "Entry_email_key";

CREATE TABLE "RaffleSession" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "RaffleSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Entry" ADD COLUMN "sessionId" TEXT;

INSERT INTO "RaffleSession" ("id", "name", "createdAt", "updatedAt", "status")
VALUES ('legacy-session', 'Legacy Session', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'ENDED')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RaffleSession" ("id", "name", "createdAt", "updatedAt", "status")
VALUES ('system-session', 'System Session', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SYSTEM')
ON CONFLICT ("id") DO NOTHING;

UPDATE "Entry" SET "sessionId" = 'legacy-session' WHERE "sessionId" IS NULL;
UPDATE "Entry" SET "sessionId" = 'system-session' WHERE "email" = 'submissions-state@demo-raffle.local';

ALTER TABLE "Entry" ALTER COLUMN "sessionId" SET NOT NULL;

ALTER TABLE "Entry" ADD CONSTRAINT "Entry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RaffleSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Entry_sessionId_idx" ON "Entry"("sessionId");

CREATE UNIQUE INDEX "Entry_sessionId_userId_key" ON "Entry"("sessionId", "userId");

UPDATE "RaffleSession" SET "endedAt" = CURRENT_TIMESTAMP WHERE "id" = 'legacy-session';