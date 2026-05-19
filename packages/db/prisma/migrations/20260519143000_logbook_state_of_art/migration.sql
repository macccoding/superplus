-- Add Logbook comments, attachments, and operational source links.
CREATE TYPE "LogEntryAttachmentType" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO');

CREATE TABLE "LogEntryComment" (
    "id" TEXT NOT NULL,
    "logEntryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntryComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogEntryAttachment" (
    "id" TEXT NOT NULL,
    "logEntryId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "type" "LogEntryAttachmentType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntryAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LogEntryLink" (
    "id" TEXT NOT NULL,
    "logEntryId" TEXT NOT NULL,
    "type" "TaskLinkType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogEntryLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LogEntryComment_logEntryId_createdAt_idx" ON "LogEntryComment"("logEntryId", "createdAt");
CREATE INDEX "LogEntryAttachment_logEntryId_createdAt_idx" ON "LogEntryAttachment"("logEntryId", "createdAt");
CREATE INDEX "LogEntryLink_logEntryId_idx" ON "LogEntryLink"("logEntryId");
CREATE INDEX "LogEntryLink_type_entityId_idx" ON "LogEntryLink"("type", "entityId");
CREATE UNIQUE INDEX "LogEntryLink_logEntryId_type_entityId_key" ON "LogEntryLink"("logEntryId", "type", "entityId");

ALTER TABLE "LogEntryComment" ADD CONSTRAINT "LogEntryComment_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "LogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogEntryComment" ADD CONSTRAINT "LogEntryComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogEntryAttachment" ADD CONSTRAINT "LogEntryAttachment_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "LogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LogEntryAttachment" ADD CONSTRAINT "LogEntryAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogEntryLink" ADD CONSTRAINT "LogEntryLink_logEntryId_fkey" FOREIGN KEY ("logEntryId") REFERENCES "LogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
