-- Ce que l'équipe a fait au dernier passage, et pas seulement quand.
--
-- La date seule ne répondait pas à la question posée en jouant : « l'employé
-- a l'air de bien gérer, ce qu'il faut que je teste c'est ce qu'il fait à
-- propos du fumier, est-ce qu'il le traite, le vend, vide simplement, je ne
-- sais pas ce qu'il se passe ». Un travail délégué dont on ne sait pas ce
-- qu'il fait n'est pas délégué, il est subi.
ALTER TABLE "Herd" ADD COLUMN IF NOT EXISTS "tendedWhat" TEXT;
