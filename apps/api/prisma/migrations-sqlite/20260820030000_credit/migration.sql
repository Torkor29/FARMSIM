-- La ligne de crédit.
--
-- Une exploitation réelle se finance à la dette ; ici tout était comptant, et
-- le temps d'attente remplaçait l'arbitrage financier. Les fermes existantes
-- démarrent sans dette, ce qui est leur situation actuelle.
ALTER TABLE "Farm" ADD COLUMN "debtCrd" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Farm" ADD COLUMN "debtAt" DATETIME;
