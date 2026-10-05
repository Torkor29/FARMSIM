-- Réunir deux parcelles : la parcelle absorbée garde sa case de trame et
-- son propriétaire, et désigne celle qui l'a reçue.
ALTER TABLE "Parcel" ADD COLUMN "fusionneeDans" TEXT;
CREATE INDEX "Parcel_fusionneeDans_idx" ON "Parcel"("fusionneeDans");
