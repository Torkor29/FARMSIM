-- La part d'un lot achetée au négociant : consommable, revendable aux PNJ,
-- jamais aux joueurs.
ALTER TABLE "InventoryItem" ADD COLUMN "negoce" DOUBLE PRECISION NOT NULL DEFAULT 0;
