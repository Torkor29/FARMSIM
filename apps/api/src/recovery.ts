/**
 * L'empreinte du code de secours.
 *
 * Le code d'accès du jeu est encore stocké en clair — dette assumée et
 * documentée dans le schéma. Le code de secours, lui, ne l'est pas : il
 * ouvrirait la porte de **tous** les comptes d'un coup si la base fuitait,
 * puisqu'il permet précisément de changer le code d'accès sans rien savoir
 * d'autre. On n'en garde donc qu'une empreinte.
 *
 * SHA-256 salé par l'identifiant du compte, et non un scrypt : le code fait
 * 80 bits de hasard vrai, pas un mot choisi par un humain. Il n'y a pas de
 * dictionnaire à ralentir — l'attaque par force brute est hors de portée
 * quelle que soit la vitesse du calcul. Le sel, lui, sert à ce que deux
 * comptes ayant reçu le même code (ce qui n'arrivera pas, mais) n'aient pas
 * la même empreinte, et à ce qu'une table pré-calculée ne serve à rien.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { RECOVERY_LEN, normalizeRecovery, recoveryFromBytes } from "@farmsim/shared";

/** Tire un code de secours neuf. Le clair n'existe qu'ici et à l'écran. */
export function nouveauCodeSecours(): string {
  return recoveryFromBytes(randomBytes(RECOVERY_LEN));
}

/** Empreinte d'un code, pour un compte donné. */
export function empreinteSecours(userId: string, code: string): string {
  return createHash("sha256").update(`${userId}:${normalizeRecovery(code)}`).digest("hex");
}

/**
 * Comparaison à durée constante.
 *
 * Un `===` sur des chaînes s'arrête au premier octet différent : le temps de
 * réponse laisse alors filtrer combien de caractères de tête sont justes, et
 * un code se retrouve devinable symbole par symbole. Le coût de la parade est
 * nul, on la prend.
 */
export function secoursCorrespond(attendu: string | null, userId: string, saisi: string): boolean {
  if (!attendu) return false;
  const calcule = empreinteSecours(userId, saisi);
  const a = Buffer.from(attendu, "utf8");
  const b = Buffer.from(calcule, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
