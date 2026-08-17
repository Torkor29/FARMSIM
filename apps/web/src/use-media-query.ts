import { useEffect, useState } from "react";

/**
 * Suit une requête média et rerend quand elle bascule.
 *
 * On lit la valeur dès l'initialisation plutôt qu'après le premier rendu :
 * une coque de bureau affichée un instant sur un téléphone, puis remplacée,
 * se voit — panneaux qui sautent, barre qui se réorganise.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Seuil de la coque mobile.
 *
 * Il porte sur la place disponible, pas sur le pointeur : une tablette au
 * doigt comme une fenêtre de bureau étroite ont le même problème.
 *
 * La seconde condition est arrivée après mesure. Un téléphone couché fait
 * 844 × 390 : plus large que 820, il recevait donc la coque de bureau — un
 * rail vertical de seize boutons dans 390 px de hauteur, dont huit tombaient
 * hors champ. « Repasser en disposition large » n'a de sens que si la hauteur
 * suit, ce qui n'est jamais le cas d'un téléphone couché. Le plafond de
 * largeur évite d'attraper un vrai écran de bureau très court.
 */
export const MOBILE_QUERY =
  "(max-width: 820px), (max-height: 500px) and (max-width: 1100px)";

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
