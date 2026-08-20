-- Gazole engagé par un chantier en cours, pour pouvoir le rendre si le joueur
-- abandonne.
--
-- Dans un fichier à part, et pas ajouté à la migration précédente : une
-- migration déjà appliquée ne se rejoue pas. L'instruction serait passée en
-- local — où la base venait d'être remontée — et jamais en production, qui
-- avait déjà enregistré la version d'avant. Le genre de silence qui ne se voit
-- qu'au premier chantier lancé en ligne.
ALTER TABLE "FieldJob" ADD COLUMN "fuelL" REAL NOT NULL DEFAULT 0;
