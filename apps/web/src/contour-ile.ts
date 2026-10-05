/**
 * Le contour d'une île de forme quelconque.
 *
 * L'île était un rectangle : une dalle, une haie à quatre pans. Depuis qu'on
 * réunit des parcelles, elle peut prendre une forme en L, en T, en grand
 * carré de neuf parcelles — et une dalle rectangulaire déborderait alors sur
 * le champ du voisin qui occupe l'encoche. Ce module découpe les cases
 * possédées en rectangles (la dalle) et en suit le bord (la haie).
 *
 * Tout se compte en **bords de case** : la case `(x, y)` occupe le carré
 * `[x, x + 1] × [y, y + 1]`. La vue convertit ensuite en coordonnées monde.
 */

export type RectCases = { x0: number; y0: number; x1: number; y1: number };

/**
 * Les cases en rectangles, bornes incluses.
 *
 * Gloutonnement : les plages de chaque rangée, puis les plages identiques de
 * rangées consécutives fusionnées. Une parcelle seule donne un rectangle,
 * deux parcelles réunies trois (les deux champs et leur chemin), un carré de
 * neuf parcelles une poignée — assez peu pour une dalle chacun.
 */
export function rectanglesDeCases(cells: readonly { x: number; y: number }[]): RectCases[] {
  const parRang = new Map<number, number[]>();
  for (const c of cells) {
    const r = parRang.get(c.y);
    if (r) r.push(c.x);
    else parRang.set(c.y, [c.x]);
  }
  const rangs = [...parRang.keys()].sort((a, b) => a - b);
  const ouverts = new Map<string, RectCases>();
  const fermes: RectCases[] = [];
  let precedent: number | null = null;
  for (const y of rangs) {
    const xs = [...new Set(parRang.get(y)!)].sort((a, b) => a - b);
    const plages: [number, number][] = [];
    for (const x of xs) {
      const der = plages[plages.length - 1];
      if (der && der[1] === x - 1) der[1] = x;
      else plages.push([x, x]);
    }
    const suivants = new Map<string, RectCases>();
    for (const [x0, x1] of plages) {
      const cle = `${x0}:${x1}`;
      const r = precedent === y - 1 ? ouverts.get(cle) : undefined;
      if (r) {
        r.y1 = y;
        suivants.set(cle, r);
        ouverts.delete(cle);
      } else {
        suivants.set(cle, { x0, x1, y0: y, y1: y });
      }
    }
    for (const r of ouverts.values()) fermes.push(r);
    ouverts.clear();
    for (const [k, r] of suivants) ouverts.set(k, r);
    precedent = y;
  }
  for (const r of ouverts.values()) fermes.push(r);
  return fermes;
}

/**
 * Un pan de haie : un segment du bord, déjà écarté de la terre.
 *
 * `axe` dit le long de quoi il court ; `normale` de quel côté est le dehors
 * (+1 ou −1 sur l'autre axe). Les extrémités sont en bords de case, décalées
 * de `ecart` : prolongées à un coin saillant, raccourcies à un coin rentrant,
 * pour que deux pans se rejoignent sans se croiser ni laisser de trou.
 */
export type PanDeHaie = {
  axe: "x" | "y";
  /** La position du pan sur l'autre axe, écart compris. */
  a: number;
  /** De `debut` à `fin` le long de l'axe, `debut < fin`. */
  debut: number;
  fin: number;
  normale: 1 | -1;
};

/**
 * Le bord des cases, en pans de haie écartés de `ecart` (en cases).
 *
 * Chaque côté de case sans voisine est un bout de bord ; les bouts alignés et
 * contigus se fondent en un pan. Les trous (une case non possédée au milieu)
 * ont leur haie aussi : c'est un vrai bord.
 */
export function pansDeHaie(cells: readonly { x: number; y: number }[], ecart: number): PanDeHaie[] {
  const a = new Set(cells.map((c) => `${c.x},${c.y}`));
  const dedans = (x: number, y: number) => a.has(`${x},${y}`);
  // Les bouts de bord, regroupés par ligne : clé `axe:position:normale`.
  const lignes = new Map<string, number[]>();
  const ajouter = (axe: "x" | "y", pos: number, normale: 1 | -1, t: number) => {
    const k = `${axe}:${pos}:${normale}`;
    const l = lignes.get(k);
    if (l) l.push(t);
    else lignes.set(k, [t]);
  };
  for (const c of cells) {
    if (!dedans(c.x, c.y - 1)) ajouter("x", c.y, -1, c.x);
    if (!dedans(c.x, c.y + 1)) ajouter("x", c.y + 1, 1, c.x);
    if (!dedans(c.x - 1, c.y)) ajouter("y", c.x, -1, c.y);
    if (!dedans(c.x + 1, c.y)) ajouter("y", c.x + 1, 1, c.y);
  }
  // Les pans bruts : bouts contigus d'une même ligne.
  type Brut = { axe: "x" | "y"; pos: number; normale: 1 | -1; debut: number; fin: number };
  const bruts: Brut[] = [];
  for (const [k, ts] of lignes) {
    const [axe, p, n] = k.split(":");
    const pos = Number(p);
    const normale = Number(n) as 1 | -1;
    const tri = [...new Set(ts)].sort((u, v) => u - v);
    let debut = tri[0]!;
    let fin = debut + 1;
    for (let i = 1; i < tri.length; i++) {
      if (tri[i] === fin) fin++;
      else {
        bruts.push({ axe: axe as "x" | "y", pos, normale, debut, fin });
        debut = tri[i]!;
        fin = debut + 1;
      }
    }
    bruts.push({ axe: axe as "x" | "y", pos, normale, debut, fin });
  }
  /*
   * Saillant ou rentrant, à chaque bout.
   *
   * Au coin, le pan perpendiculaire qui part du même sommet a sa normale
   * tournée vers l'extérieur : si elle pointe dans le sens où notre pan
   * continuerait, le coin est saillant — on prolonge ; sinon il est rentrant
   * — on raccourcit.
   */
  const sommets = new Map<string, Brut[]>();
  const cleSommet = (b: Brut, t: number) => (b.axe === "x" ? `${t},${b.pos}` : `${b.pos},${t}`);
  for (const b of bruts) {
    for (const t of [b.debut, b.fin]) {
      const k = cleSommet(b, t);
      const l = sommets.get(k);
      if (l) l.push(b);
      else sommets.set(k, [b]);
    }
  }
  const prolonge = (b: Brut, t: number, sens: 1 | -1): number => {
    const autres = (sommets.get(cleSommet(b, t)) ?? []).filter((o) => o.axe !== b.axe);
    if (!autres.length) return 0;
    // Deux pans perpendiculaires au même sommet : un coin en pointe (deux
    // cases qui ne se touchent que par l'angle). On prolonge.
    const n = autres.some((o) => o.normale === sens);
    return n ? ecart : -ecart;
  };
  return bruts.map((b) => ({
    axe: b.axe,
    a: b.pos + b.normale * ecart,
    debut: b.debut - prolonge(b, b.debut, -1),
    fin: b.fin + prolonge(b, b.fin, 1),
    normale: b.normale,
  }));
}
