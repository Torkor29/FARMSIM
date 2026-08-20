-- Code de secours : retrouver sa ferme sans envoi d'e-mail.
--
-- Deux colonnes nulles, donc aucun verrou de table à la pose : les comptes
-- existants restent sans code de secours et s'en voient remettre un à leur
-- prochaine connexion. Rien à rattraper à la main.
ALTER TABLE "User" ADD COLUMN "recoveryHash" TEXT;
ALTER TABLE "User" ADD COLUMN "recoveryAt" TIMESTAMP(3);
