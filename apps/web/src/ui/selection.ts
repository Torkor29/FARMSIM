/**
 * Modèle de sélection de cases.
 *
 * Deux choses manquaient au jeu, et elles se tiennent :
 *
 * 1. **Un contrat de bureau.** `ctrlKey`, `shiftKey` et `altKey` n'apparaissaient
 *    nulle part dans le projet. Un tracé ne savait qu'**ajouter** : rien ne
 *    permettait de retirer une case, et il fallait cliquer chaque case une par
 *    une pour défaire une sélection de trente.
 *
 * 2. **Un coût raisonnable.** La sélection était un tableau parcouru
 *    linéairement à l'intérieur d'une boucle sur les cases entrantes : fusionner
 *    un tracé de n cases dans une sélection de m coûtait O(n·m). Ici tout passe
 *    par un `Set` de clés `"x,y"`, et l'ordre d'insertion est conservé — c'est
 *    lui qui donne à l'engin de chantier son va-et-vient naturel.
 *
 * Le mode par défaut dépend du **pointeur**, pas de la largeur d'écran :
 * au doigt un tracé s'ajoute (on ne peut pas tenir Ctrl), à la souris il
 * remplace, comme dans n'importe quel logiciel de bureau. C'est la première
 * application concrète du principe « PC et mobile ne partagent pas leurs
 * gestes, seulement leurs données ».
 */

export type Cell = { x: number; y: number };

/** Ce que fait un geste vis-à-vis de la sélection déjà en place. */
export type SelectMode = "replace" | "add" | "remove" | "toggle";

export type PointerMods = {
  mode: SelectMode;
  /** Maj enfoncé : étendre en rectangle depuis la dernière case posée. */
  extend: boolean;
};

export const DEFAULT_MODS: PointerMods = { mode: "replace", extend: false };

/** Mods d'un geste tactile : additif, comme avant — rien ne doit changer au doigt. */
export const TOUCH_MODS: PointerMods = { mode: "add", extend: false };

export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

/**
 * Lit les modificateurs d'un événement.
 *
 * `metaKey` compte comme `ctrlKey` : sur un Mac, la convention d'ajout est
 * Cmd, et un joueur qui tient Cmd s'attend au même résultat qu'un joueur qui
 * tient Ctrl ailleurs.
 */
export function readMods(
  ev: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  touch: boolean,
): PointerMods {
  if (touch) return TOUCH_MODS;
  if (ev.altKey) return { mode: "remove", extend: false };
  if (ev.ctrlKey || ev.metaKey) return { mode: "toggle", extend: ev.shiftKey };
  if (ev.shiftKey) return { mode: "add", extend: true };
  return { mode: "replace", extend: false };
}

/**
 * Applique un lot de cases à une sélection.
 *
 * `replace` renvoie le lot tel quel ; `add` en fait l'union ; `remove` la
 * différence ; `toggle` bascule case par case — c'est le comportement attendu
 * d'un Ctrl+clic, et il vaut aussi pour un Ctrl+tracé, où chaque case
 * traversée bascule une fois et une seule.
 */
export function applySelection(prev: Cell[], incoming: Cell[], mode: SelectMode): Cell[] {
  if (mode === "replace") return dedupe(incoming);
  if (mode === "remove") {
    const gone = new Set(incoming.map(cellKey));
    return prev.filter((c) => !gone.has(cellKey(c)));
  }
  if (mode === "add") {
    const seen = new Set(prev.map(cellKey));
    const out = prev.slice();
    for (const c of dedupe(incoming)) {
      const k = cellKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  }
  // toggle
  const had = new Set(prev.map(cellKey));
  const touched = new Set(dedupe(incoming).map(cellKey));
  const out = prev.filter((c) => !touched.has(cellKey(c)));
  for (const c of dedupe(incoming)) {
    if (!had.has(cellKey(c))) out.push(c);
  }
  return out;
}

/** Retire les doublons en gardant le premier passage. */
export function dedupe(cells: Cell[]): Cell[] {
  const seen = new Set<string>();
  const out: Cell[] = [];
  for (const c of cells) {
    const k = cellKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

/** Rectangle plein entre deux coins, bornes comprises, borné à la grille. */
export function rectBetween(a: Cell, b: Cell, gridW: number, gridH: number): Cell[] {
  const x0 = Math.max(0, Math.min(a.x, b.x));
  const x1 = Math.min(gridW - 1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const y1 = Math.min(gridH - 1, Math.max(a.y, b.y));
  const out: Cell[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.push({ x, y });
  }
  return out;
}

/** Le pinceau appliqué à une case : un carré n×n borné à la grille. */
export function brushBlock(c: Cell, brush: number, gridW: number, gridH: number): Cell[] {
  const out: Cell[] = [];
  for (let dy = 0; dy < brush; dy++) {
    for (let dx = 0; dx < brush; dx++) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (x >= 0 && y >= 0 && x < gridW && y < gridH) out.push({ x, y });
    }
  }
  return out;
}

/** Le pinceau étalé sur tout un lot, sans doublon. */
export function expandBrush(cells: Cell[], brush: number, gridW: number, gridH: number): Cell[] {
  if (brush <= 1) return dedupe(cells);
  const out: Cell[] = [];
  for (const c of cells) out.push(...brushBlock(c, brush, gridW, gridH));
  return dedupe(out);
}

export function isSelected(selection: Cell[], c: Cell): boolean {
  const k = cellKey(c);
  return selection.some((s) => cellKey(s) === k);
}
