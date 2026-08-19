-- La cuve à gazole.
--
-- Les fermes existantes démarrent avec la même dotation qu'une ferme neuve :
-- elles ont travaillé jusqu'ici sans carburant, il serait absurde de les
-- arrêter net au premier chantier.
ALTER TABLE "Farm" ADD COLUMN "fuelL" REAL NOT NULL DEFAULT 600;

