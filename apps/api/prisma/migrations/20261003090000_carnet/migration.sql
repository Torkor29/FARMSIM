-- Le carnet de nature : les espèces observées, et le dernier jour tiré.
ALTER TABLE "Farm" ADD COLUMN "carnetJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Farm" ADD COLUMN "carnetJour" INTEGER;
