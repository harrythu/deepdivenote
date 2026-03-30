-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '未命名会议',
    "audio_path" TEXT,
    "audio_size" INTEGER,
    "audio_format" TEXT,
    "duration" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "transcriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meeting_id" TEXT NOT NULL,
    "full_text" TEXT NOT NULL,
    "segments" JSONB,
    "language" TEXT,
    "word_count" INTEGER,
    "confidence" REAL,
    "model" TEXT NOT NULL DEFAULT 'whisper-1',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "transcriptions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meeting_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "key_points" JSONB,
    "action_items" JSONB,
    "participants" JSONB,
    "tags" JSONB,
    "model" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet',
    "tokens_used" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "summaries_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
