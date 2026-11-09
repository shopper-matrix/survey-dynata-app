-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "notes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "assignments" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "notes" TEXT[] DEFAULT ARRAY[]::TEXT[];
