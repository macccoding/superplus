-- Threads upgrade: attention state, mentions, attachments, reactions, links, and moderation metadata.

CREATE TYPE "ThreadAttachmentType" AS ENUM ('IMAGE', 'DOCUMENT', 'LINK');
CREATE TYPE "ThreadReactionType" AS ENUM ('ACK', 'THANKS');

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'THREAD_MENTION';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'THREAD_REPLY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'THREAD_URGENT';
ALTER TYPE "TaskLinkType" ADD VALUE IF NOT EXISTS 'TASK';

ALTER TABLE "Thread"
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedById" TEXT,
  ADD COLUMN "lastMessageAt" TIMESTAMP(3),
  ADD COLUMN "lastMessageById" TEXT;

UPDATE "Thread" t
SET "lastMessageAt" = COALESCE(
  (
    SELECT MAX(m."createdAt")
    FROM "ThreadMessage" m
    WHERE m."threadId" = t."id"
  ),
  t."updatedAt"
);

UPDATE "Thread" t
SET "lastMessageById" = (
  SELECT m."authorId"
  FROM "ThreadMessage" m
  WHERE m."threadId" = t."id"
  ORDER BY m."createdAt" DESC
  LIMIT 1
);

ALTER TABLE "ThreadMessage"
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT;

CREATE TABLE "ThreadParticipant" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3),
  "isFollowing" BOOLEAN NOT NULL DEFAULT true,
  "isSaved" BOOLEAN NOT NULL DEFAULT false,
  "mutedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ThreadParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThreadMention" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreadMention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThreadMessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "type" "ThreadAttachmentType" NOT NULL,
  "url" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreadMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThreadMessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "ThreadReactionType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreadMessageReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThreadLink" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "messageId" TEXT,
  "type" "TaskLinkType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThreadLink_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ThreadParticipant" ("id", "threadId", "userId", "lastReadAt", "isFollowing", "createdAt", "updatedAt")
SELECT
  concat('legacy_', t."id", '_', t."authorId"),
  t."id",
  t."authorId",
  t."lastMessageAt",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Thread" t
ON CONFLICT DO NOTHING;

CREATE INDEX "Thread_storeId_isResolved_updatedAt_idx" ON "Thread"("storeId", "isResolved", "updatedAt");
CREATE INDEX "Thread_storeId_lastMessageAt_idx" ON "Thread"("storeId", "lastMessageAt");
CREATE INDEX "ThreadMessage_authorId_createdAt_idx" ON "ThreadMessage"("authorId", "createdAt");
CREATE UNIQUE INDEX "ThreadParticipant_threadId_userId_key" ON "ThreadParticipant"("threadId", "userId");
CREATE INDEX "ThreadParticipant_userId_isSaved_idx" ON "ThreadParticipant"("userId", "isSaved");
CREATE INDEX "ThreadParticipant_userId_lastReadAt_idx" ON "ThreadParticipant"("userId", "lastReadAt");
CREATE UNIQUE INDEX "ThreadMention_messageId_userId_key" ON "ThreadMention"("messageId", "userId");
CREATE INDEX "ThreadMention_threadId_userId_idx" ON "ThreadMention"("threadId", "userId");
CREATE INDEX "ThreadMessageAttachment_messageId_createdAt_idx" ON "ThreadMessageAttachment"("messageId", "createdAt");
CREATE UNIQUE INDEX "ThreadMessageReaction_messageId_userId_type_key" ON "ThreadMessageReaction"("messageId", "userId", "type");
CREATE INDEX "ThreadMessageReaction_messageId_type_idx" ON "ThreadMessageReaction"("messageId", "type");
CREATE INDEX "ThreadLink_threadId_idx" ON "ThreadLink"("threadId");
CREATE INDEX "ThreadLink_messageId_idx" ON "ThreadLink"("messageId");
CREATE INDEX "ThreadLink_type_entityId_idx" ON "ThreadLink"("type", "entityId");

ALTER TABLE "Thread"
  ADD CONSTRAINT "Thread_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Thread"
  ADD CONSTRAINT "Thread_lastMessageById_fkey"
  FOREIGN KEY ("lastMessageById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ThreadMessage"
  ADD CONSTRAINT "ThreadMessage_deletedById_fkey"
  FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ThreadParticipant"
  ADD CONSTRAINT "ThreadParticipant_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadParticipant"
  ADD CONSTRAINT "ThreadParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadMention"
  ADD CONSTRAINT "ThreadMention_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadMention"
  ADD CONSTRAINT "ThreadMention_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ThreadMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadMention"
  ADD CONSTRAINT "ThreadMention_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadMessageAttachment"
  ADD CONSTRAINT "ThreadMessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ThreadMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadMessageAttachment"
  ADD CONSTRAINT "ThreadMessageAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ThreadMessageReaction"
  ADD CONSTRAINT "ThreadMessageReaction_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ThreadMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadMessageReaction"
  ADD CONSTRAINT "ThreadMessageReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadLink"
  ADD CONSTRAINT "ThreadLink_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadLink"
  ADD CONSTRAINT "ThreadLink_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "ThreadMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
