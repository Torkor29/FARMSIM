-- SQLite : orientation d'un bâtiment, et date de pose.
--
-- `rotation` compte les quarts de tour (0 à 3). Six des treize types ne sont
-- pas carrés : un hangar 3×2 tourné d'un quart occupe 2×3, et toute lecture
-- d'emprise doit passer par `orientedFootprint`.
--
-- `createdAt` ouvre la fenêtre de regret : une construction posée par erreur se
-- démolit intégralement remboursée tant qu'elle est neuve.
ALTER TABLE "Building" ADD COLUMN "rotation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Building" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
