-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "retentionDays" INTEGER;

-- CreateTable
CREATE TABLE "RetentionRun" (
    "id" UUID NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondentsDeleted" INTEGER NOT NULL,
    "answersDeleted" INTEGER NOT NULL,
    "perSurvey" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "RetentionRun_pkey" PRIMARY KEY ("id")
);
