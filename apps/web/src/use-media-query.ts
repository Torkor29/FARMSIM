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
 * Il porte sur la largeur seule, pas sur le pointeur : une tablette au doigt
 * comme une fenêtre de bureau étroite ont le même problème de place, et un
 * téléphone en paysage repasse volontairement en disposition large.
 */
export const MOBILE_QUERY = "(max-width: 820px)";

export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
