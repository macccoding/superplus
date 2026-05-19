-- CreateEnum
CREATE TYPE "JobLane" AS ENUM ('SUPERVISOR', 'PRICING_CLERK', 'CASHIER', 'PRODUCE_MEAT', 'MERCHANDISER');

-- CreateEnum
CREATE TYPE "AbsenceType" AS ENUM ('VACATION_LEAVE', 'SICK_LEAVE', 'MATERNITY_LEAVE', 'PERSONAL_LEAVE', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "jobLane" "JobLane" NOT NULL DEFAULT 'CASHIER';

-- Existing managers/supervisors should land in the operational supervisor lane.
UPDATE "User"
SET "jobLane" = 'SUPERVISOR'
WHERE "role" IN ('OWNER', 'MANAGER', 'SUPERVISOR');

-- CreateTable
CREATE TABLE "StaffAbsence" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "type" "AbsenceType" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAbsence_storeId_startDate_endDate_idx" ON "StaffAbsence"("storeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffAbsence_userId_startDate_endDate_idx" ON "StaffAbsence"("userId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "StaffAbsence" ADD CONSTRAINT "StaffAbsence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAbsence" ADD CONSTRAINT "StaffAbsence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAbsence" ADD CONSTRAINT "StaffAbsence_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
