-- Une terre vierge n'a pas d'adventices.
--
-- La migration qui a introduit la pression donnait 0,45 à toute case dont le
-- booléen `weedsControlled` valait faux — y compris aux cases nues, jamais
-- semées, qui portaient ce faux par simple valeur par défaut. Une ferme neuve
-- héritait donc d'un champ à moitié sale avant d'avoir rien planté.
--
-- Dans son propre fichier, et pas en correction de la précédente : une
-- migration déjà appliquée ne se rejoue pas.
UPDATE "ParcelCell" SET "weedPressure" = 0, "weedAt" = NULL
WHERE "kind" != 'CROP' AND "crop" IS NULL;
