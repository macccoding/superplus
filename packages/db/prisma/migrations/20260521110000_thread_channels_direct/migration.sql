-- Add explicit thread visibility types for store channels and private direct messages.
CREATE TYPE "ThreadType" AS ENUM ('PUBLIC', 'CHANNEL', 'DIRECT');

ALTER TABLE "Thread"
  ADD COLUMN "type" "ThreadType" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "defaultKey" TEXT;

CREATE INDEX "Thread_storeId_type_idx" ON "Thread"("storeId", "type");
CREATE UNIQUE INDEX "Thread_storeId_defaultKey_key" ON "Thread"("storeId", "defaultKey");
