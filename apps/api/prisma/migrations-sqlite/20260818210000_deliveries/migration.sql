-- Les commandes en route vers la ferme.
--
-- Création de table pure, comme pour le journal : aucun `ALTER TABLE ... ADD
-- COLUMN` avec un défaut non constant, la forme que SQLite refuse sur une
-- table déjà peuplée et qui avait bloqué `migrate deploy` en production
-- (P3009). Une table neuve n'a rien à remplir.
CREATE TABLE "SupplyOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "farmId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "tons" REAL NOT NULL,
    "arrivesAt" DATETIME NOT NULL,
    "autoAt" DATETIME NOT NULL,
    "parcelId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplyOrder_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- On lit toujours « les livraisons d'une ferme, les plus proches d'abord ».
CREATE INDEX "SupplyOrder_farmId_arrivesAt_idx" ON "SupplyOrder"("farmId", "arrivesAt");
