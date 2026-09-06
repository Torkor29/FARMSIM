-- Le maraîchage : cinq cultures courtes.
--
-- Demandé en jouant : « pour ajouter des boucles de jeu plus courtes, il va
-- falloir ajouter des récoltes avec une durée plus courte ». La plus rapide du
-- catalogue était l'herbe à douze heures réelles ; on ne pouvait ni semer ni
-- récolter dans une même soirée.
--
-- Deux à dix heures selon la culture. Les valeurs ne s'ajoutent qu'ici : le
-- reste — durées, prix, saisons — vit dans les règles partagées.
ALTER TYPE "CropCode" ADD VALUE IF NOT EXISTS 'MESCLUN';
ALTER TYPE "CropCode" ADD VALUE IF NOT EXISTS 'RADISH';
ALTER TYPE "CropCode" ADD VALUE IF NOT EXISTS 'SPINACH';
ALTER TYPE "CropCode" ADD VALUE IF NOT EXISTS 'LETTUCE';
ALTER TYPE "CropCode" ADD VALUE IF NOT EXISTS 'POTATO';
