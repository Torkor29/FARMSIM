-- Berges : la forme des coins de chaque case d'eau (0 = tout arrondi).
ALTER TABLE "ParcelCell" ADD COLUMN "forme" INTEGER NOT NULL DEFAULT 0;
