-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "meeting_histories" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "upload_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "upload_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_name" TEXT NOT NULL,
    "summary_date" TIMESTAMP(3),
    "summary_time" TIMESTAMP(3),
    "summary_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_histories_meeting_id_key" ON "meeting_histories"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_histories_meeting_id_idx" ON "meeting_histories"("meeting_id");

-- CreateIndex
CREATE INDEX "meeting_histories_upload_date_idx" ON "meeting_histories"("upload_date");

-- CreateIndex
CREATE INDEX "meetings_user_id_idx" ON "meetings"("user_id");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_histories" ADD CONSTRAINT "meeting_histories_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
