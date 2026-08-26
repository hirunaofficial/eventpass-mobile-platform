-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('attendee', 'staff');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "checkedInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'attendee';
