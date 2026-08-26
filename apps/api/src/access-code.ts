/**
 * Le code d'accès, et sa mise à l'abri.
 *
 * Il était stocké **en clair**, sous un commentaire qui l'assumait : « code
 * d'accès MVP (pas un vrai hash — démo locale) ». La démo locale est devenue
 * un jeu public sur un serveur ; le commentaire, lui, n'a pas bougé. Le
 * propriétaire du serveur a retrouvé le mot de passe d'un joueur en lisant une
 * colonne — et c'est exactement la propriété qu'un stockage de secret doit
 * rendre impossible, y compris à celui qui administre la base.
 *
 * ## bcrypt, et pas argon2
 *
 * Argon2id est meilleur sur le papier, et c'est le premier choix par défaut.
 * Il est écarté ici pour une raison mesurée, pas doctrinale : il est
 * **coûteux en mémoire par définition** — 19 Mio par vérification dans les
 * réglages courants — et la machine visée tient sur 1 906 Mio dont 246 étaient
 * libres, avec le conteneur du jeu désormais plafonné à 896 Mio. Une poignée
 * de connexions simultanées y prendrait une part visible du plafond. bcrypt,
 * lui, consomme quelques kilo-octets quel que soit le coût.
 *
 * `bcryptjs` plutôt que le `bcrypt` natif, pour deux raisons :
 *
 *  - **aucun compilateur.** L'image est bâtie sur `node:22-bookworm-slim`, qui
 *    n'a ni gcc ni node-gyp. Une dépendance native imposerait soit une étape
 *    de construction, soit un binaire pré-compilé qui doit correspondre à
 *    l'architecture — un mode de panne de plus au démarrage, et ce dépôt en a
 *    déjà connu deux avec les moteurs Prisma ;
 *  - **elle ne bloque pas la boucle d'événements.** Mesuré : un hachage
 *    asynchrone de 372 ms retarde la boucle de 103 ms au pire, contre 327 ms
 *    pour la version synchrone qui la tient d'un bloc. Sur un conteneur
 *    plafonné à un cœur, c'est la différence entre « une connexion coûte cher »
 *    et « une connexion fige le jeu pour tout le monde ».
 *
 * **Tout ce module est asynchrone, et il faut qu'il le reste.** Les variantes
 * `…Sync` de `bcryptjs` existent et rendraient la main plus vite ; elles
 * feraient exactement ce qu'on vient d'écarter.
 *
 * ## Migration sans rien casser
 *
 * Aucun compte n'est invalidé. La colonne accueille les deux formes, et
 * `codeCorrespond()` reconnaît laquelle elle a sous les yeux : une empreinte
 * bcrypt se vérifie, un code en clair se compare. À la première connexion
 * réussie d'un compte encore en clair, l'appelant remplace la valeur par son
 * empreinte — le seul instant où l'on est sûr d'avoir affaire au propriétaire,
 * puisqu'il vient de donner son code. Même mécanique que le rattrapage des
 * codes de secours, pour la même raison.
 *
 * Les comptes qui ne se reconnectent jamais ne sont pas oubliés pour autant :
 * `scripts/farmsim-hacher-codes.mjs` balaie ce qui reste. Hacher un code
 * connu ne le perd pas — le joueur pourra toujours se connecter avec.
 *
 * @see recovery.ts — le code de secours, lui, n'a jamais été en clair.
 */

import { timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";

/**
 * Coût du hachage — 2^12 tours `[GD]`.
 *
 * Mesuré sur la machine de développement : 105 ms au coût 10, 168 ms au 11,
 * 332 ms au 12, 654 ms au 13. Le VPS est plus lent et son conteneur est
 * plafonné à un cœur : compter le double là-bas.
 *
 * Douze, donc — au-dessus du minimum couramment recommandé (dix), et en deçà
 * du seuil où une connexion se met à peser sur une machine déjà chargée. La
 * route `/auth/…` est de toute façon derrière la limite de débit : dix essais,
 * puis un toutes les trente secondes. Une attaque par dictionnaire ne passe
 * pas par là ; ce coût protège la base **volée**, pas la porte d'entrée.
 */
export const BCRYPT_COST = 12;

/**
 * Ce qu'on écrit pour un compte qui ne doit jamais pouvoir se connecter.
 *
 * Les fermes PNJ recevaient `npc-<huit caractères de l'identifiant de
 * parcelle>` : un code en clair, déductible de données publiques, sur trois
 * cents comptes. Ils ne se connectent jamais — personne ne tient le clavier —
 * et leur en donner un ne servait donc qu'à peupler la colonne de secrets.
 *
 * La chaîne vide fait le travail sans cas particulier : le schéma de connexion
 * exige au moins un caractère, `timingSafeEqual` refuse deux longueurs
 * différentes, et rien ne peut donc correspondre. On ne hache pas non plus
 * trois cents codes au démarrage du monde — six minutes de calcul pour des
 * comptes que personne n'ouvrira.
 */
export const CODE_INUTILISABLE = "";

/**
 * Motif d'une empreinte bcrypt, **en entier**.
 *
 * `$2a$`, `$2b$` ou `$2y$`, le coût sur deux chiffres, puis vingt-deux
 * caractères de sel et trente et un de condensat — soixante en tout, toujours.
 *
 * La longueur n'est pas un luxe. Un joueur choisit son code, entre trois et
 * trente-deux caractères : rien ne l'empêche de taper `$2b$12$quelquechose`.
 * Avec un motif qui ne regarderait que le préfixe, cette valeur stockée **en
 * clair** serait prise pour une empreinte, `bcrypt.compare` échouerait, et le
 * joueur ne rouvrirait plus son compte. Trente-deux caractères ne pouvant
 * jamais en faire soixante, la longueur tranche à coup sûr.
 */
const EMPREINTE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** Cette valeur est-elle déjà une empreinte, ou encore un code en clair ? */
export function estHache(stocke: string): boolean {
  return EMPREINTE.test(stocke);
}

/** Ce compte attend-il encore d'être migré ? */
export function doitEtreMigre(stocke: string): boolean {
  return stocke !== CODE_INUTILISABLE && !estHache(stocke);
}

/** Empreinte d'un code d'accès. Le clair n'existe plus après cet appel. */
export async function hacherCode(clair: string): Promise<string> {
  return bcrypt.hash(clair, BCRYPT_COST);
}

/**
 * Comparaison de deux codes en clair, à durée constante.
 *
 * Un `===` sur des chaînes s'arrête au premier octet différent : le temps de
 * réponse laisse filtrer combien de caractères de tête sont justes. C'est le
 * défaut que `recovery.ts` évitait déjà pour le code de secours, et que la
 * route de connexion commettait pour le code d'accès. Il ne survit pas à la
 * migration, mais il faut bien traverser celle-ci.
 */
function memeClair(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Le code saisi ouvre-t-il ce compte ?
 *
 * Accepte les deux formes de stockage, et c'est tout l'intérêt : la migration
 * n'a pas de date butoir, pas de fenêtre de bascule, et aucun compte ne se
 * retrouve dehors parce qu'il n'était pas passé au bon moment.
 */
export async function codeCorrespond(stocke: string, saisi: string): Promise<boolean> {
  if (stocke === CODE_INUTILISABLE) return false;
  if (estHache(stocke)) return bcrypt.compare(saisi, stocke);
  return memeClair(stocke, saisi);
}
