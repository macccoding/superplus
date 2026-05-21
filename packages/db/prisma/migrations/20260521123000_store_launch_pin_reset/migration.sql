-- Store phased launch controls and first-login PIN reset flags.
ALTER TABLE "Store"
  ADD COLUMN "launchEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "launchedAt" TIMESTAMP(3),
  ADD COLUMN "launchNotes" TEXT;

ALTER TABLE "User"
  ADD COLUMN "mustChangePin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pinChangedAt" TIMESTAMP(3);

CREATE INDEX "Store_isActive_launchEnabled_idx" ON "Store"("isActive", "launchEnabled");
CREATE INDEX "User_storeId_mustChangePin_idx" ON "User"("storeId", "mustChangePin");
