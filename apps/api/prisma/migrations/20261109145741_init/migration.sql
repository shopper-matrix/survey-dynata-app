-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'test', 'live', 'closed');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('info', 'single_choice', 'multi_choice', 'grid_single', 'grid_multi', 'open_text', 'number', 'rating', 'slider', 'semantic_differential', 'maxdiff', 'constant_sum', 'mapping', 'click_map', 'paired_comparison', 'timed_exposure');

-- CreateEnum
CREATE TYPE "ScreeningAction" AS ENUM ('screenout');

-- CreateEnum
CREATE TYPE "QuotaKind" AS ENUM ('cap', 'minimum');

-- CreateEnum
CREATE TYPE "RespondentStatus" AS ENUM ('started', 'complete', 'screenout', 'overquota', 'quality', 'abandoned');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('complete', 'screenout', 'overquota', 'quality');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('phone', 'tablet', 'desktop');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('owner', 'editor', 'viewer');

-- CreateTable
CREATE TABLE "Survey" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'draft',
    "targetCompletes" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "displayLogic" JSONB,
    "rotationGroup" TEXT,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "blockId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isScreener" BOOLEAN NOT NULL DEFAULT false,
    "isAttentionCheck" BOOLEAN NOT NULL DEFAULT false,
    "displayLogic" JSONB,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningRule" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "condition" JSONB NOT NULL,
    "action" "ScreeningAction" NOT NULL DEFAULT 'screenout',

    CONSTRAINT "ScreeningRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaCell" (
    "id" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "target" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "kind" "QuotaKind" NOT NULL DEFAULT 'cap',

    CONSTRAINT "QuotaCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Respondent" (
    "id" UUID NOT NULL,
    "surveyId" UUID NOT NULL,
    "panelRespondentId" TEXT NOT NULL,
    "status" "RespondentStatus" NOT NULL DEFAULT 'started',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "deviceType" "DeviceType",
    "ipHash" TEXT,
    "qualityFlags" JSONB NOT NULL DEFAULT '[]',
    "assignments" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Respondent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" UUID NOT NULL,
    "respondentId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "value" JSONB NOT NULL,
    "responseTimeMs" INTEGER,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedirectLog" (
    "id" UUID NOT NULL,
    "respondentId" UUID NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedirectLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Block_surveyId_code_key" ON "Block"("surveyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Block_surveyId_position_key" ON "Block"("surveyId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Question_surveyId_code_key" ON "Question"("surveyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Question_blockId_position_key" ON "Question"("blockId", "position");

-- CreateIndex
CREATE INDEX "ScreeningRule_questionId_idx" ON "ScreeningRule"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaCell_surveyId_name_key" ON "QuotaCell"("surveyId", "name");

-- CreateIndex
CREATE INDEX "Respondent_surveyId_status_idx" ON "Respondent"("surveyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Respondent_surveyId_panelRespondentId_key" ON "Respondent"("surveyId", "panelRespondentId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_respondentId_questionId_key" ON "Answer"("respondentId", "questionId");

-- CreateIndex
CREATE INDEX "RedirectLog_respondentId_idx" ON "RedirectLog"("respondentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningRule" ADD CONSTRAINT "ScreeningRule_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaCell" ADD CONSTRAINT "QuotaCell_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Respondent" ADD CONSTRAINT "Respondent_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedirectLog" ADD CONSTRAINT "RedirectLog_respondentId_fkey" FOREIGN KEY ("respondentId") REFERENCES "Respondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
