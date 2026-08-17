/**
 * Sélection rectangulaire : coin A, coin B, toutes les cases entre les deux.
 *
 * Le tracé au doigt suivait le chemin du geste — un serpent irrégulier. Pour
 * semer ou moissonner un champ, le geste naturel est un clic, un glissé, et
 * un carré de la taille qu'on veut.
 */

export type GridCell = { x: number; y: number };

/** Toutes les cases du rectangle aligné sur la grille, borné à `gw` × `gh`. */
export function rectCells(a: GridCell, b: GridCell, gw: number, gh: number): GridCell[] {
  if (gw <= 0 || gh <= 0) return [];
  const x0 = Math.max(0, Math.min(a.x, b.x));
  const x1 = Math.min(gw - 1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y));
  const y1 = Math.min(gh - 1, Math.max(a.y, b.y));
  if (x1 < x0 || y1 < y0) return [];
  const out: GridCell[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) out.push({ x, y });
  }
  return out;
}

/** Largeur × hauteur du rectangle englobant, pour le toast « 4×3 · 12 cases ». */
export function rectFootprint(cells: GridCell[]): { w: number; h: number } {
  if (!cells.length) return { w: 0, h: 0 };
  let minX = cells[0].x;
  let maxX = cells[0].x;
  let minY = cells[0].y;
  let maxY = cells[0].y;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1 };
}
