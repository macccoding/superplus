-- Threads production ops: push subscriptions, notification preferences, and lifecycle dedupe events.
CREATE TYPE "ThreadLifecycleEventType" AS ENUM (
  'URGENT_UNACKED_REMINDER',
  'NO_REPLY_FLAGGED',
  'STALE_RESOLVE_SUGGESTED',
  'OPS_SUGGESTION_DISMISSED'
);

CREATE TABLE "PushSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "threadMentions" BOOLEAN NOT NULL DEFAULT true,
  "threadReplies" BOOLEAN NOT NULL DEFAULT true,
  "urgentThreads" BOOLEAN NOT NULL DEFAULT true,
  "urgentOverrideQuiet" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThreadLifecycleEvent" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "ThreadLifecycleEventType" NOT NULL,
  "messageId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ThreadLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE INDEX "ThreadLifecycleEvent_threadId_type_createdAt_idx" ON "ThreadLifecycleEvent"("threadId", "type", "createdAt");
CREATE INDEX "ThreadLifecycleEvent_actorId_createdAt_idx" ON "ThreadLifecycleEvent"("actorId", "createdAt");

ALTER TABLE "PushSubscription"
  ADD CONSTRAINT "PushSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadLifecycleEvent"
  ADD CONSTRAINT "ThreadLifecycleEvent_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThreadLifecycleEvent"
  ADD CONSTRAINT "ThreadLifecycleEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
