-- La réserve : la vocation de chaque case (CULTURE ou NATURE).
ALTER TABLE "ParcelCell" ADD COLUMN "vocation" TEXT NOT NULL DEFAULT 'CULTURE';
