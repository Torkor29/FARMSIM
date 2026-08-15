-- SQLite : orientation d'un bâtiment, et date de pose.
--
-- `rotation` compte les quarts de tour (0 à 3). Six des treize types ne sont
-- pas carrés : un hangar 3×2 tourné d'un quart occupe 2×3, et toute lecture
-- d'emprise doit passer par `orientedFootprint`.
--
-- `createdAt` ouvre la fenêtre de regret : une construction posée par erreur se
-- démolit intégralement remboursée tant qu'elle est neuve.
--
-- On **reconstruit la table** au lieu d'ajouter les colonnes.
--
-- La version précédente écrivait :
--
--     ALTER TABLE "Building" ADD COLUMN "createdAt" DATETIME
--       NOT NULL DEFAULT CURRENT_TIMESTAMP;
--
-- SQLite refuse un défaut non constant sur une colonne ajoutée — mais
-- seulement s'il a des lignes à remplir. Sur une base neuve, la table est
-- vide et l'ordre passe ; sur une ferme réelle, il échoue avec « Cannot add a
-- column with non-constant default ». D'où une migration verte sur toutes les
-- bases de test et rouge sur la seule qui compte, celle de production — où le
-- conteneur redémarrait alors en boucle, `migrate deploy` refusant ensuite
-- d'appliquer quoi que ce soit (P3009).
--
-- Dans un CREATE TABLE, en revanche, `DEFAULT CURRENT_TIMESTAMP` est
-- parfaitement légal. C'est d'ailleurs déjà le procédé de la migration
-- `20260812084004_building_levels`, qui a ajouté `level` de cette façon.
--
-- Les bâtiments déjà posés reçoivent une date **ancienne**, et non l'instant
-- présent : mettre `CURRENT_TIMESTAMP` aurait rendu toute la ferme
-- intégralement remboursable pendant les trois minutes suivant la mise à jour.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parcelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "originX" INTEGER NOT NULL,
    "originY" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Building_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Building" ("id", "parcelId", "type", "level", "originX", "originY", "rotation", "createdAt")
SELECT "id", "parcelId", "type", "level", "originX", "originY", 0, '1970-01-01 00:00:00' FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
