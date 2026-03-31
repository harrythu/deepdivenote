-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('PENDING', 'UPLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '未命名会议',
    "audio_path" TEXT,
    "audio_size" INTEGER,
    "audio_format" TEXT,
    "duration" INTEGER,
    "status" "MeetingStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "full_text" TEXT NOT NULL,
    "segments" JSONB,
    "language" TEXT,
    "word_count" INTEGER,
    "confidence" DOUBLE PRECISION,
    "model" TEXT NOT NULL DEFAULT 'whisper-1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "key_points" JSONB,
    "action_items" JSONB,
    "participants" JSONB,
    "tags" JSONB,
    "model" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet',
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_status_idx" ON "meetings"("status");

-- CreateIndex
CREATE INDEX "meetings_created_at_idx" ON "meetings"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transcriptions_meeting_id_key" ON "transcriptions"("meeting_id");

-- CreateIndex
CREATE INDEX "transcriptions_meeting_id_idx" ON "transcriptions"("meeting_id");

-- CreateIndex
CREATE UNIQUE INDEX "summaries_meeting_id_key" ON "summaries"("meeting_id");

-- CreateIndex
CREATE INDEX "summaries_meeting_id_idx" ON "summaries"("meeting_id");

-- AddForeignKey
ALTER TABLE "transcriptions" ADD CONSTRAINT "transcriptions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
