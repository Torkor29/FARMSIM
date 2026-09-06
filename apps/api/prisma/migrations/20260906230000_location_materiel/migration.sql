-- Chantier PNJ pris avec du matériel loué.
--
-- Le drapeau doit vivre sur le contrat et non se recalculer à la fin : entre
-- l'acceptation et l'encaissement, le joueur peut très bien avoir acheté la
-- moissonneuse. Sans mémoire, il encaisserait alors le plein salaire d'un
-- chantier qu'il a accepté en location — et, inversement, un engin vendu
-- entre-temps ferait échouer un chantier déjà accepté.
ALTER TABLE "NpcContract" ADD COLUMN IF NOT EXISTS "rented" BOOLEAN NOT NULL DEFAULT false;
