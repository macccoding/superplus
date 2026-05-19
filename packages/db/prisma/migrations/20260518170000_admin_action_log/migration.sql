-- Admin operations audit trail.

CREATE TABLE "AdminActionLog" (
  "id" TEXT NOT NULL,
  "storeId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "scope" TEXT NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminActionLog_storeId_createdAt_idx" ON "AdminActionLog"("storeId", "createdAt");
CREATE INDEX "AdminActionLog_actorId_createdAt_idx" ON "AdminActionLog"("actorId", "createdAt");
CREATE INDEX "AdminActionLog_sourceType_sourceId_idx" ON "AdminActionLog"("sourceType", "sourceId");

ALTER TABLE "AdminActionLog"
  ADD CONSTRAINT "AdminActionLog_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminActionLog"
  ADD CONSTRAINT "AdminActionLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
