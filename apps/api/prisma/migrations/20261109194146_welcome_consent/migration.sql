-- AlterTable
ALTER TABLE "Respondent" ADD COLUMN     "consentedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "privacyNotice" TEXT,
ADD COLUMN     "privacyPolicyUrl" TEXT;
