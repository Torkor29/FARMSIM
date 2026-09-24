-- Le code de secours est retiré.
--
-- Il existait parce que le serveur n'envoyait aucun courriel : un « mot de
-- passe oublié » classique ne pouvait pas exister, et il fallait bien un
-- filet. Le lien par courriel est entré en service ; le filet fait double
-- emploi.
--
-- Deux voies pour le même oubli, c'était deux écrans à expliquer, deux chemins
-- à éprouver, et une fenêtre imposée à l'inscription pour faire recopier un
-- code que personne ne relisait.
--
-- Les deux colonnes partent avec lui. Elles ne contiennent que des empreintes
-- SHA-256 de codes que plus aucune route ne lit : les garder reviendrait à
-- laisser derrière soi une donnée sans lecteur, que le prochain à ouvrir ce
-- schéma prendrait pour un mécanisme vivant.
--
-- Ce que cela coûte, et qui a été accepté en connaissance de cause : un joueur
-- qui perd l'accès à sa boîte aux lettres — ou qui s'est trompé d'adresse à
-- l'inscription, laquelle n'est pas vérifiée — n'a plus de recours en libre
-- service. Il reste `scripts/farmsim-code-secours.sh`, côté serveur.

/*
  Warnings:

  - You are about to drop the column `recoveryAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `recoveryHash` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "recoveryAt",
DROP COLUMN "recoveryHash";
