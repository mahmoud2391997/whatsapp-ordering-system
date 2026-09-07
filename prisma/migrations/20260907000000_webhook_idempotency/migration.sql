-- Add durable provider keys without dropping existing webhook history.
ALTER TABLE "webhook_events" ADD COLUMN IF NOT EXISTS "event_key" TEXT NOT NULL DEFAULT '';
UPDATE "webhook_events" SET "event_key" = "id"::text WHERE "event_key" = '';
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_source_event_key_key" ON "webhook_events" ("source", "event_key");

-- Provider transaction ids are stable idempotency keys. Keep the first record if old data contains duplicates.
DELETE FROM "transactions" duplicate
USING "transactions" original
WHERE duplicate."provider_id" IS NOT NULL
  AND duplicate."provider_id" = original."provider_id"
  AND duplicate."created_at" > original."created_at";
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_provider_id_key" ON "transactions" ("provider_id") WHERE "provider_id" IS NOT NULL;
