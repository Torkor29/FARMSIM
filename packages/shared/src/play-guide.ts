/**
 * Guide de ferme et objectifs — ce que le joueur peut cultiver, bâtir,
 * vendre, et ce que chaque métier apporte aux deux autres.
 *
 * Le jeu lâchait le joueur sur la parcelle avec un tutoriel de sept cartes.
 * Ici le contenu vit dans le jeu : un objectif à la fois, un recueil pour
 * tout le reste, y compris ce que les autres métiers produisent.
 */

import { GOOD_DEFS, type TradeGood } from "./goods.js";
import type { BuildingType, MachineType, Specialization } from "./index.js";

export type GuideChapterId =
  | "crops"
  | "soil"
  | "goods"
  | "build"
  | "machines"
  | "herd"
  | "triangle";

export type GuideEntry = {
  id: string;
  name: string;
  how: string;
  /** Qui en a besoin, y compris un autre métier */
  usedBy: string;
  soon?: boolean;
};

export type GuideChapter = {
  id: GuideChapterId;
  title: string;
  lead: string;
  entries: GuideEntry[];
};

export type GuideSnapshot = {
  spec: Specialization;
  plantedCells: number;
  readyCells: number;
  stubbleCells: number;
  peaCells: number;
  buildings: BuildingType[];
  machines: MachineType[];
  stockTons: number;
  hayTons: number;
  milkOrMeat: number;
  animals: number;
  hasSold: boolean;
  hasHarvested: boolean;
  hasContract: boolean;
};

export type ObjectiveDef = {
  id: string;
  title: string;
  hint: string;
  /** Ce que l'objectif ouvre une fois tenu */
  unlock: string;
  spec?: Specialization;
  check: (s: GuideSnapshot) => boolean;
};

export type ObjectiveView = {
  id: string;
  title: string;
  hint: string;
  unlock: string;
  done: boolean;
  current: boolean;
};

export const OBJECTIVE_DEFS: ObjectiveDef[] = [
  {
    id: "sow",
    title: "Semez 4 cases",
    hint: "Outil Semer, touchez des cases nues, puis le bouton d’or Faire.",
    unlock: "La récolte, dès que les épis sont dorés",
    check: (s) => s.plantedCells >= 4,
  },
  {
    id: "harvest",
    title: "Récoltez à point",
    hint: "Outil Récolte sur les cases dorées, ou Tout récolter.",
    unlock: "Du grain à vendre — et des chaumes à travailler",
    check: (s) => s.hasHarvested,
  },
  {
    id: "sell",
    title: "Vendez votre première récolte",
    hint: "Sans silo ça se vend tout seul, moins cher. Avec un silo, vous choisissez le moment.",
    unlock: "De quoi bâtir le prochain bâtiment",
    check: (s) => s.hasSold,
  },
  {
    id: "silo",
    title: "Bâtissez un silo",
    hint: "Sans silo, le grain part au négociant. Le silo permet d’attendre un meilleur cours.",
    unlock: "Stockage et séchage du grain humide",
    spec: "CEREALIER",
    check: (s) => s.buildings.includes("SILO"),
  },
  {
    id: "stubble",
    title: "Déchaumez après la moisson",
    hint: "Outil Sol → Déchaumer sur les chaumes. Sans ça, on ne resème pas.",
    unlock: "Un nouveau cycle de culture",
    spec: "CEREALIER",
    check: (s) => s.hasHarvested && s.stubbleCells === 0,
  },
  {
    id: "pea",
    title: "Semez du pois après une céréale",
    hint: "Le pois rapporte moins, mais il laisse l’azote : la suivante gagne +13 %.",
    unlock: "La rotation — le vrai métier de céréalier",
    spec: "CEREALIER",
    check: (s) => s.peaCells > 0,
  },
  {
    id: "barn",
    title: "Bâtissez une étable ou une porcherie",
    hint: "Onglet Bâtir. Sans bâtiment, pas de bêtes.",
    unlock: "Acheter des animaux et produire lait ou viande",
    spec: "ELEVEUR",
    check: (s) => s.buildings.includes("CATTLE_BARN") || s.buildings.includes("PIGSTY"),
  },
  {
    id: "animals",
    title: "Achetez vos premières bêtes",
    hint: "Onglet Élevage, une fois l’étable posée.",
    unlock: "La ration, la traite, la vente de lait",
    spec: "ELEVEUR",
    check: (s) => s.animals > 0,
  },
  {
    id: "hay",
    title: "Stockez du fourrage",
    hint: "Vendre → le négociant vend du foin. L’éleveur achète ce que le céréalier cultive.",
    unlock: "Nourrir le troupeau sans le laisser dépérir",
    spec: "ELEVEUR",
    check: (s) => s.hayTons > 0,
  },
  {
    id: "milk",
    title: "Traitez, puis vendez le lait",
    hint: "Le lait se gâte. Chambre froide si vous stockez, sinon vendez tout de suite.",
    unlock: "Un revenu régulier, moins lié au cours du blé",
    spec: "ELEVEUR",
    check: (s) => s.milkOrMeat > 0,
  },
  {
    id: "workshop",
    title: "Installez l’atelier",
    hint: "Onglet Bâtir → Atelier. C’est le cœur du dépôt ETA.",
    unlock: "Réparations moins chères, et celles des autres plus tard",
    spec: "ETA",
    check: (s) => s.buildings.includes("WORKSHOP"),
  },
  {
    id: "contract",
    title: "Acceptez un chantier",
    hint: "Onglet Bureau → un contrat Travaux à façon. Il faut la machine qui va avec.",
    unlock: "Gagner des CRD en travaillant chez les autres",
    spec: "ETA",
    check: (s) => s.hasContract,
  },
];

export function objectivesFor(spec: Specialization): ObjectiveDef[] {
  return OBJECTIVE_DEFS.filter((o) => !o.spec || o.spec === spec);
}

export function evaluateObjectives(snap: GuideSnapshot): ObjectiveView[] {
  const defs = objectivesFor(snap.spec);
  let currentSet = false;
  return defs.map((o) => {
    const done = o.check(snap);
    const current = !done && !currentSet;
    if (current) currentSet = true;
    return {
      id: o.id,
      title: o.title,
      hint: o.hint,
      unlock: o.unlock,
      done,
      current,
    };
  });
}

export function currentObjective(snap: GuideSnapshot): ObjectiveView | null {
  return evaluateObjectives(snap).find((o) => o.current) ?? null;
}

function goodEntry(code: TradeGood, how: string, usedBy: string, soon = false): GuideEntry {
  const d = GOOD_DEFS[code];
  return {
    id: code,
    name: `${d.name} (${d.unit})`,
    how,
    usedBy,
    soon,
  };
}

export const GUIDE_CHAPTERS: GuideChapter[] = [
  {
    id: "crops",
    title: "Cultiver",
    lead: "Trois cultures. On ne les sème pas pour la même raison : le blé paie, le maïs nourrit, le pois prépare la suivante.",
    entries: [
      {
        id: "WHEAT",
        name: "Blé · 15 CRD/case · 0,35 t",
        how: "Outil Semer → Blé. Environ 3 min. C’est la culture de cash.",
        usedBy: "Céréalier : vente. Éleveur : paille pressée (bientôt). ETA : chantier de moisson.",
      },
      {
        id: "MAIZE",
        name: "Maïs · 18 CRD/case · 0,45 t",
        how: "Outil Semer → Maïs. Un peu plus long. Sert aussi de concentré.",
        usedBy: "Céréalier : vente. Éleveur : ration. Plus tard : ensilage.",
      },
      {
        id: "PEA",
        name: "Pois · 12 CRD/case · 0,26 t",
        how: "Outil Semer → Pois. Rapporte moins, laisse l’azote : +13 % sur la culture suivante.",
        usedBy: "Céréalier : rotation. Marché : protéine mieux payée.",
      },
    ],
  },
  {
    id: "soil",
    title: "Sol",
    lead: "Après la moisson, la case n’est pas semable. Trois façons de la rouvrir — ce n’est pas la même terre à la fin.",
    entries: [
      {
        id: "stubble",
        name: "Déchaumage",
        how: "Outil Sol → Déchaumer. Enterre les chaumes. Les résidus nourrissent la suivante.",
        usedBy: "Céréalier, et ETA si on lui commande le passage.",
      },
      {
        id: "plow",
        name: "Labour",
        how: "Outil Sol → Labourer. Obligatoire après 3 récoltes, ou si la culture est perdue.",
        usedBy: "Tout le monde qui cultive. L’ETA le facture à la case.",
      },
      {
        id: "direct",
        name: "Semis direct",
        how: "Semer avec l’option Semis direct : dans les chaumes, sans passage avant. −10 % de rendement.",
        usedBy: "Céréalier pressé, ou qui ménage son sol.",
      },
      {
        id: "ferti",
        name: "Fertilisation",
        how: "Outil Sol → Ferti, jusqu’à 2 passages. Plus tard, le lisier de l’éleveur remplacera une partie de l’engrais.",
        usedBy: "Céréalier. Éleveur (lisier, bientôt). ETA (épandage).",
      },
    ],
  },
  {
    id: "goods",
    title: "Récolter & vendre",
    lead: "On ne vend pas que du grain. Chaque marchandise a un acheteur — parfois un autre métier.",
    entries: [
      goodEntry(
        "WHEAT",
        "Récolte à point (cases dorées). Pluie = grain humide : séchez au Bureau, ou vendez moins cher.",
        "Marché. Éleveur : paille (bientôt).",
      ),
      goodEntry(
        "MAIZE",
        "Même geste que le blé. Sert aussi de concentré pour le troupeau.",
        "Marché. Éleveur : ration. Plus tard : ensilage.",
      ),
      goodEntry(
        "PEA",
        "Récolte plus rapide. On le sème pour le sol autant que pour la vente.",
        "Marché. Céréalier : la culture d’après.",
      ),
      goodEntry(
        "HAY",
        "Seul achat chez le négociant aujourd’hui. L’éleveur en a besoin chaque cycle.",
        "Éleveur. Le céréalier en produira via le hangar à foin.",
      ),
      goodEntry(
        "MILK",
        "Traite à l’étable. Se gâte (12 % par cycle) : vendez ou chambre froide.",
        "Marché. Revenu régulier de l’éleveur.",
      ),
      goodEntry(
        "MEAT",
        "Abattage. Se gâte moins vite que le lait. Gros lot, gros prix.",
        "Marché.",
      ),
      {
        id: "STRAW",
        name: "Paille",
        how: "Après le blé : presser ou enfouir. Pas encore dans cette version.",
        usedBy: "Éleveur (litière). Céréalier (vente à l’éleveur).",
        soon: true,
      },
      {
        id: "SILAGE",
        name: "Ensilage",
        how: "Maïs ensilé au lieu d’être moissonné en grain. Pas encore dans cette version.",
        usedBy: "Éleveur (énergie d’hiver). ETA (chantier d’ensilage).",
        soon: true,
      },
      {
        id: "SLURRY",
        name: "Lisier / fumier",
        how: "Produit par le troupeau, épandu sur les champs. Pas encore dans cette version.",
        usedBy: "Céréalier (azote). Éleveur (doit s’en débarrasser). ETA (épandage).",
        soon: true,
      },
    ],
  },
  {
    id: "build",
    title: "Bâtir",
    lead: "Chaque bâtiment débloque un geste. On ne les pose pas pour décorer.",
    entries: [
      {
        id: "SILO",
        name: "Silo à grain · 1 200 CRD · 2×2",
        how: "Sans silo, le grain part au négociant. Avec un silo : stocker, sécher, vendre au bon cours.",
        usedBy: "Céréalier. Premier bâtiment à viser après la vente.",
      },
      {
        id: "HAY_BARN",
        name: "Hangar paille / foin · 900 CRD · 2×2",
        how: "Stocke fourrages, séchage doux.",
        usedBy: "Éleveur. Céréalier qui vendra du foin.",
      },
      {
        id: "MACHINE_SHED",
        name: "Hangar matériel · 1 500 CRD · 3×2",
        how: "Range jusqu’à 6 engins sans encombrer la cour.",
        usedBy: "ETA surtout. Les autres dès la deuxième machine.",
      },
      {
        id: "CATTLE_BARN",
        name: "Étable bovins · 2 800 CRD · 3×3",
        how: "12 places, traite, reproduction. Sans elle, pas de vaches.",
        usedBy: "Éleveur.",
      },
      {
        id: "PIGSTY",
        name: "Porcherie · 2 200 CRD · 2×3",
        how: "20 places. Viande plutôt que lait.",
        usedBy: "Éleveur.",
      },
      {
        id: "COLD_ROOM",
        name: "Chambre froide · 2 600 CRD · 2×2",
        how: "Ralentit de 40 % la perte du lait et de la viande.",
        usedBy: "Éleveur qui ne vend pas dans la minute.",
      },
      {
        id: "WORKSHOP",
        name: "Atelier · 1 100 CRD · 2×2",
        how: "Répare moins cher. Cœur du dépôt ETA.",
        usedBy: "ETA. Utile dès qu’on a une machine.",
      },
      {
        id: "FARMHOUSE",
        name: "Maison d’exploitation · 2 000 CRD · 2×2",
        how: "Siège : +2 % d’XP.",
        usedBy: "Tous.",
      },
      {
        id: "PADDOCK",
        name: "Enclos de pâture · 1 210 CRD · 3×3",
        how: "À coller contre l’étable. Les bêtes au pré, le lait monte.",
        usedBy: "Éleveur.",
      },
      {
        id: "PIG_YARD",
        name: "Courette à porcs · 780 CRD · 2×3",
        how: "À coller contre la porcherie.",
        usedBy: "Éleveur.",
      },
    ],
  },
  {
    id: "machines",
    title: "Machines",
    lead: "Sans le bon engin, le geste est refusé — ou une ETA le fait à votre place, contre des CRD.",
    entries: [
      {
        id: "TRACTOR",
        name: "Tracteur T1 · 3 200 CRD",
        how: "Semis, labour, ferti. Garage pour acheter, réparer, garer.",
        usedBy: "Les trois métiers. L’ETA le glisse sur le champ du client.",
      },
      {
        id: "HARVESTER",
        name: "Moissonneuse T1 · 4 800 CRD",
        how: "Récolte. Sans elle : bouton orange ETA sur l’outil Récolte.",
        usedBy: "Céréalier (ou il appelle l’ETA). ETA : chantier le plus demandé.",
      },
      {
        id: "SPREADER",
        name: "Épandeur T1 · 1 800 CRD",
        how: "Fertilisation plus douce pour la machine que le tracteur.",
        usedBy: "Céréalier. ETA : épandage, bientôt le lisier.",
      },
      {
        id: "DISC_HARROW",
        name: "Déchaumeur · 2 100 CRD",
        how: "Enterre les chaumes.",
        usedBy: "Céréalier. ETA.",
      },
    ],
  },
  {
    id: "herd",
    title: "Troupeau",
    lead: "L’élevage ne pousse pas tout seul : ration, bonheur, froid. L’éleveur achète ce que les deux autres vendent.",
    entries: [
      {
        id: "feed",
        name: "Nourrir",
        how: "Fourrage (négociant) et/ou maïs (stock). Sans ration, le troupeau dépérit.",
        usedBy: "Éleveur. Céréalier : débouché pour le maïs.",
      },
      {
        id: "milk-job",
        name: "Traire",
        how: "Onglet Élevage, sur un troupeau bovin nourri.",
        usedBy: "Éleveur. ETA : collecte (bientôt).",
      },
      {
        id: "graze",
        name: "Sortir au pré",
        how: "Enclos collé à l’étable. Le bonheur monte, le lait aussi.",
        usedBy: "Éleveur.",
      },
      {
        id: "cold",
        name: "Chambre froide",
        how: "Ralentit la perte du lait et de la viande de 40 %.",
        usedBy: "Éleveur qui ne vend pas dans la minute.",
      },
    ],
  },
  {
    id: "triangle",
    title: "Les trois métiers",
    lead: "Personne ne gagne tout seul. La matière, le travail et le calendrier lient céréalier, éleveur et ETA.",
    entries: [
      {
        id: "cer",
        name: "Céréalier",
        how: "Produit blé, maïs, pois. A besoin d’une moisson (sienne ou ETA) et, bientôt, vend paille et ensilage à l’éleveur.",
        usedBy: "Nourrit l’éleveur. Occupe l’ETA aux pics de saison.",
      },
      {
        id: "elv",
        name: "Éleveur",
        how: "Produit lait et viande. Achète foin et maïs. Bientôt : paille, ensilage, et lisier à rendre au céréalier.",
        usedBy: "Débouché du céréalier. Chantiers d’épandage pour l’ETA.",
      },
      {
        id: "eta",
        name: "ETA",
        how: "Ne cultive pas pour vendre : elle vend du travail. Machine chez soi, glisser sur le champ, graisser, réparer.",
        usedBy: "Les deux autres, surtout à la moisson et quand ils sont absents.",
      },
      {
        id: "npc",
        name: "Pas d’ETA sous la main ?",
        how: "Le bouton orange « ETA » sur un chantier fait venir une entreprise. C’est le jeu, pas un échec.",
        usedBy: "Céréalier et éleveur sans la machine du moment.",
      },
    ],
  },
];
