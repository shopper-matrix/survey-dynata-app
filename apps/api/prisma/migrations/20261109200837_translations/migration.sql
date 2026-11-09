-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "Respondent" ADD COLUMN     "language" TEXT;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';
