-- Announcement accountability for critical store communications.
ALTER TABLE "Announcement"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AnnouncementReceipt" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AnnouncementReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementReceipt_announcementId_userId_key"
  ON "AnnouncementReceipt"("announcementId", "userId");

CREATE INDEX "AnnouncementReceipt_userId_acknowledgedAt_idx"
  ON "AnnouncementReceipt"("userId", "acknowledgedAt");

CREATE INDEX "AnnouncementReceipt_announcementId_acknowledgedAt_idx"
  ON "AnnouncementReceipt"("announcementId", "acknowledgedAt");

ALTER TABLE "AnnouncementReceipt"
  ADD CONSTRAINT "AnnouncementReceipt_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnnouncementReceipt"
  ADD CONSTRAINT "AnnouncementReceipt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
