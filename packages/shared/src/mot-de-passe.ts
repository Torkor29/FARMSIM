/**
 * La règle du mot de passe, écrite une seule fois.
 *
 * Le serveur la fait respecter — c'est lui qui compte —, mais l'écran doit
 * dire la même chose, sinon le joueur découvre le plancher au moment du refus.
 * Deux nombres écrits chacun de son côté finissent toujours par diverger : ils
 * vivent donc ici, dans le paquet que les deux importent.
 */

/**
 * Longueur minimale d'un mot de passe.
 *
 * Trois signes étaient acceptés — un code de casier, pas un mot de passe. Le
 * plancher ne s'applique qu'à l'inscription, au changement et à la
 * récupération : la **connexion** accepte ce qui existe déjà, sans quoi les
 * comptes d'avant se retrouveraient dehors du jour au lendemain.
 */
export const MDP_MIN = 8;

/**
 * Longueur maximale.
 *
 * Ce n'est pas une politique de sécurité, c'est la limite de bcrypt : il ne
 * lit que les 72 premiers **octets** et ignore le reste en silence. On compte
 * ici les caractères, comme le schéma du serveur, pour que les deux côtés
 * refusent exactement la même saisie ; un mot de 72 caractères accentués
 * dépasserait les 72 octets et serait rogné, ce qui lui laisse encore bien
 * plus d'entropie qu'aucune attaque n'en franchit.
 */
export const MDP_MAX = 72;

/** Ce qu'on affiche sous le champ, partout pareil. */
export const MDP_AIDE = `Au moins ${MDP_MIN} caractères. Notez-le : il n'y a pas d'envoi d'e-mail sur ce serveur.`;

/** Vrai si le mot de passe peut être posé sur un compte. */
export function motDePasseValide(mdp: string): boolean {
  return mdp.length >= MDP_MIN && mdp.length <= MDP_MAX;
}
