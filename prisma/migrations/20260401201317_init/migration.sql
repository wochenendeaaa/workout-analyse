-- CreateTable
CREATE TABLE "WorkoutAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT,
    "payload" TEXT NOT NULL
);
