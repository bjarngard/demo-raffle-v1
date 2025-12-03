-- Remove legacy unique index on messageId only (leftover from prior schema)
DROP INDEX IF EXISTS "ProcessedWebhookEvent_messageId_key";

