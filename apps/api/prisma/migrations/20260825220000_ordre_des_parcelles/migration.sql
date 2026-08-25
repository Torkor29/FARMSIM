-- Un ordre de parcelles qui ne bouge plus.
--
-- La liste des parcelles d'une ferme se lisait sans `ORDER BY` : PostgreSQL
-- rendait donc les lignes dans l'ordre du tas, et toute écriture sur une
-- parcelle la déplaçait. Or la fertilité est réécrite à chaque semis, labour,
-- épandage et moisson : l'ordre changeait à chaque coup de charrue.
--
-- La colonne porte la date d'entrée dans la ferme. Le tri devient
-- `acquiredAt` puis `id`, et une parcelle achetée se range à la fin sans
-- jamais déplacer les autres.
ALTER TABLE "Parcel" ADD COLUMN "acquiredAt" TIMESTAMP(3);

-- Rattrapage de ce qui est retrouvable.
--
-- Le journal comptable garde chaque achat de terre, avec sa date et le nom de
-- la parcelle : « Achat de parcelle — Les Grandes Terres ». On s'en sert pour
-- redonner leur vraie date aux parcelles achetées, en ne rapprochant que les
-- écritures du propriétaire actuel — un même nom peut exister dans deux
-- régions, mais pas deux fois chez le même joueur.
--
-- Ce qui reste nul : les parcelles de départ (l'écriture s'appelle « Parcelle
-- de départ » et ne nomme rien), celles cédées par un PNJ avant le journal, et
-- les fermes créées avant qu'il existe. Le tri les place en tête, par
-- identifiant : arbitraire, mais fixe — c'est tout ce qu'on lui demande.
UPDATE "Parcel" p
SET "acquiredAt" = l."at"
FROM "Farm" f, "LedgerEntry" l
WHERE p."farmId" = f."id"
  AND l."userId" = f."userId"
  AND l."poste" = 'TERRES'
  AND l."label" = 'Achat de parcelle — ' || p."label";

-- Le tri lit ces deux colonnes ensemble, sur les parcelles d'une même ferme.
CREATE INDEX "Parcel_farmId_acquiredAt_idx" ON "Parcel"("farmId", "acquiredAt");
