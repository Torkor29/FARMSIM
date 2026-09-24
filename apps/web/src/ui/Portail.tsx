/**
 * Sortir un voile du plateau de jeu, pour que son plan d'affichage compte.
 *
 * ## Le défaut, et pourquoi les z-index ne servaient à rien
 *
 * Signalé plusieurs fois en jeu : « quand t'appuies sur acheter de la paille,
 * la popup s'ouvre derrière », et ce n'était pas propre à ce bouton-là.
 *
 * Pendant une partie, la feuille de style pose ceci :
 *
 * ```css
 * html.playing .game-stage { position: fixed; inset: 0; }
 * ```
 *
 * Or **`position: fixed` crée un contexte d'empilement**, `z-index: auto` ou
 * non. Tout ce qui est rendu à l'intérieur du plateau y est donc enfermé :
 * ses z-index ne se comparent plus qu'entre eux, jamais à ce qui vit dehors.
 *
 * Deux voiles échappaient à la prison parce qu'ils se posaient par portail
 * dans `<body>` — la fenêtre de bureau (`Window`) et la fiche d'engin. Tous
 * les autres restaient dedans. Résultat mesuré dans le navigateur, ordre de
 * peinture réel du dessus vers le fond :
 *
 * ```
 *   .win-backdrop       z-index: 30   ← devant
 *   .tutorial-backdrop  z-index: 50
 *   .market-backdrop    z-index: 40   ← derrière
 * ```
 *
 * Un z-index de 30 passait devant un 50 et un 40. Ce n'est pas une erreur de
 * valeur : c'est que la comparaison n'avait jamais lieu. Aucun réglage de
 * nombre n'aurait pu corriger cela — d'où les tentatives répétées sans effet.
 *
 * ## Ce que ce portail répare
 *
 * Posé dans `<body>`, un voile rejoint le contexte d'empilement racine, où
 * vivent déjà les fenêtres. Les z-index de la feuille de style redeviennent
 * alors ce qu'ils prétendaient être : une échelle commune, lisible en un
 * endroit (voir « L'ÉCHELLE DES PLANS » dans `styles.css`).
 *
 * ## Ce qu'il ne faut pas lui faire dire
 *
 * Il ne rend pas « la dernière fenêtre ouverte devant ». L'ordre reste celui
 * que la feuille de style décide, et c'est voulu : une confirmation doit
 * passer devant ce qu'elle fait confirmer, quel que soit l'ordre des clics.
 */

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Rend `children` dans `<body>` plutôt qu'à sa place dans l'arbre.
 *
 * Sans danger pour la disposition : aucun voile du jeu n'est mis en forme par
 * un sélecteur qui passe par `.game-stage` — vérifié sur toute la feuille de
 * style, et un test le tient. Les règles `.game-stage.mobile .sheet` visent
 * les tiroirs des rails, qui ne sont pas des voiles et ne passent pas ici.
 *
 * Le rendu côté serveur n'existe pas dans ce jeu : `document` est toujours là.
 */
export function Portail({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
