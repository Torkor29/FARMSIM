/**
 * Fenêtre de bureau — pour les panneaux qui ne tiennent pas dans un rail.
 *
 * Mesuré sur le jeu en marche : rail Missions ouvert, **8 303 px de contenu
 * empilés dans une colonne de 304 px de large et 811 px de haut**, pendant
 * que 1 296 px de ciel restaient vides au centre. Dix écrans de défilement
 * par une paille, sur un écran qui avait la place de tout montrer.
 *
 * Le panneau Bureau du jeu prouvait déjà qu'on savait faire autrement —
 * onglets, colonne de catégories, recherche, tableau, volet de détail. Cette
 * fenêtre généralise ce patron aux autres panneaux lourds.
 *
 * Elle apporte aussi ce que les rails n'avaient pas :
 *
 * - `Échap` ferme, comme partout ailleurs (bug B-06 de l'audit : `Échap`
 *   fermait le Bureau et les modales, mais laissait Garage et Élevage
 *   ouverts) ;
 * - le focus est piégé tant qu'elle est ouverte, et rendu à son point de
 *   départ à la fermeture ;
 * - un clic hors du cadre referme, comme le voile du téléphone.
 */

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  title: string;
  /** Ce qui se lit sous le titre : « 18 bêtes · 3 alertes ». */
  subtitle?: string;
  /** Largeur voulue ; la fenêtre ne dépasse jamais l'écran. */
  width?: "wide" | "regular";
  onClose: () => void;
  children: ReactNode;
};

export function Window({ open, title, subtitle, width = "regular", onClose, children }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Piège à focus : sans lui, la tabulation sort de la fenêtre et va
      // promener le curseur dans la ferme derrière, qu'on ne voit plus.
      const cibles = boxRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!cibles?.length) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Rendre le focus d'où il venait : sinon il retombe sur le corps de la
      // page et la touche suivante ne va nulle part.
      returnFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="win-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={boxRef}
        className={`win ${width}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Le clic à l'intérieur ne doit pas remonter jusqu'au voile.
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="win-head">
          <div className="win-title">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="win-close" onClick={onClose} title="Fermer (Échap)">
            Fermer <kbd>Échap</kbd>
          </button>
        </header>
        <div className="win-body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Un panneau : tiroir au doigt, fenêtre à la souris.
 *
 * Le même contenu, deux contenants. Au téléphone il reste dans le rail — qui
 * s'y efface en `display: contents` et le rend en tiroir, mécanisme qui
 * marchait déjà. Sur bureau il sort dans une fenêtre large, parce qu'une
 * colonne de 304 px ne peut pas montrer huit mille pixels de contenu.
 */
export function PanelHost({
  mobile,
  open,
  title,
  subtitle,
  width,
  onClose,
  children,
}: Props & { mobile: boolean }) {
  if (mobile) return <>{children}</>;
  return (
    <Window open={open} title={title} subtitle={subtitle} width={width} onClose={onClose}>
      {children}
    </Window>
  );
}
