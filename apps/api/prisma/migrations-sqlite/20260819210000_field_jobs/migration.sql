-- Chantiers qui durent.
--
-- Un travail cesse d'être instantané : il réserve ses cases, immobilise son
-- attelage, et s'exécute à l'échéance. `busyUntil` est nullable, donc l'ajout
-- de colonne n'a pas besoin de valeur par défaut calculée — la forme que
-- SQLite refuse sur une table peuplée.
ALTER TABLE "Machine" ADD COLUMN "busyUntil" DATETIME;

CREATE TABLE "FieldJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "cellsJson" TEXT NOT NULL,
    "crop" TEXT,
    "machineId" TEXT NOT NULL,
    "tractorId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    CONSTRAINT "FieldJob_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FieldJob_parcelId_status_idx" ON "FieldJob"("parcelId", "status");
CREATE INDEX "FieldJob_userId_status_idx" ON "FieldJob"("userId", "status");
