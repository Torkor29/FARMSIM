/**
 * Le carnet de nature : les espèces qu'on observe sur sa ferme.
 *
 * Chaque espèce a son groupe (`Guilde`), une population en dessous de
 * laquelle on ne la voit jamais, parfois un habitat qu'elle exige et des
 * saisons où elle est là. Une fois ces conditions réunies, on a chaque jour
 * de jeu une chance de l'observer (`observerEspeces`) — d'autant plus que sa
 * population est grande. La première observation se fête et entre au carnet.
 *
 * Le tirage est **déterministe** : ferme, espèce, jour. Relire le domaine
 * deux fois ne donne pas deux chances, et un test sait ce qu'il attend.
 */
import type { Faune, Guilde, Habitat } from "./biodiversite.js";
import type { Season } from "./world.js";

export type Espece = {
  code: string;
  nom: string;
  guilde: Guilde;
  icone: string;
  /** La population du groupe sous laquelle on ne la voit jamais. */
  seuil: number;
  /** Un habitat qu'elle exige, et sa surface minimale. */
  habitat?: { h: Habitat; min: number };
  /** Les saisons où elle est là (toutes si absent). */
  saisons?: readonly Season[];
  /** Ce qu'on en dit au carnet — et l'indice pour la trouver. */
  note: string;
};

const PRINTEMPS_ETE: readonly Season[] = ["SPRING", "SUMMER"];

export const ESPECES: readonly Espece[] = [
  // Pollinisateurs
  { code: "OSMIE", nom: "Osmie rousse", guilde: "POLLINISATEURS", icone: "🐝", seuil: 8, saisons: ["SPRING"], note: "Une abeille solitaire des premiers beaux jours, qui niche dans les tiges creuses." },
  { code: "BOURDON", nom: "Bourdon terrestre", guilde: "POLLINISATEURS", icone: "🐝", seuil: 12, note: "Il butine même par temps frais : le premier levé, le dernier couché." },
  { code: "PAON_DU_JOUR", nom: "Paon-du-jour", guilde: "POLLINISATEURS", icone: "🦋", seuil: 18, saisons: PRINTEMPS_ETE, note: "Quatre yeux sur les ailes pour effrayer les oiseaux." },
  { code: "CITRON", nom: "Citron", guilde: "POLLINISATEURS", icone: "🦋", seuil: 22, saisons: ["SPRING"], note: "Le papillon jaune qui annonce le printemps." },
  { code: "AZURE", nom: "Azuré commun", guilde: "POLLINISATEURS", icone: "🦋", seuil: 28, habitat: { h: "PRAIRIE", min: 8 }, note: "Un éclat bleu au ras d'une prairie non fauchée." },
  { code: "MACHAON", nom: "Machaon", guilde: "POLLINISATEURS", icone: "🦋", seuil: 38, habitat: { h: "PRAIRIE", min: 16 }, saisons: PRINTEMPS_ETE, note: "Le plus beau des papillons de France, pour les grandes prairies." },
  { code: "MORO_SPHINX", nom: "Moro-sphinx", guilde: "POLLINISATEURS", icone: "🦋", seuil: 45, habitat: { h: "FLEURS", min: 2 }, saisons: ["SUMMER"], note: "On le prend pour un colibri : il butine en vol stationnaire." },
  // Auxiliaires
  { code: "COCCINELLE", nom: "Coccinelle à sept points", guilde: "AUXILIAIRES", icone: "🐞", seuil: 8, note: "Une larve mange des dizaines de pucerons par jour." },
  { code: "SYRPHE", nom: "Syrphe ceinturé", guilde: "AUXILIAIRES", icone: "🪰", seuil: 16, note: "Déguisé en guêpe, il pollinise adulte et chasse les pucerons larve." },
  { code: "CARABE", nom: "Carabe doré", guilde: "AUXILIAIRES", icone: "🪲", seuil: 24, habitat: { h: "HAIE", min: 3 }, note: "Il chasse la nuit les limaces, au pied des haies." },
  { code: "CHRYSOPE", nom: "Chrysope", guilde: "AUXILIAIRES", icone: "🪰", seuil: 30, note: "Ailes de dentelle, larve lion des pucerons." },
  { code: "HERISSON", nom: "Hérisson", guilde: "AUXILIAIRES", icone: "🦔", seuil: 40, habitat: { h: "BOSQUET", min: 2 }, note: "Il lui faut des buissons et des passages entre les haies." },
  // Oiseaux
  { code: "MESANGE", nom: "Mésange charbonnière", guilde: "OISEAUX", icone: "🐦", seuil: 8, note: "Un couple nourrit ses petits de milliers de chenilles." },
  { code: "ROUGE_GORGE", nom: "Rouge-gorge", guilde: "OISEAUX", icone: "🐦", seuil: 14, note: "Il suit le jardinier pour les vers qu'il déterre." },
  { code: "HIRONDELLE", nom: "Hirondelle rustique", guilde: "OISEAUX", icone: "🐦", seuil: 22, saisons: PRINTEMPS_ETE, note: "Elle chasse les mouches au-dessus des prés et des étables." },
  { code: "CHARDONNERET", nom: "Chardonneret élégant", guilde: "OISEAUX", icone: "🐦", seuil: 28, habitat: { h: "PRAIRIE", min: 10 }, note: "Il vit des graines des chardons et des cardères." },
  { code: "PIC_VERT", nom: "Pic vert", guilde: "OISEAUX", icone: "🐦", seuil: 36, habitat: { h: "FUTAIE", min: 4 }, note: "Son rire résonne dans les vieux arbres ; il mange des fourmis." },
  { code: "COUCOU", nom: "Coucou gris", guilde: "OISEAUX", icone: "🐦", seuil: 45, saisons: ["SPRING"], note: "On l'entend bien plus qu'on ne le voit." },
  { code: "LORIOT", nom: "Loriot d'Europe", guilde: "OISEAUX", icone: "🐦", seuil: 55, habitat: { h: "FUTAIE", min: 8 }, saisons: ["SUMMER"], note: "Jaune d'or, caché tout en haut des grands arbres." },
  { code: "GRUE", nom: "Grue cendrée", guilde: "OISEAUX", icone: "🦢", seuil: 50, habitat: { h: "MARE", min: 6 }, saisons: ["AUTUMN"], note: "De passage à l'automne, elle fait halte près des grandes eaux." },
  // Rapaces
  { code: "BUSE", nom: "Buse variable", guilde: "RAPACES", icone: "🦅", seuil: 15, note: "Posée sur un piquet, elle guette les campagnols." },
  { code: "CRECERELLE", nom: "Faucon crécerelle", guilde: "RAPACES", icone: "🦅", seuil: 25, habitat: { h: "PRAIRIE", min: 12 }, note: "Il fait le Saint-Esprit au-dessus des prairies." },
  { code: "CHEVECHE", nom: "Chevêche d'Athéna", guilde: "RAPACES", icone: "🦉", seuil: 32, habitat: { h: "ARBRE", min: 2 }, note: "La petite chouette des vergers et des vieux arbres isolés." },
  { code: "HULOTTE", nom: "Chouette hulotte", guilde: "RAPACES", icone: "🦉", seuil: 42, habitat: { h: "FUTAIE", min: 6 }, note: "Son hululement est celui des films, la nuit, dans les bois." },
  { code: "GRAND_DUC", nom: "Grand-duc d'Europe", guilde: "RAPACES", icone: "🦉", seuil: 65, habitat: { h: "ROCAILLE", min: 8 }, note: "Le plus grand des hiboux, pour qui a bâti des falaises." },
  // Faune des mares
  { code: "GRENOUILLE", nom: "Grenouille verte", guilde: "AMPHIBIENS", icone: "🐸", seuil: 8, note: "Le concert des soirs d'été vient d'elle." },
  { code: "LIBELLULE", nom: "Libellule déprimée", guilde: "AMPHIBIENS", icone: "🪰", seuil: 16, saisons: PRINTEMPS_ETE, note: "Bleu pâle, elle patrouille au-dessus de sa mare." },
  { code: "CRAPAUD", nom: "Crapaud commun", guilde: "AMPHIBIENS", icone: "🐸", seuil: 22, note: "Il revient pondre chaque année dans la mare où il est né." },
  { code: "TRITON", nom: "Triton palmé", guilde: "AMPHIBIENS", icone: "🦎", seuil: 30, habitat: { h: "ROSELIERE", min: 4 }, note: "Discret, dans les herbes des berges." },
  { code: "HERON", nom: "Héron cendré", guilde: "AMPHIBIENS", icone: "🦩", seuil: 38, habitat: { h: "MARE", min: 4 }, note: "Immobile au bord de l'eau, il attend son poisson." },
  { code: "MARTIN_PECHEUR", nom: "Martin-pêcheur", guilde: "AMPHIBIENS", icone: "🐦", seuil: 48, habitat: { h: "RIVIERE", min: 2 }, note: "Un éclair bleu et orange le long des eaux vives." },
  { code: "SALAMANDRE", nom: "Salamandre tachetée", guilde: "AMPHIBIENS", icone: "🦎", seuil: 55, habitat: { h: "FUTAIE", min: 4 }, note: "Noire et jaune, elle sort des bois humides après la pluie." },
];

export function espece(code: string): Espece | undefined {
  return ESPECES.find((e) => e.code === code);
}

/** Pourquoi une espèce ne se montre pas encore — l'indice du carnet. */
export function indiceEspece(e: Espece): string {
  const bouts = [`${e.guilde === "AMPHIBIENS" ? "faune des mares" : e.guilde.toLowerCase()} ≥ ${e.seuil}`];
  if (e.habitat) bouts.push(`${e.habitat.min} cases de ${e.habitat.h.toLowerCase().replace("_", " ")}`);
  if (e.saisons) bouts.push(e.saisons.map((s) => ({ SPRING: "printemps", SUMMER: "été", AUTUMN: "automne", WINTER: "hiver" })[s]).join(", "));
  return bouts.join(" · ");
}

function hacher(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1_000_000) / 1_000_000;
}

/** Une espèce peut-elle se montrer aujourd'hui ? */
export function especeObservable(e: Espece, faune: Partial<Faune>, surfaces: Partial<Record<Habitat, number>>, saison: Season): boolean {
  if ((faune[e.guilde] ?? 0) < e.seuil) return false;
  if (e.habitat && (surfaces[e.habitat.h] ?? 0) < e.habitat.min) return false;
  if (e.saisons && !e.saisons.includes(saison)) return false;
  return true;
}

/**
 * Les nouvelles observations entre deux jours de jeu.
 *
 * Pour chaque jour écoulé (au plus quatorze) et chaque espèce pas encore vue
 * qui peut se montrer, un tirage : 8 % de chance par jour au seuil, 38 % quand
 * le groupe est au complet. Une espèce qui peut se montrer se fait voir en
 * quelques jours de jeu — la collection se remplit sur des semaines, pas en
 * un après-midi.
 */
export function observerEspeces(opts: {
  graine: string;
  deja: ReadonlySet<string>;
  faune: Partial<Faune>;
  surfaces: Partial<Record<Habitat, number>>;
  saison: Season;
  /** Jours de jeu écoulés, en indices absolus (du premier non tiré au dernier). */
  jourDebut: number;
  jourFin: number;
}): string[] {
  const vues: string[] = [];
  const debut = Math.max(opts.jourDebut, opts.jourFin - 13);
  for (const e of ESPECES) {
    if (opts.deja.has(e.code) || !especeObservable(e, opts.faune, opts.surfaces, opts.saison)) continue;
    const pop = opts.faune[e.guilde] ?? 0;
    const p = 0.08 + 0.3 * Math.min(1, (pop - e.seuil) / Math.max(1, 100 - e.seuil));
    for (let j = debut; j <= opts.jourFin; j++) {
      if (hacher(`${opts.graine}:${e.code}:${j}`) < p) {
        vues.push(e.code);
        break;
      }
    }
  }
  return vues;
}

/** Lire un carnet stocké en JSON : code → date de première observation. */
export function lireCarnet(json: string | null | undefined): Record<string, string> {
  if (!json) return {};
  try {
    const brut = JSON.parse(json) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(brut)) if (typeof v === "string" && espece(k)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}
