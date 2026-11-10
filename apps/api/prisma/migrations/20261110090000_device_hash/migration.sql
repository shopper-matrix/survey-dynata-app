-- AlterTable
ALTER TABLE "Respondent" ADD COLUMN     "deviceHash" TEXT;

-- CreateIndex
CREATE INDEX "Respondent_surveyId_ipHash_idx" ON "Respondent"("surveyId", "ipHash");
