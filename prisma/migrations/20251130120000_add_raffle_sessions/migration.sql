CREATE TABLE "RaffleSession" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "RaffleSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Entry" ADD COLUMN "sessionId" TEXT;

INSERT INTO "RaffleSession" ("id", "name", "isSystem", "createdAt", "updatedAt")
VALUES ('legacy-session', 'Legacy Session', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RaffleSession" ("id", "name", "isSystem", "createdAt", "updatedAt")
VALUES ('system-session', 'System Session', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Entry" SET "sessionId" = 'legacy-session' WHERE "sessionId" IS NULL;
UPDATE "Entry" SET "sessionId" = 'system-session' WHERE "email" = 'submissions-state@demo-raffle.local';

ALTER TABLE "Entry" ALTER COLUMN "sessionId" SET NOT NULL;

ALTER TABLE "Entry" ADD CONSTRAINT "Entry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RaffleSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Entry_sessionId_idx" ON "Entry"("sessionId");

CREATE UNIQUE INDEX "Entry_sessionId_userId_key" ON "Entry"("sessionId", "userId");

UPDATE "RaffleSession" SET "endedAt" = CURRENT_TIMESTAMP WHERE "id" = 'legacy-session';