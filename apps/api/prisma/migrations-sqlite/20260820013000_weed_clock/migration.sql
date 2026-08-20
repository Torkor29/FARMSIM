-- Depuis quand la pression d'adventices court.
--
-- Sans cette date, la pression resterait figée à sa valeur de semis et le
-- désherbage n'aurait rien à combattre. Elle s'intègre à la lecture, comme la
-- croissance, plutôt que d'être poussée par un tick.
--
-- Les cases déjà semées prennent leur date de semis : c'est bien de là que
-- leurs adventices sont parties.
ALTER TABLE "ParcelCell" ADD COLUMN "weedAt" DATETIME;
UPDATE "ParcelCell" SET "weedAt" = "plantedAt" WHERE "plantedAt" IS NOT NULL;
