-- Les lots de jeunes bêtes en croissance.
--
-- Création de table pure, comme le journal et les commandes : aucun
-- `ALTER TABLE ... ADD COLUMN` avec un défaut non constant, la forme que
-- SQLite refuse sur une table déjà peuplée et qui avait bloqué
-- `migrate deploy` en production (P3009).
--
-- Un lot plutôt qu'un compteur sur le troupeau : deux achats faits à dix
-- minutes d'intervalle ne mûrissent pas ensemble.
CREATE TABLE "YoungBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "herdId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "maturesAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YoungBatch_herdId_fkey" FOREIGN KEY ("herdId") REFERENCES "Herd" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Le tick cherche « les lots arrivés à maturité » : c'est cet index.
CREATE INDEX "YoungBatch_herdId_maturesAt_idx" ON "YoungBatch"("herdId", "maturesAt");
