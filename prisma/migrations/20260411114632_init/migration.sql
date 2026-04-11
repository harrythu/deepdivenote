-- CreateEnum
CREATE TYPE "AppMode" AS ENUM ('EXTERNAL', 'INTERNAL', 'BOTH');

-- AlterTable
ALTER TABLE "user_templates" ADD COLUMN     "available_mode" "AppMode" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "user_vocabularies" ADD COLUMN     "available_mode" "AppMode" NOT NULL DEFAULT 'BOTH';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferred_mode" "AppMode" NOT NULL DEFAULT 'EXTERNAL',
ADD COLUMN     "theta_api_key" TEXT;
