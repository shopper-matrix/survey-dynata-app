-- CreateTable
CREATE TABLE "DynataSurveySettings" (
    "surveyId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynataSurveySettings_pkey" PRIMARY KEY ("surveyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DynataSurveySettings_projectId_key" ON "DynataSurveySettings"("projectId");

-- AddForeignKey
ALTER TABLE "DynataSurveySettings" ADD CONSTRAINT "DynataSurveySettings_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
