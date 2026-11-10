-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "attentionAnswer" JSONB;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "qualitySettings" JSONB NOT NULL DEFAULT '{}';
