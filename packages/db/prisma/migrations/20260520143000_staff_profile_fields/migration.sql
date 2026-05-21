ALTER TABLE "User"
ADD COLUMN "preferredName" TEXT,
ADD COLUMN "birthdayMonth" INTEGER,
ADD COLUMN "birthdayDay" INTEGER,
ADD COLUMN "favoriteColor" TEXT,
ADD COLUMN "favoriteTreat" TEXT,
ADD COLUMN "dreamGoal" TEXT,
ADD COLUMN "proudMoment" TEXT,
ADD COLUMN "learningInterest" TEXT,
ADD COLUMN "celebrationPreference" TEXT,
ADD COLUMN "showBirthday" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "profileUpdatedAt" TIMESTAMP(3);

CREATE INDEX "User_birthdayMonth_birthdayDay_idx" ON "User"("birthdayMonth", "birthdayDay");
CREATE INDEX "User_profileUpdatedAt_idx" ON "User"("profileUpdatedAt");
