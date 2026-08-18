/**
 * Les glyphes des alertes d'élevage.
 *
 * Ils étaient des emoji — 💀, 🌾, 🧹, 💩. Trois raisons de les remplacer, dans
 * l'ordre d'importance :
 *
 * 1. **Ils ne sont pas dessinés par nous.** Leur trait vient de la fonte du
 *    système : rond et brillant sur iPhone, plat sur Android, dessiné à la
 *    main sur Windows. Le seul endroit du jeu dont l'apparence nous échappe.
 * 2. **Ils ignorent la palette.** Un 💩 marron et un 🥛 blanc à côté d'un
 *    bandeau sarcelle : trois familles de couleur sur une ligne de 40 pixels.
 * 3. **C'est le signal le plus lisible d'une interface non dessinée.** Un
 *    emoji en guise d'icône dit « on a pris le premier caractère qui
 *    ressemblait ».
 *
 * Ceux-ci sont tracés en `currentColor` : ils prennent donc la couleur de la
 * gravité de l'alerte — rouge pour un danger, or pour un avertissement,
 * sarcelle pour une information — sans qu'aucune règle ne le répète.
 *
 * Le trait est volontairement épais (2 px sur 24) : à 18 pixels de côté sur un
 * téléphone, un trait fin disparaît.
 */

import type { ReactNode } from "react";
import type { HerdAlertIcon } from "./herd-alerts";

const TRACES: Record<HerdAlertIcon, ReactNode> = {
  /** Tête de bête tombée — le lot perd des animaux. */
  risque: (
    <>
      <path d="M12 3.5 21 19H3z" />
      <path d="M12 10v4" />
      <path d="M12 16.6v.2" />
    </>
  ),
  /** Épi : la ration. */
  ration: (
    <>
      <path d="M12 21V9" />
      <path d="M12 9c0-3 1.6-5 4-6 .4 2.6-.6 5-4 6z" />
      <path d="M12 14c0-2.6 1.4-4.4 3.5-5.2.3 2.2-.6 4.3-3.5 5.2z" />
      <path d="M12 9C12 6 10.4 4 8 3c-.4 2.6.6 5 4 6z" />
      <path d="M12 14c0-2.6-1.4-4.4-3.5-5.2-.3 2.2.6 4.3 3.5 5.2z" />
    </>
  ),
  /** Flocon : le froid mord. */
  froid: (
    <>
      <path d="M12 2.5v19" />
      <path d="m3.8 7.2 16.4 9.6" />
      <path d="m20.2 7.2-16.4 9.6" />
      <path d="m8.6 4.6 3.4 2 3.4-2" />
      <path d="m8.6 19.4 3.4-2 3.4 2" />
    </>
  ),
  /** Soleil haut : la chaleur pèse. */
  chaud: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2" />
      <path d="m5.4 5.4 1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6" />
    </>
  ),
  /** Brins d'herbe : le pré s'épuise. */
  pre: (
    <>
      <path d="M4 20h16" />
      <path d="M8 20c0-4 -1-6.5 -3-8 2.6.4 4 3 4 8z" />
      <path d="M12 20c0-5.5 1-8.5 3.5-10.5C15.2 15 14 18 12 20z" />
      <path d="M16 20c0-3 .8-5 2.6-6.4-.2 3.4-1 5.4-2.6 6.4z" />
    </>
  ),
  /** Bottes empilées : la litière. */
  litiere: (
    <>
      <rect x="3" y="13" width="8" height="7" rx="1" />
      <rect x="13" y="13" width="8" height="7" rx="1" />
      <rect x="8" y="5" width="8" height="7" rx="1" />
      <path d="M3 16.5h8M13 16.5h8M8 8.5h8" />
    </>
  ),
  /** Cuve : la fosse à lisier. */
  fosse: (
    <>
      <path d="M4.5 8h15l-1.3 11.2a1.5 1.5 0 0 1-1.5 1.3H7.3a1.5 1.5 0 0 1-1.5-1.3z" />
      <path d="M3 8h18" />
      <path d="M9 4.5h6" />
      <path d="M6.6 14.5c1.8-1.2 3.6-1.2 5.4 0s3.6 1.2 5.4 0" />
    </>
  ),
  /** Seau : la traite, les œufs, la tonte — ce qui attend d'être ramassé. */
  recolte: (
    <>
      <path d="M5 8h14l-1.4 11.4a1.4 1.4 0 0 1-1.4 1.1H7.8a1.4 1.4 0 0 1-1.4-1.1z" />
      <path d="M3.5 8h17" />
      <path d="M8 8a4 4 0 0 1 8 0" />
    </>
  ),
};

export function AlertIcon({ name }: { name: HerdAlertIcon }) {
  return (
    <svg
      className="herd-alert-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRACES[name]}
    </svg>
  );
}
