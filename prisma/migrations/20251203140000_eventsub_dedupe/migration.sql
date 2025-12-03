-- Ensure we only keep webhook events that can be mapped to a user.
DELETE FROM "ProcessedWebhookEvent" WHERE "twitchUserId" IS NULL;

-- Drop the old unique constraint on messageId alone.
ALTER TABLE "ProcessedWebhookEvent" DROP CONSTRAINT IF EXISTS "ProcessedWebhookEvent_messageId_key";

-- Enforce twitchUserId presence going forward.
ALTER TABLE "ProcessedWebhookEvent" ALTER COLUMN "twitchUserId" SET NOT NULL;

-- Deduplicate by messageId + eventType + twitchUserId.
CREATE UNIQUE INDEX "ProcessedWebhookEvent_messageId_eventType_twitchUserId_key"
  ON "ProcessedWebhookEvent"("messageId", "eventType", "twitchUserId");

