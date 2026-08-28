-- L'élevage devient un investissement, plus une punition.
--
-- Trois jauges nouvelles sur le troupeau, et deux bâtiments d'annexe.
--
-- Le point d'attention de cette migration est la valeur de départ. Trois cent
-- soixante-trois comptes existent, et personne ne doit se reconnecter sur un
-- troupeau condamné par une jauge qui n'existait pas la veille : `water` et
-- `health` démarrent donc **au maximum**, et `deprivedSince` à NULL, c'est-à-dire
-- « rien ne manque ». C'est la seule valeur honnête — le serveur n'a aucun
-- moyen de savoir si le troupeau a eu soif hier, et supposer que oui punirait
-- pour un passé qui n'a jamais été simulé.

-- Abreuvement, de 0 à 1. Plein tant qu'on passe distribuer la ration, ou en
-- permanence si un abreuvoir automatique est rattaché au bâtiment.
ALTER TABLE "Herd" ADD COLUMN "water" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Santé, de 0 à 1. La seule jauge qui peut tuer, et elle ne baisse que par la
-- cascade : huit heures réelles de sursis après le manque, puis vingt-huit
-- heures de dégradation avant la première perte.
ALTER TABLE "Herd" ADD COLUMN "health" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- L'horloge de la cascade. NULL veut dire « tout est couvert », et elle se
-- remet à NULL dès qu'on nourrit.
ALTER TABLE "Herd" ADD COLUMN "deprivedSince" TIMESTAMP(3);

-- Les deux annexes d'élevage. Une case au sol chacune, à coller contre un
-- abri ; elles ne sont jamais obligatoires — un troupeau nourri et logé dans
-- la capacité de son étable tourne à 100 % sans elles.
ALTER TYPE "BuildingType" ADD VALUE 'WATER_TROUGH';
ALTER TYPE "BuildingType" ADD VALUE 'HAY_RACK';

-- La satisfaction change d'unité, donc l'ancienne valeur ne veut plus rien dire.
--
-- Elle mesurait une position entre le plancher de l'enfermement (0,35) et le
-- plafond du pâturage (0,95) : une jauge qui ne visitait jamais ses bornes, et
-- dont 0,6 se lisait « Sereines ». Elle mesure maintenant la part des besoins
-- couverts, où 1 veut dire « rien ne manque ». Reporter l'ancien nombre
-- afficherait « Stressées 60 % » sous une liste de causes vide — un reproche
-- sans motif, exactement ce qu'on corrige.
--
-- On repart donc du haut, et la simulation redescend au vrai chiffre dès le
-- premier tick pour les troupeaux à qui il manque réellement quelque chose :
-- la faim, la soif et le dépassement se recalculent à partir de l'état, jamais
-- à partir de cette colonne.
ALTER TABLE "Herd" ALTER COLUMN "happiness" SET DEFAULT 1;
UPDATE "Herd" SET "happiness" = 1;
