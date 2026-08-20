-- Le journal des mouvements d'argent.
--
-- Création de table pure : aucun `ALTER TABLE ... ADD COLUMN` avec un défaut
-- non constant, qui est la forme que SQLite refuse sur une table déjà peuplée
-- et qui avait bloqué `migrate deploy` en production (P3009). Une table neuve
-- n'a rien à remplir : elle passe sur une base vide comme sur une base pleine.
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "poste" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Le Bureau lit toujours « les mouvements d'un joueur, du plus récent au plus
-- ancien » : c'est exactement cet index.
CREATE INDEX "LedgerEntry_userId_at_idx" ON "LedgerEntry"("userId", "at");
