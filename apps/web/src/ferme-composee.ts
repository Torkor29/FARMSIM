/**
 * Toutes ses parcelles, ensemble, autour du siège.
 *
 * Une seule parcelle était « active » : elle seule se dessinait en détail et
 * acceptait les outils, les autres n'étaient qu'un paysage peint. Passer de
 * l'une à l'autre changeait donc ce qu'on voyait — les couleurs, les plantes,
 * la place des choses. « Il faudrait que les parcelles achetées soient
 * actives tout le temps, qu'on puisse planter où on veut. »
 *
 * La vue se dessine maintenant toujours depuis le siège, et chaque parcelle
 * de la même région y est posée à sa case de trame, exactement comme une
 * parcelle réunie. La parcelle « active » ne décide plus de l'affichage :
 * elle dit seulement à quelle parcelle s'adresse le prochain travail, et elle
 * suit le doigt.
 */
import { decalageDansHote, type Quart } from "@farmsim/shared";
import type { EtatConstruction } from "./domaine3d";

export type ParcelleAComposer = {
  id: string;
  mapX: number;
  mapY: number;
  gridW: number;
  gridH: number;
  zone?: { code?: string } | null;
};

/** Une parcelle posée dans le repère du siège. */
export type Morceau = { id: string; dx: number; dy: number; w: number; h: number };

/** Au-delà, la parcelle est trop loin pour tenir dans la même vue. */
export const PORTEE_COMPOSITION = 3;

/**
 * Les parcelles à dessiner avec le siège, et leur décalage.
 *
 * Le siège d'abord, à l'origine. Une parcelle d'une autre région, ou trop
 * loin sur la trame, n'en fait pas partie : on y va comme avant.
 */
export function composerFerme(
  siege: ParcelleAComposer,
  parcelles: readonly ParcelleAComposer[],
  quart: Quart,
  absorbees: ReadonlySet<string> = new Set(),
): Morceau[] {
  const out: Morceau[] = [{ id: siege.id, dx: 0, dy: 0, w: siege.gridW, h: siege.gridH }];
  for (const p of parcelles) {
    if (p.id === siege.id || absorbees.has(p.id)) continue;
    if ((p.zone?.code ?? null) !== (siege.zone?.code ?? null)) continue;
    if (Math.abs(p.mapX - siege.mapX) > PORTEE_COMPOSITION || Math.abs(p.mapY - siege.mapY) > PORTEE_COMPOSITION) continue;
    const { dx, dy } = decalageDansHote(siege, p, quart);
    out.push({ id: p.id, dx, dy, w: p.gridW, h: p.gridH });
  }
  return out;
}

const cle = (x: number, y: number) => `${x},${y}`;

/**
 * Qui possède cette case de la vue ?
 *
 * On lit les cases réelles de chaque parcelle (une parcelle réunie déborde de
 * sa grille), et l'on retombe sur la grille nominale à défaut.
 */
export function proprietaires(
  morceaux: readonly Morceau[],
  casesDe: (id: string) => readonly { x: number; y: number }[] | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of morceaux) {
    const cs = casesDe(p.id);
    if (cs?.length) for (const c of cs) m.set(cle(c.x + p.dx, c.y + p.dy), p.id);
    else for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) m.set(cle(x + p.dx, y + p.dy), p.id);
  }
  return m;
}

/** Une case de la vue, rendue dans le repère de sa parcelle. */
export function versLocal(
  gx: number,
  gy: number,
  morceaux: readonly Morceau[],
  proprio: ReadonlyMap<string, string>,
  parDefaut: string,
): { id: string; x: number; y: number } {
  const id = proprio.get(cle(gx, gy)) ?? parDefaut;
  const m = morceaux.find((p) => p.id === id) ?? { dx: 0, dy: 0 };
  return { id, x: gx - m.dx, y: gy - m.dy };
}

/** Décale une liste de positions (`x`/`y`). */
export function decaler<T extends { x: number; y: number }>(l: readonly T[], dx: number, dy: number): T[] {
  if (!dx && !dy) return l as T[];
  return l.map((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
}

/** Décale une liste d'objets posés par leur coin (`originX`/`originY`). */
export function decalerOrigines<T extends { originX: number; originY: number }>(l: readonly T[], dx: number, dy: number): T[] {
  if (!dx && !dy) return l as T[];
  return l.map((c) => ({ ...c, originX: c.originX + dx, originY: c.originY + dy }));
}

/** L'état du mode construction de la parcelle active, posé dans la vue. */
export function decalerConstruction<E extends EtatConstruction | null>(e: E, dx: number, dy: number): E {
  if (!e || (!dx && !dy)) return e;
  return {
    ...e,
    lots: decaler(e.lots, dx, dy),
    fantome: decaler(e.fantome, dx, dy),
    objetFantome: e.objetFantome ? { ...e.objetFantome, x: e.objetFantome.x + dx, y: e.objetFantome.y + dy } : null,
    selection: e.selection ? { ...e.selection, x: e.selection.x + dx, y: e.selection.y + dy } : null,
    berge: e.berge ? { ...e.berge, x: e.berge.x + dx, y: e.berge.y + dy } : e.berge,
    habitats: e.habitats ? decaler(e.habitats, dx, dy) : e.habitats,
  };
}
