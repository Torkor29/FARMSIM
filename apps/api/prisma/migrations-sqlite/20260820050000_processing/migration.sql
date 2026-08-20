-- Les ateliers de transformation.
--
-- Tout se vendait brut : le lait en lait, le blé en blé. Deux bâtiments —
-- laiterie et moulin — ouvrent la seule question qui manquait au marché,
-- vendre maintenant ou vendre mieux plus tard.
--
-- `processedAt` est l'arrêté du dernier passage. Nul pour les bâtiments
-- existants, dont aucun ne transforme : la production part de la pose.
ALTER TABLE "Building" ADD COLUMN "processedAt" DATETIME;
