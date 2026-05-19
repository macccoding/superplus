-- Thread message pins: lets supervisors pin specific answers inside a thread.

ALTER TABLE "ThreadMessage"
  ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ThreadMessage_threadId_isPinned_idx" ON "ThreadMessage"("threadId", "isPinned");
