/**
 * Le code de secours — retrouver sa ferme sans e-mail.
 *
 * Le serveur du jeu n'a **aucun envoi de courrier** : pas de SMTP, pas de
 * service tiers, rien. Un « mot de passe oublié » classique — on vous envoie
 * un lien — ne peut donc pas exister ici. Poser le bouton quand même, en
 * espérant brancher l'envoi plus tard, revient à promettre au joueur un
 * secours qui n'arrivera jamais.
 *
 * D'où ce choix : un **code de secours** remis une seule fois, à la création
 * du compte, que le joueur note. Il ne remplace pas le code d'accès, il ne
 * connecte pas : il sert uniquement à en choisir un nouveau. C'est le même
 * mécanisme que les codes de récupération d'une double authentification, pour
 * la même raison — il fonctionne hors ligne.
 *
 * Ce module ne contient que la **forme** du code : l'alphabet, la lecture
 * indulgente de ce qui est tapé, l'affichage. Le tirage au sort et
 * l'empreinte restent côté serveur, seul endroit qui dispose d'un vrai
 * générateur cryptographique.
 */

/**
 * Alphabet de Crockford : 32 symboles sans `I`, `L`, `O` ni `U`.
 *
 * Les trois premiers se confondent avec `1` et `0` sur un bout de papier ;
 * le quatrième est écarté pour qu'aucun tirage ne compose un mot déplaisant.
 * Trente-deux symboles, c'est exactement cinq bits : un octet tiré au hasard
 * donne un symbole sans biais (256 est un multiple de 32), là où un alphabet
 * de 26 ou 33 lettres favoriserait discrètement les premières.
 */
export const RECOVERY_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Longueur du code, en symboles. 16 × 5 bits = 80 bits d'entropie. */
export const RECOVERY_LEN = 16;

/** Taille des groupes à l'affichage : `A1B2-C3D4-…`. */
export const RECOVERY_GROUP = 4;

/**
 * Ce que le joueur tape à la place de ce qu'il a lu.
 *
 * Un code recopié à la main sur un carnet revient avec des `O` pour des
 * zéros et des `l` pour des uns. L'alphabet ayant justement écarté ces
 * lettres, la correspondance est sans ambiguïté : aucun code authentique ne
 * contient de `O`, donc un `O` tapé ne peut vouloir dire que `0`.
 */
const CONFUSIONS: Record<string, string> = { O: "0", I: "1", L: "1" };

/**
 * Ramène ce qui a été saisi à la forme canonique : majuscules, sans
 * séparateur, look-alikes redressés, tout le reste jeté.
 *
 * Jeter plutôt que refuser est délibéré : espaces, tirets, points, retours à
 * la ligne d'un copier-coller — rien de tout cela ne doit valoir un « code
 * incorrect » au joueur qui a pourtant le bon code sous les yeux.
 */
export function normalizeRecovery(input: string): string {
  let out = "";
  for (const brut of input.toUpperCase()) {
    const c = CONFUSIONS[brut] ?? brut;
    if (RECOVERY_ALPHABET.includes(c)) out += c;
  }
  return out;
}

/** Le code a-t-il la bonne forme ? Ne dit rien de sa justesse. */
export function isRecoveryCode(input: string): boolean {
  return normalizeRecovery(input).length === RECOVERY_LEN;
}

/** Découpe en groupes lisibles pour l'affichage et le recopiage. */
export function formatRecovery(code: string): string {
  const net = normalizeRecovery(code);
  const groupes: string[] = [];
  for (let i = 0; i < net.length; i += RECOVERY_GROUP) {
    groupes.push(net.slice(i, i + RECOVERY_GROUP));
  }
  return groupes.join("-");
}

/**
 * Fabrique un code à partir d'octets tirés au sort.
 *
 * Les octets viennent du serveur (`crypto.randomBytes`) : cette fonction ne
 * tire rien elle-même, ce qui la rend vérifiable — on lui donne des octets
 * connus, on attend un code connu. Le `& 31` ne perd rien puisque 256 est un
 * multiple de 32.
 */
export function recoveryFromBytes(bytes: ArrayLike<number>): string {
  if (bytes.length < RECOVERY_LEN) {
    throw new Error(`Il faut au moins ${RECOVERY_LEN} octets pour un code de secours`);
  }
  let out = "";
  for (let i = 0; i < RECOVERY_LEN; i += 1) {
    out += RECOVERY_ALPHABET[bytes[i] & 31];
  }
  return out;
}

/** Phrase unique, pour que la consigne soit la même partout où on la donne. */
export const RECOVERY_HELP =
  "Notez ce code de secours et gardez-le hors du jeu : c'est le seul moyen de " +
  "retrouver votre ferme si vous oubliez votre code d'accès. Il ne sera plus " +
  "jamais affiché.";

/**
 * Refus volontairement muet.
 *
 * Répondre « cette adresse n'existe pas » transformerait l'écran d'oubli en
 * annuaire : on essaie mille adresses, on apprend lesquelles jouent. Un seul
 * message couvre donc l'adresse inconnue et le mauvais code.
 */
export const RECOVERY_REFUSAL = "Adresse ou code de secours incorrect.";
