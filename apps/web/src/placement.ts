/**
 * L'occupation du sol : qui prend quelle place, et qui n'a pas le droit de
 * mordre sur qui.
 *
 * Les décors se posaient chacun avec son propre test, à sa propre taille :
 * un arbre était « un rond de 0,9 » quelle que soit sa couronne, une touffe ne
 * regardait pas les buissons, les arbres des coins de la haie ne regardaient
 * rien du tout. Résultat : un arbre au milieu du bitume du parking, des
 * buissons fondus l'un dans l'autre.
 *
 * Ici chaque objet déclare sa **forme au sol** (un cercle ou une boîte) et
 * son **genre** ; une table de règles dit quels genres ne se chevauchent
 * pas. Le même module sert :
 * - à **placer** (`Occupation.libre` avant de poser) ;
 * - à **contrôler** (`conflits`) — les tests le passent sur des campagnes
 *   entières et exigent zéro conflit.
 *
 * Tout est dans le repère du monde, au sol (x, z). Module pur.
 */

export type Forme =
  | { type: "cercle"; x: number; z: number; r: number }
  | { type: "boite"; x: number; z: number; w: number; d: number };

export type Genre =
  /** Ce qui est dur et plat : on n'y plante rien. */
  | "route"
  | "chemin"
  | "cour"
  | "ile"
  | "parcelle"
  | "batiment"
  | "eau"
  /** Le pied d'un arbre : tronc et racines. */
  | "tronc"
  /** La couronne d'un arbre, vue de haut. */
  | "couronne"
  | "buisson"
  | "rocher"
  | "lavande"
  /** Touffes et fleurs : petites, elles ne gênent que le dur. */
  | "herbe"
  /**
   * Le sol que la couronne d'un arbre **cache à la caméra**. La vue est
   * isométrique, caméra en (+x, +z) : un arbre haut masque le terrain
   * derrière lui. Un arbre planté dans l'herbe juste devant la route la
   * recouvre à l'écran, et on le croit planté dans le bitume.
   */
  | "masque"
  /** Ce que le joueur pose : banc, lanterne, puits… (`decoration.ts`). */
  | "objet"
  /** Un sol posé par le joueur (dallage, pas japonais) : on y pose des objets. */
  | "dalle";

export interface Occupant {
  id: string;
  genre: Genre;
  forme: Forme;
}

/** Ce qui est posé à même le sol et qu'aucun végétal ne perce. */
const DUR: Genre[] = ["route", "chemin", "cour", "ile", "parcelle", "batiment", "eau"];

/**
 * Les couples interdits, et la marge à respecter entre eux (en unités).
 * Symétrique : `[a, b]` vaut `[b, a]`.
 */
const REGLES: [Genre, Genre, number][] = [
  // Un pied d'arbre ne pousse pas dans le dur ; sa couronne ne déborde pas
  // sur un bâtiment, une cour, la route (c'est « l'arbre dans le bitume »).
  ...DUR.map((d): [Genre, Genre, number] => ["tronc", d, 0.15]),
  ["couronne", "batiment", 0.05],
  ["couronne", "cour", 0.05],
  ["couronne", "route", 0],
  ["couronne", "ile", 0],
  // Ce que cache une couronne : ni la route, ni un chemin, ni la cour, ni
  // le champ du joueur.
  ["masque", "route", 0],
  ["masque", "chemin", 0],
  ["masque", "cour", 0],
  ["masque", "ile", 0],
  // Deux troncs trop proches : deux arbres plantés l'un dans l'autre.
  ["tronc", "tronc", 0.25],
  // Les buissons, les pierres et la lavande ne se fondent ni entre eux,
  // ni dans un tronc, ni dans le dur.
  ...(["buisson", "rocher", "lavande"] as Genre[]).flatMap((g): [Genre, Genre, number][] => [
    ...DUR.map((d): [Genre, Genre, number] => [g, d, 0.1]),
    [g, "tronc", 0.1],
    [g, "buisson", 0.08],
    [g, "rocher", 0.08],
    [g, "lavande", 0.05],
  ]),
  // Une touffe peut frôler un buisson, pas pousser sur la route.
  ...DUR.map((d): [Genre, Genre, number] => ["herbe", d, 0.05]),
  ["herbe", "tronc", 0],
  // Deux mares ne se fondent pas l'une dans l'autre.
  ["eau", "eau", 0],
  // Ce que pose le joueur : ni sur le dur, ni dans l'eau, ni dans un tronc,
  // ni dans un autre objet. Il peut se poser sur un dallage.
  ...DUR.map((d): [Genre, Genre, number] => ["objet", d, 0.04]),
  ["objet", "objet", 0.01],
  ["objet", "tronc", 0.04],
  ["objet", "buisson", 0.02],
  ["objet", "rocher", 0.02],
  ["objet", "lavande", 0.02],
  // Un dallage borde le dur sans le recouvrir, et l'herbe n'y pousse pas.
  ...DUR.map((d): [Genre, Genre, number] => ["dalle", d, 0]),
  ["dalle", "dalle", 0],
  ["dalle", "tronc", 0.04],
  ["dalle", "buisson", 0],
  ["dalle", "rocher", 0],
  ["dalle", "lavande", 0],
  ["dalle", "herbe", 0],
  ["objet", "herbe", 0],
];

const TABLE = new Map<string, number>();
for (const [a, b, m] of REGLES) {
  TABLE.set(`${a}|${b}`, m);
  TABLE.set(`${b}|${a}`, m);
}

/** La marge exigée entre deux genres, ou `null` s'ils peuvent se chevaucher. */
export function marge(a: Genre, b: Genre): number | null {
  return TABLE.get(`${a}|${b}`) ?? null;
}

/** Deux formes se chevauchent-elles, marge comprise ? */
export function chevauchent(a: Forme, b: Forme, m = 0): boolean {
  if (a.type === "cercle" && b.type === "cercle") {
    return Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r + m;
  }
  if (a.type === "boite" && b.type === "boite") {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + m && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + m;
  }
  const c = (a.type === "cercle" ? a : b) as Extract<Forme, { type: "cercle" }>;
  const r = (a.type === "boite" ? a : b) as Extract<Forme, { type: "boite" }>;
  const dx = Math.max(Math.abs(c.x - r.x) - r.w / 2, 0);
  const dz = Math.max(Math.abs(c.z - r.z) - r.d / 2, 0);
  return Math.hypot(dx, dz) < c.r + m;
}

/** Un segment de route ou de chemin, en boîte alignée (les tracés du jeu le sont). */
export function boiteDeSegment(ax: number, az: number, bx: number, bz: number, demiLargeur: number): Forme {
  return {
    type: "boite",
    x: (ax + bx) / 2,
    z: (az + bz) / 2,
    w: Math.abs(bx - ax) + demiLargeur * 2,
    d: Math.abs(bz - az) + demiLargeur * 2,
  };
}

export interface Conflit {
  a: Occupant;
  b: Occupant;
  marge: number;
}

/** Tous les chevauchements interdits d'une liste d'occupants. */
export function conflits(occupants: Occupant[], limite = 200): Conflit[] {
  const out: Conflit[] = [];
  const grille = new GrilleOccupation(4);
  for (const o of occupants) {
    for (const autre of grille.voisins(o.forme)) {
      // Les morceaux d'un même objet (la file de cercles d'un banc) ne se
      // gênent pas entre eux.
      if (autre.id === o.id) continue;
      const m = marge(o.genre, autre.genre);
      if (m === null) continue;
      if (chevauchent(o.forme, autre.forme, m)) {
        out.push({ a: autre, b: o, marge: m });
        if (out.length >= limite) return out;
      }
    }
    grille.ajouter(o);
  }
  return out;
}

/** Un conflit, lisible dans un message de test. */
export function decrire(c: Conflit): string {
  const f = (o: Occupant) =>
    `${o.genre} ${o.id} (${o.forme.x.toFixed(1)}, ${o.forme.z.toFixed(1)})`;
  return `${f(c.a)} ↔ ${f(c.b)}`;
}

/* ------------------------------------------------------------------------ */
/* Placement                                                                  */
/* ------------------------------------------------------------------------ */

function etendue(f: Forme): [number, number, number, number] {
  if (f.type === "cercle") return [f.x - f.r, f.z - f.r, f.x + f.r, f.z + f.r];
  return [f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2];
}

/** Une grille de seaux : on ne compare qu'aux voisins, pas à tout le monde. */
class GrilleOccupation {
  private seaux = new Map<string, Occupant[]>();
  private grands: Occupant[] = [];
  constructor(private pas: number) {}

  ajouter(o: Occupant): void {
    const [x0, z0, x1, z1] = etendue(o.forme);
    // Une route traverse toute la carte : on la garde à part, comparée à tous.
    if ((x1 - x0) / this.pas > 12 || (z1 - z0) / this.pas > 12) {
      this.grands.push(o);
      return;
    }
    for (let i = Math.floor(x0 / this.pas); i <= Math.floor(x1 / this.pas); i++) {
      for (let k = Math.floor(z0 / this.pas); k <= Math.floor(z1 / this.pas); k++) {
        const cle = `${i},${k}`;
        const s = this.seaux.get(cle) ?? [];
        s.push(o);
        this.seaux.set(cle, s);
      }
    }
  }

  voisins(f: Forme): Occupant[] {
    const [x0, z0, x1, z1] = etendue(f);
    const vus = new Set<Occupant>(this.grands);
    // La marge la plus grande de la table est 0,25 : un seau de plus suffit.
    for (let i = Math.floor((x0 - 1) / this.pas); i <= Math.floor((x1 + 1) / this.pas); i++) {
      for (let k = Math.floor((z0 - 1) / this.pas); k <= Math.floor((z1 + 1) / this.pas); k++) {
        for (const o of this.seaux.get(`${i},${k}`) ?? []) vus.add(o);
      }
    }
    return [...vus];
  }
}

/**
 * L'occupation en cours de construction : on y déclare ce qui est posé, et
 * on lui demande si une place est libre pour un objet donné — selon les
 * mêmes règles que le contrôle.
 */
export class Occupation {
  readonly occupants: Occupant[] = [];
  private grille = new GrilleOccupation(4);

  ajouter(o: Occupant): void {
    this.occupants.push(o);
    this.grille.ajouter(o);
  }

  /** Toutes les formes d'un objet (un arbre en a deux : tronc et couronne) sont-elles libres ? */
  libre(parts: { genre: Genre; forme: Forme }[]): boolean {
    for (const p of parts) {
      for (const autre of this.grille.voisins(p.forme)) {
        const m = marge(p.genre, autre.genre);
        if (m !== null && chevauchent(p.forme, autre.forme, m)) return false;
      }
    }
    return true;
  }

  /** Pose l'objet si sa place est libre ; rend vrai s'il a été posé. */
  poser(id: string, parts: { genre: Genre; forme: Forme }[]): boolean {
    if (!this.libre(parts)) return false;
    for (const p of parts) this.ajouter({ id, genre: p.genre, forme: p.forme });
    return true;
  }
}

/* ------------------------------------------------------------------------ */
/* Les empreintes des végétaux                                               */
/* ------------------------------------------------------------------------ */

/**
 * L'empreinte d'un arbre de `ajouterArbre` : le pied (tronc et racines) et la
 * couronne. Les rayons sont ceux de la géométrie — le houppier s'étend à
 * environ 0,46 × taille du tronc, les racines à 0,17 × taille.
 */
export function empreinteArbre(x: number, z: number, taille: number): { genre: Genre; forme: Forme }[] {
  return [
    { genre: "tronc", forme: { type: "cercle", x, z, r: taille * 0.17 } },
    { genre: "couronne", forme: { type: "cercle", x, z, r: taille * 0.46 } },
    { genre: "masque", forme: masque(x, z, taille * 1.15, taille * 0.46) },
  ];
}

/**
 * Le sol qu'un objet de hauteur `hauteur` et de rayon `rayon` cache à la
 * caméra isométrique (élévation ≈ 32°, azimut 45°) : la couronne, à mi-hauteur
 * de sa masse (≈ 0,75 × hauteur), se projette sur le sol derrière elle, à
 * 0,75 × h / tan 32° ≈ 1,2 × h, dans la direction opposée à la caméra.
 */
export function masque(x: number, z: number, hauteur: number, rayon: number): Forme {
  const recul = (hauteur * 1.2) / Math.SQRT2;
  return { type: "cercle", x: x - recul, z: z - recul, r: rayon * 0.9 };
}

/**
 * Les arbres des coins de la ferme.
 *
 * Ils étaient plantés **sur** les coins de la haie : leur couronne mordait
 * l'île, et deux d'entre eux se dressaient dans le bitume du parking, qui
 * jouxte l'île. Chacun est maintenant posé juste hors du coin, en diagonale ;
 * si la place est prise (cour, chemin, autre arbre), il glisse le long des
 * deux bords ; s'il ne trouve rien, il n'est pas planté.
 */
export function arbresDeCoin(
  largeur: number,
  profondeur: number,
  taille: number,
  occupants: Occupant[],
): { x: number; z: number }[] {
  const occ = new Occupation();
  for (const o of occupants) occ.ajouter(o);
  // L'île déclarée par la campagne comprend son talus : c'est d'elle qu'on
  // part quand elle est plus large que la haie.
  const ile = occupants.find((o) => o.genre === "ile" && o.forme.type === "boite")?.forme;
  if (ile && ile.type === "boite") {
    largeur = Math.max(largeur, ile.w);
    profondeur = Math.max(profondeur, ile.d);
  }
  occ.ajouter({ id: "haie", genre: "ile", forme: { type: "boite", x: 0, z: 0, w: largeur, d: profondeur } });
  const d = taille * 0.46 + 0.12;
  const out: { x: number; z: number }[] = [];
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const cx = sx * (largeur / 2 + d * 0.72);
    const cz = sz * (profondeur / 2 + d * 0.72);
    const candidats: [number, number][] = [[cx, cz]];
    for (let k = 1; k <= 8; k++) {
      candidats.push([cx, cz - sz * k * 0.8], [cx - sx * k * 0.8, cz]);
      candidats.push([cx + sx * k * 0.5, cz + sz * k * 0.5]);
    }
    for (const [x, z] of candidats) {
      if (occ.poser(`coin-${sx}${sz}`, empreinteArbre(x, z, taille))) {
        out.push({ x, z });
        break;
      }
    }
  }
  return out;
}
