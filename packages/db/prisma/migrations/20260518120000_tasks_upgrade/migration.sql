-- Tasks upgrade: workflow, progress timeline, checklists, attachments, links, and templates.
-- Existing Task rows keep their status and receive default values for all new required fields.

CREATE TYPE "TaskUpdateType" AS ENUM (
  'CREATED',
  'NOTE',
  'HELP_REQUESTED',
  'HELP_RESOLVED',
  'STATUS_CHANGED',
  'REASSIGNED',
  'COMPLETION',
  'SUBMITTED_REVIEW',
  'APPROVED',
  'SENT_BACK',
  'CANCELLED',
  'CHECKLIST_UPDATED',
  'ATTACHMENT_ADDED'
);

CREATE TYPE "TaskAttachmentType" AS ENUM ('IMAGE', 'DOCUMENT', 'LINK');

CREATE TYPE "TaskLinkType" AS ENUM (
  'INCIDENT',
  'LOGBOOK',
  'CHECKLIST',
  'PRODUCT',
  'STOCK_OUT',
  'EXPIRY_ALERT',
  'PURCHASE_ORDER',
  'SOP_GUIDE',
  'THREAD',
  'OTHER'
);

ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'NEEDS_HELP';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';

ALTER TABLE "Task"
  ADD COLUMN "assetLabel" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "completionNote" TEXT,
  ADD COLUMN "dueReminderAt" TIMESTAMP(3),
  ADD COLUMN "helpRequestedAt" TIMESTAMP(3),
  ADD COLUMN "helpResolvedAt" TIMESTAMP(3),
  ADD COLUMN "requireCompletionNote" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireCompletionPhoto" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "startDate" TIMESTAMP(3),
  ADD COLUMN "submittedForReviewAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "workArea" TEXT;

CREATE TABLE "TaskUpdate" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "type" "TaskUpdateType" NOT NULL DEFAULT 'NOTE',
  "body" TEXT,
  "fromStatus" "TaskStatus",
  "toStatus" "TaskStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskChecklistItem" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isDone" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskAttachment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "type" "TaskAttachmentType" NOT NULL,
  "url" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskLink" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "type" "TaskLinkType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskTemplate" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "defaultWorkArea" TEXT,
  "defaultAssetLabel" TEXT,
  "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
  "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
  "requireCompletionNote" BOOLEAN NOT NULL DEFAULT false,
  "requireCompletionPhoto" BOOLEAN NOT NULL DEFAULT false,
  "recurrenceRule" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskTemplateItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "TaskTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskUpdate_taskId_createdAt_idx" ON "TaskUpdate"("taskId", "createdAt");
CREATE INDEX "TaskChecklistItem_taskId_sortOrder_idx" ON "TaskChecklistItem"("taskId", "sortOrder");
CREATE INDEX "TaskAttachment_taskId_createdAt_idx" ON "TaskAttachment"("taskId", "createdAt");
CREATE INDEX "TaskLink_taskId_idx" ON "TaskLink"("taskId");
CREATE INDEX "TaskLink_type_entityId_idx" ON "TaskLink"("type", "entityId");
CREATE INDEX "TaskTemplate_storeId_isActive_idx" ON "TaskTemplate"("storeId", "isActive");
CREATE INDEX "TaskTemplate_storeId_category_idx" ON "TaskTemplate"("storeId", "category");
CREATE INDEX "TaskTemplateItem_templateId_sortOrder_idx" ON "TaskTemplateItem"("templateId", "sortOrder");
CREATE INDEX "Task_storeId_dueDate_idx" ON "Task"("storeId", "dueDate");
CREATE INDEX "Task_storeId_workArea_idx" ON "Task"("storeId", "workArea");

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskUpdate"
  ADD CONSTRAINT "TaskUpdate_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskUpdate"
  ADD CONSTRAINT "TaskUpdate_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskChecklistItem"
  ADD CONSTRAINT "TaskChecklistItem_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskChecklistItem"
  ADD CONSTRAINT "TaskChecklistItem_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaskAttachment"
  ADD CONSTRAINT "TaskAttachment_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskAttachment"
  ADD CONSTRAINT "TaskAttachment_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskLink"
  ADD CONSTRAINT "TaskLink_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskTemplate"
  ADD CONSTRAINT "TaskTemplate_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskTemplate"
  ADD CONSTRAINT "TaskTemplate_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaskTemplateItem"
  ADD CONSTRAINT "TaskTemplateItem_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "TaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
