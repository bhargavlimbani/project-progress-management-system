-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CriteriaScope" AS ENUM ('TEAM', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" TEXT;

-- AlterTable
ALTER TABLE "EvaluationCriteria" ADD COLUMN     "scope" "CriteriaScope" NOT NULL DEFAULT 'TEAM';

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "conductedById" TEXT,
ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "rescheduleReason" TEXT,
ADD COLUMN     "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "reminderSentAt" TIMESTAMP(3),
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- CreateTable
CREATE TABLE "StudentEvaluation" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "vivaMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contributionMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grade" TEXT,
    "feedback" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEvaluationMark" (
    "id" TEXT NOT NULL,
    "studentEvaluationId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "marksAwarded" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "StudentEvaluationMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT,
    "body" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentEvaluation_evaluationId_studentId_key" ON "StudentEvaluation"("evaluationId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentEvaluationMark_studentEvaluationId_criteriaId_key" ON "StudentEvaluationMark"("studentEvaluationId", "criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_dedupKey_key" ON "NotificationDelivery"("dedupKey");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_studentId_subjectId_date_key" ON "AttendanceRecord"("studentId", "subjectId", "date");

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluationMark" ADD CONSTRAINT "StudentEvaluationMark_studentEvaluationId_fkey" FOREIGN KEY ("studentEvaluationId") REFERENCES "StudentEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEvaluationMark" ADD CONSTRAINT "StudentEvaluationMark_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "EvaluationCriteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
