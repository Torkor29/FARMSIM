-- SQLite : la progression du joueur.
--
-- `statsJson` porte les compteurs cumulés de travail — cases semées, tonnes
-- récoltées, bêtes soignées — alimentés par chaque route de travail en même
-- temps que l'expérience. Les quêtes s'en déduisent, plutôt que d'entretenir
-- un avancement parallèle qui finirait par diverger.
ALTER TABLE "User" ADD COLUMN "statsJson" TEXT NOT NULL DEFAULT '{}';

-- Seul l'encaissement d'une récompense se stocke : l'avancement se lit sur les
-- compteurs, donc il ne peut pas mentir.
CREATE TABLE "QuestClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuestClaim_userId_questId_key" ON "QuestClaim"("userId", "questId");
