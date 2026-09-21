/**
 * Le lien de réinitialisation — « mot de passe oublié » par courriel.
 *
 * ## Ce qu'on ne fera jamais
 *
 * La demande, telle qu'elle est arrivée, était de « recevoir son mot de passe
 * sur son adresse mail ». C'est impossible, et c'est une bonne nouvelle : le
 * serveur ne détient pas le mot de passe, seulement une empreinte bcrypt qui
 * ne se remonte pas. Tout service capable de vous renvoyer votre mot de passe
 * est un service qui le stocke lisible — exactement le défaut qu'un joueur
 * avait signalé ici en écrivant « c'est censé être crypté, et illisible ».
 *
 * Ce qui s'envoie, c'est donc un **lien à usage unique** qui ouvre le droit
 * d'en choisir un nouveau. Le courriel ne contient aucun secret durable : le
 * jeton meurt en trente minutes, et à la première utilisation.
 *
 * ## Ce que ce module contient, et ce qu'il ne contient pas
 *
 * Seulement la **forme** : la durée de vie, la longueur, la reconnaissance
 * d'un jeton bien formé. Le tirage au sort et l'empreinte restent côté
 * serveur, seul endroit qui ait un vrai générateur cryptographique — même
 * partage que pour le code de secours.
 *
 * Le client en a besoin pour une raison précise : la page qui reçoit le lien
 * doit pouvoir dire « ce lien n'est pas valide » sans faire un aller-retour
 * réseau, et surtout sans envoyer au serveur ce qui ressemble à un jeton
 * ramassé n'importe où.
 */

/**
 * Durée de vie d'un lien, en millisecondes.
 *
 * Trente minutes. C'est le compromis habituel, et les deux bornes sont
 * réelles : plus court, le joueur qui relève ses courriels sur son téléphone
 * en rentrant trouve un lien mort ; plus long, un message qui traîne dans une
 * boîte mal fermée reste une clé de la ferme.
 */
export const REINIT_TTL_MS = 30 * 60 * 1000;

/** La durée, dite en français, pour l'écran et le courriel. */
export const REINIT_TTL_LIBELLE = "trente minutes";

/**
 * Longueur du jeton, en caractères base64url.
 *
 * 43 caractères, c'est 32 octets tirés au sort — 256 bits. Très au-delà de ce
 * qu'exige un secret qui vit trente minutes, mais le surcoût est nul et cela
 * retire définitivement la question du calcul.
 */
export const REINIT_JETON_LEN = 43;

/**
 * Le paramètre qui porte le jeton dans l'adresse du lien.
 *
 * Nommé ici plutôt qu'écrit en dur des deux côtés : le serveur compose le
 * lien, le client le lit, et les deux doivent employer le même mot.
 */
export const REINIT_PARAM = "jeton";

/** Le chemin de la page qui reçoit le lien. */
export const REINIT_CHEMIN = "/reinitialiser";

/**
 * Ce jeton a-t-il la forme attendue ?
 *
 * Une vérification de forme, pas de validité : seul le serveur sait si le
 * jeton existe, s'il a expiré et s'il a déjà servi. Elle sert à refuser tout
 * de suite ce qui ne peut pas être un jeton — une adresse tronquée par un
 * client de messagerie, un copier-coller de travers — plutôt que d'envoyer au
 * serveur des chaînes ramassées n'importe où.
 */
export function jetonDeReinitValide(jeton: string): boolean {
  return jeton.length === REINIT_JETON_LEN && /^[A-Za-z0-9_-]+$/.test(jeton);
}

/**
 * L'adresse complète du lien, telle qu'elle part dans le courriel.
 *
 * `base` est l'origine publique du jeu, sans barre oblique finale.
 */
export function lienDeReinit(base: string, jeton: string): string {
  const origine = base.replace(/\/+$/, "");
  return `${origine}${REINIT_CHEMIN}?${REINIT_PARAM}=${encodeURIComponent(jeton)}`;
}

/**
 * Ce que le joueur lit après avoir demandé un lien — quoi qu'il arrive.
 *
 * **La même phrase pour une adresse connue et pour une adresse inconnue.**
 * C'est la règle qui empêche l'écran de devenir un annuaire : sans elle,
 * n'importe qui essaie une adresse et sait, à la réponse, si elle joue. La
 * route `/auth/recover` applique déjà ce principe pour le code de secours ;
 * celle-ci ne peut pas faire moins, puisqu'elle prend une adresse seule.
 */
export const REINIT_ENVOYE =
  "Si un compte existe avec cette adresse, un lien vient d'y être envoyé. " +
  `Il est valable ${REINIT_TTL_LIBELLE}. Pensez à regarder vos indésirables.`;

/** Ce que le joueur lit quand le lien ne vaut plus rien. */
export const REINIT_REFUS =
  "Ce lien n'est plus valable — il a expiré, ou il a déjà servi. " +
  "Demandez-en un nouveau depuis l'écran de connexion.";
