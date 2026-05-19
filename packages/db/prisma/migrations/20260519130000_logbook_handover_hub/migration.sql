-- Upgrade logbook flags into resolvable handover items and track per-user reads.
ALTER TABLE "LogEntry" ADD COLUMN "resolvedAt" TIMESTAMP(3);
ALTER TABLE "LogEntry" ADD COLUMN "resolvedById" TEXT;

CREATE TABLE "LogEntryRead" (
    "id" TEXT NOT NULL,
    "logEntryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntryRead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LogEntry_storeId_isFlagged_resolvedAt_idx" ON "LogEntry"("storeId", "isFlagged", "resolvedAt");
CREATE INDEX "LogEntryRead_userId_readAt_idx" ON "LogEntryRead"("userId", "readAt");
CREATE UNIQUE INDEX "LogEntryRead_logEntryId_userId_key" ON "LogEntryRead"("logEntryId", "userId");

ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogEntryRead" ADD CONSTRAINT "LogEntryRead_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "LogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogEntryRead" ADD CONSTRAINT "LogEntryRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
