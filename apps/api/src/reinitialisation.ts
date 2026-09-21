/**
 * Le jeton de réinitialisation : tirage et empreinte.
 *
 * Même partage que pour le code de secours — `packages/shared` tient la forme
 * (longueur, durée de vie, composition du lien), ce fichier tient le hasard
 * et l'empreinte, parce que lui seul tourne sur un serveur muni d'un vrai
 * générateur cryptographique.
 *
 * ## Pourquoi SHA-256 et non bcrypt
 *
 * Le mot de passe d'un joueur passe par bcrypt, à dessein : c'est un mot
 * choisi par un humain, donc attaquable au dictionnaire, et le seul remède
 * est de rendre chaque essai coûteux. Un jeton de réinitialisation est
 * l'inverse : deux cent cinquante-six bits tirés au sort, sans dictionnaire
 * possible. Le ralentir ne protégerait rien et coûterait à chaque clic.
 *
 * Ce que l'empreinte protège, c'est le cas où la base serait lue par un
 * tiers : il n'y trouverait aucun lien utilisable, seulement des condensats.
 *
 * Pas de sel non plus, contrairement au code de secours : le sel y servait à
 * ce que deux comptes recevant le même code n'aient pas la même empreinte.
 * Ici, l'empreinte est justement la **clé de recherche** — on reçoit un jeton
 * nu, sans savoir à qui il appartient, et c'est en le hachant qu'on retrouve
 * sa ligne. Un sel par compte l'interdirait.
 */

import { createHash, randomBytes } from "node:crypto";

import { REINIT_TTL_MS, jetonDeReinitValide } from "@farmsim/shared";

/**
 * Un jeton neuf : le clair, qui part dans le courriel, et son empreinte, qui
 * seule est stockée.
 *
 * Trente-deux octets rendus en base64url — 43 caractères sans remplissage,
 * lisibles dans une adresse sans échappement.
 */
export function nouveauJetonReinit(): { jeton: string; empreinte: string } {
  const jeton = randomBytes(32).toString("base64url");
  return { jeton, empreinte: empreinteJeton(jeton) };
}

/** Empreinte d'un jeton. */
export function empreinteJeton(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/** L'instant où un jeton créé maintenant cesse de valoir. */
export function expirationJeton(maintenant: number = Date.now()): Date {
  return new Date(maintenant + REINIT_TTL_MS);
}

/**
 * Cette ligne de base est-elle encore bonne ?
 *
 * Trois conditions, et chacune a son défaut correspondant : le jeton existe,
 * il n'a pas expiré, il n'a pas déjà servi. La dernière est celle qu'on
 * oublie — sans elle, un lien reste une clé permanente dans une boîte de
 * réception.
 */
export function jetonUtilisable(
  ligne: { expiresAt: Date; usedAt: Date | null } | null,
  maintenant: number = Date.now(),
): boolean {
  if (!ligne) return false;
  if (ligne.usedAt) return false;
  return ligne.expiresAt.getTime() > maintenant;
}

/** Réexporté pour que les routes n'aient qu'un seul import à faire. */
export { jetonDeReinitValide };
