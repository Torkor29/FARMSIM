-- Trace du passage de l'employé affecté à l'élevage.
--
-- L'employé refait désormais la mangeoire et la litière. Sans cette colonne,
-- il le ferait en silence : le joueur verrait seulement ses alertes ne plus
-- apparaître, ce qui est exactement ce qu'il voit aussi quand l'employé ne
-- sert à rien. C'est ce silence qui a fait poser la question deux fois.
ALTER TABLE "Herd" ADD COLUMN IF NOT EXISTS "tendedAt" TIMESTAMP(3);
