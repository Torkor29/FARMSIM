-- Compteur horaire et marché de l'occasion.
--
-- `ALTER TABLE ... ADD COLUMN` avec un DEFAULT constant passe sans réécrire la
-- table ; c'est la seule forme que SQLite accepte sur une table peuplée, et
-- une migration précédente s'y était cassé les dents (P3009) en tentant un
-- DEFAULT calculé. Les machines déjà en service repartent donc à zéro heure :
-- leur `condition` reste la vérité de leur entretien, et leur cote de revente
-- part de neuf. Aucune ne perd de valeur au passage.
ALTER TABLE "Machine" ADD COLUMN "hours" REAL NOT NULL DEFAULT 0;

CREATE TABLE "MachineListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "hours" REAL NOT NULL DEFAULT 0,
    "condition" REAL NOT NULL DEFAULT 100,
    "grease" REAL NOT NULL DEFAULT 100,
    "dirt" REAL NOT NULL DEFAULT 0,
    "breakdown" TEXT,
    "priceCrd" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "buyerId" TEXT,
    "soldAt" DATETIME,
    CONSTRAINT "MachineListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MachineListing_status_type_idx" ON "MachineListing"("status", "type");
