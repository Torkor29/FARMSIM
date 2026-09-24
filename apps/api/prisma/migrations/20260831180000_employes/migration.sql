-- Les employés de la ferme, et le logement qui les héberge.
--
-- « Le matériel plafonne, l'employé débloque » : un chantier simultané de plus
-- demande et un attelage libre et quelqu'un pour le conduire.
--
-- Rien n'est détruit ni réécrit ici : une valeur d'enum, un enum neuf, une
-- table neuve. Une ferme sans employé se comporte exactement comme avant —
-- le joueur compte pour un conducteur, et c'est le cas de départ.

ALTER TYPE "BuildingType" ADD VALUE 'EMPLOYEE_HOUSING';

CREATE TYPE "EmployeePost" AS ENUM ('CHAMP', 'ELEVAGE');

CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conduite" INTEGER NOT NULL DEFAULT 1,
    "mecanique" INTEGER NOT NULL DEFAULT 1,
    "elevage" INTEGER NOT NULL DEFAULT 1,
    "poste" "EmployeePost" NOT NULL DEFAULT 'CHAMP',
    "hiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Le candidat dont vient cet employé, dans le vivier du jour. Le vivier ne
    -- se stocke pas : il se recalcule. Sans cette trace, la même personne
    -- s'embaucherait deux fois.
    "sourceId" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Employee_farmId_idx" ON "Employee"("farmId");

-- L'unicité est tenue par la base, pas par une lecture préalable : deux
-- requêtes d'embauche lancées ensemble passeraient toutes deux le contrôle.
CREATE UNIQUE INDEX "Employee_farmId_sourceId_key" ON "Employee"("farmId", "sourceId");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
