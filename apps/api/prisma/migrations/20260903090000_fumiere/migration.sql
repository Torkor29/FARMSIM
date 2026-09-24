-- La fumière : le fumier cesse de tenir dans l'étable.
--
-- Jusqu'ici la contenance de la fosse se déduisait des places du bâtiment
-- d'élevage. Stocker plus de fumier obligeait donc à agrandir son étable et à
-- payer des places de bêtes dont on n'avait pas l'usage : deux besoins
-- différents payés par le même mur.
--
-- Une valeur d'enum, rien d'autre. Aucune ferme existante ne change de
-- comportement : sans fumière bâtie, la capacité reste exactement celle
-- qu'elle était.

ALTER TYPE "BuildingType" ADD VALUE 'MANURE_STORE';
