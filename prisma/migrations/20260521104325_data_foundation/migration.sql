-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "pdfHash" TEXT,
    "rawGeminiJson" TEXT NOT NULL,
    "fileName" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT NOT NULL,
    "muscleGroup" TEXT
);

-- CreateTable
CREATE TABLE "ExerciseInstance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "catalogId" TEXT,
    "rawName" TEXT NOT NULL,
    "orderInSession" INTEGER NOT NULL,
    CONSTRAINT "ExerciseInstance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExerciseInstance_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ExerciseCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SetEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" REAL,
    "reps" INTEGER,
    "rpe" REAL,
    "notes" TEXT,
    "setType" TEXT NOT NULL DEFAULT 'working',
    CONSTRAINT "SetEntry_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ExerciseInstance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "catalogId" TEXT,
    "exerciseName" TEXT NOT NULL,
    "prType" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "achievedAt" DATETIME NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PersonalRecord_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "ExerciseCatalog" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PersonalRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StreakState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "graceDaysUsedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "lastSessionDate" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StreakState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_date_idx" ON "Session"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseCatalog_canonicalName_key" ON "ExerciseCatalog"("canonicalName");

-- CreateIndex
CREATE INDEX "ExerciseCatalog_canonicalName_idx" ON "ExerciseCatalog"("canonicalName");

-- CreateIndex
CREATE INDEX "ExerciseInstance_sessionId_idx" ON "ExerciseInstance"("sessionId");

-- CreateIndex
CREATE INDEX "ExerciseInstance_catalogId_idx" ON "ExerciseInstance"("catalogId");

-- CreateIndex
CREATE INDEX "SetEntry_instanceId_idx" ON "SetEntry"("instanceId");

-- CreateIndex
CREATE INDEX "PersonalRecord_userId_idx" ON "PersonalRecord"("userId");

-- CreateIndex
CREATE INDEX "PersonalRecord_userId_catalogId_idx" ON "PersonalRecord"("userId", "catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "StreakState_userId_key" ON "StreakState"("userId");
