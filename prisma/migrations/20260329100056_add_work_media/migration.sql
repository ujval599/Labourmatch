-- CreateTable
CREATE TABLE "work_media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "caption" TEXT,
    "projectName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_media_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
