-- La cour de stationnement sort de la grille.
--
-- Un engin garé occupait une case de champ : elle passait en `VEHICLE`, on ne
-- pouvait plus rien y semer, et le tracteur restait planté au milieu du blé.
-- Le parc est maintenant une aire dessinée à côté de l'île, qui n'appartient
-- pas à la grille.
--
-- Les fermes déjà jouées récupèrent donc leurs cases : la machine reste garée
-- sur sa parcelle (`Machine.parkedParcelId` ne bouge pas), seule l'occupation
-- du sol est levée.
UPDATE "ParcelCell"
SET "kind" = 'EMPTY', "machineId" = NULL
WHERE "kind" = 'VEHICLE';
