-- Rename Event.imageUrl to Event.imageKey. It now holds a key into the
-- app's own bundled category illustrations, not a remote URL, so the
-- old values (Lorem Picsum URLs) are replaced by the next `prisma db seed`.
ALTER TABLE "Event" RENAME COLUMN "imageUrl" TO "imageKey";
