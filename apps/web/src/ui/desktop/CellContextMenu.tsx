/**
 * Menu contextuel d'une case — coque de bureau.
 *
 * Le bouton droit ne servait à rien : `onPointerDown` ne testait jamais
 * `ev.button`, si bien qu'un clic droit glissé déplaçait la caméra **et**
 * laissait s'ouvrir le menu « Enregistrer l'image sous… » du navigateur
 * par-dessus la ferme.
 *
 * Il désigne maintenant une case et propose ce qu'on peut en faire — le geste
 * que tout joueur de jeu de gestion essaie en premier.
 */

import { useEffect, useRef } from "react";

export type CellContextItem = {
  label: string;
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  onPick: () => void;
};

export type CellContext = {
  cell: { x: number; y: number };
  screen: { x: number; y: number };
  title: string;
  items: CellContextItem[];
};

type Props = {
  context: CellContext | null;
  onClose: () => void;
};

/** Marge pour qu'un menu ouvert près d'un bord reste entièrement visible. */
const EDGE = 12;
const MENU_W = 232;

export function CellContextMenu({ context, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!context) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // `mousedown` et non `click` : sinon le relâchement du clic droit qui a
    // ouvert le menu le referme aussitôt.
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [context, onClose]);

  if (!context) return null;

  // Un menu ouvert au ras du bord droit ou bas sortait de l'écran : on le
  // rabat, comme le fait n'importe quel menu natif.
  const maxX = window.innerWidth - MENU_W - EDGE;
  const height = 52 + context.items.length * 38;
  const maxY = window.innerHeight - height - EDGE;
  const left = Math.max(EDGE, Math.min(context.screen.x, maxX));
  const top = Math.max(EDGE, Math.min(context.screen.y, maxY));

  return (
    <div
      ref={ref}
      className="cell-menu"
      role="menu"
      aria-label={context.title}
      style={{ left, top, width: MENU_W }}
    >
      <p className="cell-menu-head">{context.title}</p>
      {context.items.map((it) => (
        <button
          key={it.label}
          type="button"
          role="menuitem"
          className={`cell-menu-item${it.danger ? " danger" : ""}`}
          disabled={it.disabled}
          title={it.hint}
          onClick={() => {
            it.onPick();
            onClose();
          }}
        >
          <span>{it.label}</span>
          {it.hint && <small>{it.hint}</small>}
        </button>
      ))}
    </div>
  );
}
