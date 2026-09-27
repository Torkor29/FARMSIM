-- Relief : le niveau de chaque case (0 = la plaine).
ALTER TABLE "ParcelCell" ADD COLUMN "niveau" INTEGER NOT NULL DEFAULT 0;
