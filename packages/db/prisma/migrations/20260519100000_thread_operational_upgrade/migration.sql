-- Extend thread attachments with metadata for safer client-side storage handling.
ALTER TABLE "ThreadMessageAttachment"
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "storageKey" TEXT;

-- Record supervisor moderation and escalation actions for accountability.
CREATE TYPE "ThreadModerationAction" AS ENUM (
  'MESSAGE_EDITED',
  'MESSAGE_DELETED',
  'MESSAGE_PINNED',
  'MESSAGE_UNPINNED',
  'THREAD_PINNED',
  'THREAD_UNPINNED',
  'THREAD_RESOLVED',
  'TASK_CREATED'
);

CREATE TABLE "ThreadModerationEvent" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "messageId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" "ThreadModerationAction" NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ThreadModerationEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ThreadModerationEvent"
  ADD CONSTRAINT "ThreadModerationEvent_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadModerationEvent"
  ADD CONSTRAINT "ThreadModerationEvent_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ThreadMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ThreadModerationEvent"
  ADD CONSTRAINT "ThreadModerationEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ThreadModerationEvent_threadId_createdAt_idx" ON "ThreadModerationEvent"("threadId", "createdAt");
CREATE INDEX "ThreadModerationEvent_messageId_idx" ON "ThreadModerationEvent"("messageId");
CREATE INDEX "ThreadModerationEvent_actorId_createdAt_idx" ON "ThreadModerationEvent"("actorId", "createdAt");
