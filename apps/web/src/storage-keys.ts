/**
 * Clés de stockage local, hors de tout module de composant.
 *
 * React Fast Refresh n'applique une mise à jour à chaud sans réexécuter le
 * module que si celui-ci n'exporte **que** des composants. Une constante
 * exportée depuis un fichier de composant fait échouer cette optimisation :
 * le module entier est réévalué, et un import qui pointait dessus peut se
 * retrouver momentanément indéfini. C'est ce qui produisait des
 * « X is not defined » fantômes en développement.
 */

/** Jeton de session du joueur. */
export const TOKEN_KEY = "farmsim_token";

/** Marque le tutoriel comme déjà vu. */
export const TUTORIAL_KEY = "farmsim_tutorial_v1";
