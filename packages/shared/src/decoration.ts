/**
 * La décoration libre — « perso au max, comme les Sims ».
 *
 * Tout l'espace du joueur est à lui : la ferme, la campagne autour, le
 * village. Il y pose ce qu'il veut, où il veut, dans le sens qu'il veut, et
 * le repeint. Ce module est ce que le serveur et la vue partagent : le
 * catalogue, la forme d'une décoration posée, et les règles qui ne
 * dépendent pas du terrain (prix, niveau, bornes, nombre).
 *
 * Ce qui dépend du terrain — ne pas poser un banc sur la route ni un puits
 * dans un champ — se vérifie dans la vue, avec les mêmes règles que le
 * reste du décor (`apps/web/src/placement.ts`).
 *
 * Les modèles viennent de la forge (`apps/web/blender`) : chaque article
 * nomme son fichier et sa pièce. Les dimensions sont celles du manifeste,
 * en mètres de la forge ; un test de la vue vérifie qu'elles n'ont pas
 * dérivé.
 *
 * **Repère** : une décoration est placée autour du **siège** de la ferme, la
 * carte ramenée à son orientation de référence. Passer d'une parcelle à
 * l'autre, ou recevoir une carte tournée d'un quart, ne la déplace pas.
 */

export type CategorieDeco = "JARDIN" | "LUMIERE" | "FETE" | "NATURE" | "SOL" | "REPERE";

export const CATEGORIES_DECO: { code: CategorieDeco; nom: string }[] = [
  { code: "JARDIN", nom: "Jardin" },
  { code: "LUMIERE", nom: "Lumières" },
  { code: "FETE", nom: "Fête" },
  { code: "NATURE", nom: "Nature" },
  { code: "SOL", nom: "Sols et eau" },
  { code: "REPERE", nom: "Repères" },
];

/**
 * Comment un article occupe le sol.
 *
 * - `objet` : ne traverse rien, ne se pose ni sur le dur ni dans l'eau ;
 * - `arbre` : pied, couronne et masque, comme les arbres du décor ;
 * - `dalle` : un sol (dallage, pas japonais) — les objets peuvent s'y poser ;
 * - `eau` : une mare, où l'on ne pose rien.
 */
export type EmpriseDeco = "objet" | "arbre" | "dalle" | "eau";

export interface ArticleDeco {
  code: string;
  nom: string;
  categorie: CategorieDeco;
  /** Prix d'achat, en crédits. */
  prix: number;
  /** Niveau de joueur requis. */
  niveau: number;
  /** Fichier de la forge (`public/assets/decor3d/<asset>.glb`). */
  asset: string;
  /** Pièce du fichier. */
  piece: string;
  /** Largeur (x), hauteur, profondeur (z) de la pièce, en mètres de la forge. */
  taille: [number, number, number];
  /** Mètres de la forge → unités de la scène. */
  echelle: number;
  emprise: EmpriseDeco;
  /**
   * La matière que le joueur peut repeindre (`TEINTES_DECO`). Absente :
   * l'article garde ses couleurs.
   */
  teinte?: string;
}

/** La palette proposée pour repeindre : les couleurs de la forge. */
export const TEINTES_DECO: { nom: string; hex: string }[] = [
  { nom: "Brique", hex: "#c0503a" },
  { nom: "Coquelicot", hex: "#d8413a" },
  { nom: "Abricot", hex: "#e39a4a" },
  { nom: "Tournesol", hex: "#e8c24a" },
  { nom: "Sauge", hex: "#7fa36a" },
  { nom: "Sapin", hex: "#3f7050" },
  { nom: "Lagon", hex: "#5aa7b0" },
  { nom: "Bleuet", hex: "#4f78b0" },
  { nom: "Lavande", hex: "#9a86c4" },
  { nom: "Rose", hex: "#e090a8" },
  { nom: "Crème", hex: "#efe4c8" },
  { nom: "Ardoise", hex: "#5a6068" },
];

const PROP = 0.7;
const ARBRE = 0.55;

/** Le catalogue, dans l'ordre d'affichage. */
export const DECO_CATALOGUE: ArticleDeco[] = [
  /* — Jardin ——————————————————————————————————————————— */
  { code: "BANC", nom: "Banc de jardin", categorie: "JARDIN", prix: 180, niveau: 1, asset: "jardin", piece: "banc", taille: [1.25, 0.82, 0.375], echelle: PROP, emprise: "objet", teinte: "bois" },
  { code: "BAIN_OISEAUX", nom: "Bain d'oiseaux", categorie: "JARDIN", prix: 240, niveau: 1, asset: "jardin", piece: "bain-oiseaux", taille: [0.599, 0.865, 0.58], echelle: PROP, emprise: "objet" },
  { code: "NICHOIR", nom: "Nichoir", categorie: "JARDIN", prix: 150, niveau: 1, asset: "jardin", piece: "nichoir", taille: [0.339, 1.897, 0.383], echelle: PROP, emprise: "objet", teinte: "peinture-bleue" },
  { code: "POTS_FLEURS", nom: "Pots fleuris", categorie: "JARDIN", prix: 120, niveau: 1, asset: "jardin", piece: "pots-fleurs", taille: [0.616, 0.703, 0.693], echelle: PROP, emprise: "objet", teinte: "pot" },
  { code: "ARROSOIR", nom: "Arrosoir", categorie: "JARDIN", prix: 40, niveau: 1, asset: "jardin", piece: "arrosoir", taille: [0.412, 0.32, 0.2], echelle: PROP, emprise: "objet", teinte: "peinture-verte" },
  { code: "POTS_VIDES", nom: "Pile de pots", categorie: "JARDIN", prix: 30, niveau: 1, asset: "jardin", piece: "pots-vides", taille: [0.55, 0.26, 0.348], echelle: PROP, emprise: "objet", teinte: "pot" },
  { code: "SACS", nom: "Sacs de jute", categorie: "JARDIN", prix: 60, niveau: 1, asset: "jardin", piece: "sacs", taille: [0.883, 0.466, 0.824], echelle: PROP, emprise: "objet" },
  { code: "RUCHE", nom: "Ruche en paille", categorie: "JARDIN", prix: 320, niveau: 2, asset: "jardin", piece: "ruche-paille", taille: [0.68, 1.083, 0.769], echelle: PROP, emprise: "objet" },
  { code: "EPOUVANTAIL", nom: "Épouvantail", categorie: "JARDIN", prix: 600, niveau: 2, asset: "epouvantail", piece: "epouvantail", taille: [1.624, 2.115, 0.927], echelle: PROP, emprise: "objet", teinte: "peinture-bleue" },

  /* — Lumières ————————————————————————————————————————— */
  { code: "LAMPION", nom: "Lampion", categorie: "LUMIERE", prix: 90, niveau: 1, asset: "jardin", piece: "lampion", taille: [0.372, 0.6, 0.363], echelle: PROP, emprise: "objet", teinte: "toile-rouge" },
  { code: "LANTERNE", nom: "Lanterne sur poteau", categorie: "LUMIERE", prix: 260, niveau: 1, asset: "fete", piece: "lanterne", taille: [0.67, 2.0, 0.28], echelle: PROP, emprise: "objet" },
  { code: "LANTERNE_PIERRE", nom: "Lanterne de pierre", categorie: "LUMIERE", prix: 380, niveau: 2, asset: "jardin", piece: "lanterne-pierre", taille: [0.72, 1.23, 0.624], echelle: PROP, emprise: "objet" },
  { code: "GUIRLANDE_LUMINEUSE", nom: "Guirlande lumineuse", categorie: "LUMIERE", prix: 420, niveau: 3, asset: "fete", piece: "guirlande-lumineuse", taille: [4.1, 2.4, 0.14], echelle: PROP, emprise: "objet" },

  /* — Fête ————————————————————————————————————————————— */
  { code: "CITROUILLE", nom: "Citrouille", categorie: "FETE", prix: 25, niveau: 1, asset: "fete", piece: "citrouille", taille: [0.64, 0.499, 0.64], echelle: PROP, emprise: "objet", teinte: "citrouille" },
  { code: "CITROUILLES", nom: "Tas de citrouilles", categorie: "FETE", prix: 70, niveau: 1, asset: "fete", piece: "citrouilles", taille: [1.45, 0.53, 0.87], echelle: PROP, emprise: "objet", teinte: "citrouille" },
  { code: "BOTTE_FOIN", nom: "Botte de foin", categorie: "FETE", prix: 90, niveau: 1, asset: "fete", piece: "botte-de-foin", taille: [1.134, 1.12, 0.7], echelle: PROP, emprise: "objet" },
  { code: "TONNEAU", nom: "Tonneau", categorie: "FETE", prix: 110, niveau: 1, asset: "fete", piece: "tonneau", taille: [0.66, 0.9, 0.756], echelle: PROP, emprise: "objet", teinte: "peinture-bleue" },
  { code: "CAISSE", nom: "Caisse de pommes", categorie: "FETE", prix: 45, niveau: 1, asset: "fete", piece: "caisse", taille: [0.63, 0.428, 0.5], echelle: PROP, emprise: "objet", teinte: "peinture-rouge" },
  { code: "GUIRLANDE", nom: "Guirlande de fanions", categorie: "FETE", prix: 300, niveau: 2, asset: "fete", piece: "guirlande", taille: [4.133, 2.51, 0.14], echelle: PROP, emprise: "objet" },
  { code: "ETAL", nom: "Étal du marché", categorie: "FETE", prix: 1800, niveau: 3, asset: "etal", piece: "etal-rouge", taille: [3.436, 2.33, 2.037], echelle: 0.6, emprise: "objet", teinte: "toile-rouge" },

  /* — Nature ——————————————————————————————————————————— */
  { code: "ARBRE_ROND", nom: "Arbre rond", categorie: "NATURE", prix: 350, niveau: 1, asset: "nature", piece: "arbre-rond-1", taille: [3.628, 4.444, 3.283], echelle: ARBRE, emprise: "arbre" },
  { code: "ARBRE_LEGER", nom: "Arbre au feuillage léger", categorie: "NATURE", prix: 350, niveau: 1, asset: "nature", piece: "arbre-leger-1", taille: [3.301, 4.481, 3.403], echelle: ARBRE, emprise: "arbre" },
  { code: "ARBRE_AUTOMNE", nom: "Arbre roux", categorie: "NATURE", prix: 420, niveau: 2, asset: "nature", piece: "arbre-rond-automne", taille: [3.388, 3.969, 2.984], echelle: ARBRE, emprise: "arbre" },
  { code: "SAPIN", nom: "Sapin", categorie: "NATURE", prix: 380, niveau: 1, asset: "nature", piece: "sapin-1", taille: [2.265, 5.01, 2.233], echelle: ARBRE, emprise: "arbre" },
  { code: "BUISSON", nom: "Buisson", categorie: "NATURE", prix: 90, niveau: 1, asset: "nature", piece: "buisson-1", taille: [1.233, 0.87, 1.319], echelle: PROP, emprise: "objet" },
  { code: "BUISSON_ROSES", nom: "Rosier", categorie: "NATURE", prix: 140, niveau: 1, asset: "nature", piece: "buisson-roses", taille: [1.187, 0.837, 1.283], echelle: PROP, emprise: "objet" },
  { code: "BUISSON_COQUELICOTS", nom: "Buisson de coquelicots", categorie: "NATURE", prix: 120, niveau: 1, asset: "nature", piece: "buisson-coquelicots", taille: [1.022, 0.71, 0.926], echelle: PROP, emprise: "objet" },
  { code: "LAVANDE", nom: "Lavande", categorie: "NATURE", prix: 50, niveau: 1, asset: "nature", piece: "lavande", taille: [0.835, 0.815, 0.916], echelle: PROP, emprise: "objet" },
  { code: "ROSEAUX", nom: "Roseaux", categorie: "NATURE", prix: 60, niveau: 1, asset: "nature", piece: "roseaux", taille: [0.201, 1.25, 0.231], echelle: 0.8, emprise: "objet" },
  { code: "ROCHER", nom: "Rocher moussu", categorie: "NATURE", prix: 110, niveau: 1, asset: "nature", piece: "rocher-2", taille: [1.328, 0.589, 1.186], echelle: PROP, emprise: "objet" },
  { code: "GROS_ROCHER", nom: "Gros rocher", categorie: "NATURE", prix: 220, niveau: 2, asset: "nature", piece: "rocher-1", taille: [2.125, 0.999, 1.492], echelle: PROP, emprise: "objet" },
  { code: "FLEURS", nom: "Fleurs des champs", categorie: "NATURE", prix: 20, niveau: 1, asset: "nature", piece: "fleurs", taille: [0.386, 0.382, 0.334], echelle: 0.9, emprise: "objet" },

  /* — Sols et eau —————————————————————————————————————— */
  { code: "DALLAGE_PETIT", nom: "Petit dallage", categorie: "SOL", prix: 160, niveau: 1, asset: "sol", piece: "dallage-petit", taille: [1.769, 0.128, 1.771], echelle: 0.7, emprise: "dalle" },
  { code: "DALLAGE", nom: "Dallage de pierre", categorie: "SOL", prix: 400, niveau: 1, asset: "sol", piece: "dallage", taille: [3.169, 0.13, 3.157], echelle: 0.7, emprise: "dalle" },
  { code: "PAS_JAPONAIS", nom: "Pas japonais", categorie: "SOL", prix: 220, niveau: 1, asset: "sol", piece: "pas-japonais", taille: [3.705, 0.09, 1.107], echelle: 0.7, emprise: "dalle" },
  { code: "MARE", nom: "Mare aux nénuphars", categorie: "SOL", prix: 1500, niveau: 2, asset: "sol", piece: "mare", taille: [3.816, 1.168, 2.831], echelle: 0.9, emprise: "eau" },
  { code: "TERRASSES", nom: "Terrasses fleuries", categorie: "SOL", prix: 2500, niveau: 4, asset: "sol", piece: "terrasses", taille: [6.402, 1.403, 6.526], echelle: 0.55, emprise: "objet" },

  /* — Repères —————————————————————————————————————————— */
  { code: "PUITS", nom: "Puits à souhaits", categorie: "REPERE", prix: 3500, niveau: 3, asset: "puits", piece: "puits", taille: [2.874, 2.781, 2.156], echelle: 0.6, emprise: "objet", teinte: "tuile" },
  { code: "SERRE", nom: "Serre", categorie: "REPERE", prix: 6000, niveau: 4, asset: "serre", piece: "serre", taille: [3.62, 1.999, 3.455], echelle: 0.6, emprise: "objet" },
  { code: "SOURCE_CHAUDE", nom: "Source chaude", categorie: "REPERE", prix: 9000, niveau: 5, asset: "source_chaude", piece: "source-chaude", taille: [6.348, 1.849, 5.754], echelle: 0.6, emprise: "objet" },
  { code: "MOULIN", nom: "Moulin à vent", categorie: "REPERE", prix: 18000, niveau: 6, asset: "moulin", piece: "moulin", taille: [5.229, 7.565, 4.117], echelle: 0.6, emprise: "objet" },
];

const PAR_CODE = new Map(DECO_CATALOGUE.map((a) => [a.code, a]));

export function articleDeco(code: string): ArticleDeco | undefined {
  return PAR_CODE.get(code);
}

/** Une décoration posée. */
export interface Decoration {
  id: string;
  code: string;
  /** Position au sol, repère du siège (voir l'en-tête), en unités de scène. */
  x: number;
  z: number;
  /** Cap, en radians. */
  rot: number;
  /** Indice dans `TEINTES_DECO`, si l'article se repeint. */
  teinte?: number;
}

/** Combien de décorations une ferme peut porter : assez pour tout oser. */
export const DECO_MAX = 400;

/** Jusqu'où, autour du siège : la commune entière et son village. */
export const DECO_PORTEE = 120;

/**
 * Part du prix rendue à la revente. Déplacer, tourner et repeindre sont
 * gratuits : on essaie, on recommence — c'est tout le plaisir.
 */
export const DECO_REVENTE = 0.8;

/** Le prix rendu quand on revend un article. */
export function prixRevente(article: ArticleDeco): number {
  return Math.round(article.prix * DECO_REVENTE);
}

/**
 * Ce qui ne va pas dans une décoration, indépendamment du terrain ; `null`
 * si elle est recevable.
 */
export function refusDecoration(d: Omit<Decoration, "id">): string | null {
  const article = articleDeco(d.code);
  if (!article) return "Article inconnu";
  if (![d.x, d.z, d.rot].every(Number.isFinite)) return "Position invalide";
  if (Math.hypot(d.x, d.z) > DECO_PORTEE) return "Trop loin de la ferme";
  if (d.teinte != null) {
    if (!article.teinte) return "Cet article ne se repeint pas";
    if (!Number.isInteger(d.teinte) || d.teinte < 0 || d.teinte >= TEINTES_DECO.length) {
      return "Teinte inconnue";
    }
  }
  return null;
}

/** Ramène un cap dans ]-π, π], arrondi au centième. */
export function normaliserCap(rot: number): number {
  let r = rot % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return Math.round(r * 100) / 100;
}

/**
 * Lit la colonne `decorJson`. Ce qui ne se lit pas, ou nomme un article
 * retiré du catalogue, est ignoré plutôt que de faire tomber la ferme.
 */
export function lireDecorations(json: string | null | undefined): Decoration[] {
  if (!json) return [];
  let brut: unknown;
  try {
    brut = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(brut)) return [];
  const out: Decoration[] = [];
  for (const b of brut) {
    if (!b || typeof b !== "object") continue;
    const d = b as Decoration;
    if (typeof d.id !== "string" || typeof d.code !== "string") continue;
    if (refusDecoration(d)) continue;
    out.push({
      id: d.id,
      code: d.code,
      x: d.x,
      z: d.z,
      rot: d.rot,
      ...(d.teinte != null ? { teinte: d.teinte } : {}),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Emprise au sol                                                       */
/* ------------------------------------------------------------------ */

/**
 * La forme au sol d'un article posé, en cercles (repère de la scène).
 *
 * Un cercle unique suffit à ce qui est à peu près rond ; un article allongé
 * (banc, guirlande, pas japonais) devient une file de cercles le long de sa
 * longueur, tournée avec lui — un cercle englobant interdirait de poser deux
 * bancs dos à dos, un cercle inscrit laisserait leurs bouts se traverser.
 */
export function cerclesDeco(
  article: ArticleDeco,
  x: number,
  z: number,
  rot: number,
): { x: number; z: number; r: number }[] {
  // Un peu moins que la boîte : les modèles sont arrondis, et deux objets
  // qui se frôlent par leurs coins ne se traversent pas.
  const serre = article.emprise === "dalle" ? 0.5 : 0.44;
  const w = article.taille[0] * article.echelle;
  const d = article.taille[2] * article.echelle;
  const long = Math.max(w, d);
  const court = Math.min(w, d);
  const n = Math.max(1, Math.ceil(long / Math.max(court, 0.3) - 0.25));
  const r = Math.max(court, long / n) * serre * (n > 1 ? 1.12 : 1);
  if (n === 1) return [{ x, z, r: long * serre }];
  // Axe long dans le repère de l'article : x si w ≥ d, sinon z. Le cap tourne
  // autour de y (comme `Object3D.rotation.y`).
  const [ax, az] = w >= d ? [1, 0] : [0, 1];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const dx = ax * c + az * s;
  const dz = -ax * s + az * c;
  const pas = (long - 2 * r) / (n - 1);
  const out: { x: number; z: number; r: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = -long / 2 + r + i * pas;
    out.push({ x: x + dx * t, z: z + dz * t, r });
  }
  return out;
}
