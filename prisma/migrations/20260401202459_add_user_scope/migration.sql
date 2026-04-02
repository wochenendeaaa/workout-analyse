-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkoutAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT,
    "payload" TEXT NOT NULL,
    "userId" TEXT,
    CONSTRAINT "WorkoutAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkoutAnalysis" ("createdAt", "fileName", "id", "payload") SELECT "createdAt", "fileName", "id", "payload" FROM "WorkoutAnalysis";
DROP TABLE "WorkoutAnalysis";
ALTER TABLE "new_WorkoutAnalysis" RENAME TO "WorkoutAnalysis";
CREATE INDEX "WorkoutAnalysis_userId_idx" ON "WorkoutAnalysis"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
