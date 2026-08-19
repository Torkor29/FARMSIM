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
    hint: "Sans silo, le grain se vend tout de suite, moins cher. Le silo permet d’attendre.",
    unlock: "Stockage et séchage du grain humide",
    spec: "CEREALIER",
    check: (s) => s.buildings.includes("SILO"),
  },
  {
    id: "stubble",
    title: "Nettoyez le sol après la récolte",
    hint: "Outil Sol → Nettoyer sur les chaumes. Sans ça, on ne resème pas.",
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
    title: "Bâtissez un bâtiment d’élevage",
    hint: "Onglet Bâtir : étable, porcherie, poulailler ou bergerie.",
    unlock: "Acheter des animaux et produire lait, œufs, laine ou viande",
    spec: "ELEVEUR",
    check: (s) =>
      s.buildings.includes("CATTLE_BARN") ||
      s.buildings.includes("PIGSTY") ||
      s.buildings.includes("HENHOUSE") ||
      s.buildings.includes("SHEEPFOLD"),
  },
  {
    id: "animals",
    title: "Achetez vos premières bêtes",
    hint: "Onglet Élevage, une fois l’étable posée.",
    unlock: "La ration, puis la traite, les œufs ou la laine",
    spec: "ELEVEUR",
    check: (s) => s.animals > 0,
  },
  {
    id: "hay",
    title: "Stockez du fourrage",
    hint: "Vendre → on peut acheter du foin. L’éleveur achète ce que le céréalier cultive.",
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
    hint: "Onglet Bâtir → Atelier. Réparations moins chères, graisse et nettoyage.",
    unlock: "Réparations moins chères dès que les machines enchaînent",
    check: (s) => s.buildings.includes("WORKSHOP"),
  },
  {
    id: "contract",
    title: "Aidez un voisin pendant que ça pousse",
    hint: "Onglet Missions. Il faut la machine.",
    unlock: "Un peu d’argent en plus, pas une rente",
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
    lead: "Six cultures. On ne les sème pas pour la même raison : le blé paie, l’orge nourrit les cochons, le maïs aussi, le colza casse la rotation, le pois laisse l’azote, l’herbe devient du foin.",
    entries: [
      {
        id: "WHEAT",
        name: "Blé · 15 TRN/case · 0,35 t",
        how: "Outil Semer → Blé. Environ 3 min. C’est la culture de cash.",
        usedBy: "Céréalier : vente. Éleveur : paille (bientôt). Missions de moisson.",
      },
      {
        id: "BARLEY",
        name: "Orge · 13 TRN/case · 0,32 t",
        how: "Outil Semer → Orge. Un peu plus rapide que le blé. Moissonneuse.",
        usedBy: "Céréalier : vente. Éleveur : concentré pour les cochons.",
      },
      {
        id: "MAIZE",
        name: "Maïs · 18 TRN/case · 0,45 t",
        how: "Outil Semer → Maïs. Un peu plus long. Sert aussi de concentré.",
        usedBy: "Céréalier : vente. Éleveur : ration. Plus tard : ensilage.",
      },
      {
        id: "RAPE",
        name: "Colza · 16 TRN/case · 0,22 t",
        how: "Outil Semer → Colza. Plus long, moins de tonnes, mieux payé. Pas de paille.",
        usedBy: "Céréalier : rupture de rotation et vente. Ce n’est pas une légumineuse.",
      },
      {
        id: "PEA",
        name: "Pois · 12 TRN/case · 0,26 t",
        how: "Outil Semer → Pois. Rapporte moins, laisse l’azote : +13 % sur la culture suivante.",
        usedBy: "Céréalier : rotation. Marché : protéine mieux payée.",
      },
      {
        id: "GRASS",
        name: "Herbe · 8 TRN/case · 0,40 t de foin",
        how: "Outil Semer → Herbe. Faucher au tracteur, pas à la moissonneuse. Trois coupes, puis resemer.",
        usedBy: "Éleveur : foin au hangar. Le champ reprend tout seul entre deux fauches.",
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
        usedBy: "Céréalier, et missions si on commande le passage.",
      },
      {
        id: "plow",
        name: "Labour",
        how: "Outil Sol → Labourer. Obligatoire après 3 récoltes, ou si la culture est perdue.",
        usedBy: "Tout le monde qui cultive. On peut payer quelqu’un à la case.",
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
        how: "Outil Sol → Ferti, jusqu’à 2 passages. Le fumier de l’éleveur remplace l’engrais du magasin : moins cher, le sol gagne un peu.",
        usedBy: "Céréalier. Éleveur : fosse à vider. Missions d’épandage.",
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
        "Marché. Éleveur : paille (litière) et ensilage.",
      ),
      goodEntry(
        "MAIZE",
        "Même geste que le blé. Grain pour le marché, ou ensilage pour le troupeau.",
        "Marché. Éleveur : ration et ensilage.",
      ),
      goodEntry(
        "PEA",
        "Récolte plus rapide. On le sème pour le sol autant que pour la vente.",
        "Marché. Céréalier : la culture d’après.",
      ),
      goodEntry(
        "BARLEY",
        "Même geste que le blé. Moins cher à semer, un peu moins de tonnes.",
        "Marché. Éleveur : ration orge, surtout les cochons.",
      ),
      goodEntry(
        "RAPE",
        "Jaune à maturité. On le sème pour casser la rotation et vendre cher.",
        "Marché. Céréalier : pas une légumineuse — ça ne laisse pas d’azote.",
      ),
      goodEntry(
        "HAY",
        "On le fauche sur l’herbe, ou on l’achète à l’hôtel des ventes. Le foin va au hangar, pas au silo à grain.",
        "Éleveur. Le céréalier en produit en fauchant.",
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
      goodEntry(
        "EGGS",
        "Ramassage au poulailler. Se gâte vite (18 % par cycle) : vendez ou chambre froide.",
        "Marché. Revenu régulier des poules.",
      ),
      goodEntry(
        "WOOL",
        "Tonte à la bergerie. Ne se gâte pas. Prix calme.",
        "Marché. Revenu des moutons, avant la viande.",
      ),
      {
        id: "STRAW",
        name: "Paille",
        how: "Après le blé : presser (bottes) ou enfouir (déchaumage). Les bottes se ramassent au stock.",
        usedBy: "Éleveur (litière). Céréalier (vente à l’éleveur).",
      },
      {
        id: "SILAGE",
        name: "Ensilage",
        how: "Maïs récolté plante entière, plus tôt, plus de tonnage. Pas un cours mondial : on le donne au troupeau ou on le vend au voisin.",
        usedBy: "Éleveur (énergie d’hiver). Missions d’ensilage.",
      },
      goodEntry(
        "CHEESE",
        "Ne se récolte pas : il se fabrique. Bâtissez une laiterie, elle transforme votre lait toute seule, cent hectolitres pour la tonne. Il ne s’abîme pas, contrairement au lait.",
        "Marché. Éleveur : la façon de ne plus regarder son lait se gâter.",
      ),
      goodEntry(
        "FLOUR",
        "Sortie du moulin, quatre tonnes de blé pour trois de farine. Le moulin puise dans votre silo pendant que vous êtes ailleurs.",
        "Marché. Céréalier : un tiers de valeur en plus, si le cours de la farine suit.",
      ),
      goodEntry(
        "MANURE",
        "Reste à côté du bâtiment. Épandez-le (outil Ferti) ou vendez-le au voisin. Fosse pleine : les bêtes sont moins bien.",
        "Céréalier (azote). Éleveur (doit vider la fosse). On le vend au voisin, pas à l’hôtel des ventes.",
      ),
      {
        id: "SLURRY",
        name: "Lisier liquide",
        how: "La tonne à lisier, plus tard. Pour l’instant, c’est le fumier solide.",
        usedBy: "Céréalier. Éleveur.",
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
        name: "Silo à grain · 1 200 TRN · 2×2",
        how: "Sans silo, le grain se vend tout de suite, moins cher. Avec un silo : stocker, sécher, vendre au bon moment.",
        usedBy: "Céréalier. Premier bâtiment à viser après la vente.",
      },
      {
        id: "HAY_BARN",
        name: "Hangar paille / foin · 900 TRN · 2×2",
        how: "Stocke fourrages, séchage doux.",
        usedBy: "Éleveur. Céréalier qui vendra du foin et de la paille.",
      },
      {
        id: "DAIRY",
        name: "Laiterie · 13 000 TRN · 2×2",
        how: "Transforme 25 hL de lait par jour en fromage. Elle travaille pendant que vous êtes ailleurs, et le fromage ne se gâte pas.",
        usedBy: "Éleveur installé. Regardez la marge au Bureau : si le lait flambe, elle travaille à perte.",
      },
      {
        id: "MILL",
        name: "Moulin · 4 000 TRN · 2×2",
        how: "Moud 2 t de blé par jour en farine. Il puise dans le silo, donc il en faut un.",
        usedBy: "Céréalier installé. Un tiers de valeur en plus sur ce qu’il moud.",
      },
      {
        id: "MACHINE_SHED",
        name: "Hangar matériel · 1 500 TRN · 3×2",
        how: "Range jusqu’à 6 engins sans encombrer la cour.",
        usedBy: "Dès la deuxième machine.",
      },
      {
        id: "CATTLE_BARN",
        name: "Étable bovins · 2 800 TRN · 3×3",
        how: "12 places, traite, reproduction. Sans elle, pas de vaches.",
        usedBy: "Éleveur.",
      },
      {
        id: "PIGSTY",
        name: "Porcherie · 2 200 TRN · 2×3",
        how: "20 places. Viande plutôt que lait.",
        usedBy: "Éleveur.",
      },
      {
        id: "HENHOUSE",
        name: "Poulailler · 1 400 TRN · 2×2",
        how: "24 places. Le revenu, c’est l’œuf, pas la viande.",
        usedBy: "Éleveur.",
      },
      {
        id: "SHEEPFOLD",
        name: "Bergerie · 2 000 TRN · 3×2",
        how: "16 places. On tond la laine ; la viande vient après.",
        usedBy: "Éleveur.",
      },
      {
        id: "COLD_ROOM",
        name: "Chambre froide · 2 600 TRN · 2×2",
        how: "Ralentit de 40 % la perte du lait, de la viande et des œufs.",
        usedBy: "Éleveur qui ne vend pas dans la minute.",
      },
      {
        id: "WORKSHOP",
        name: "Atelier · 1 100 TRN · 2×2",
        how: "Répare moins cher. Graisse et nettoyage pour tout le monde.",
        usedBy: "Utile dès qu’on a une machine.",
      },
      {
        id: "FARMHOUSE",
        name: "Maison d’exploitation · 2 000 TRN · 2×2",
        how: "Siège : +2 % d’XP.",
        usedBy: "Tous.",
      },
      {
        id: "PADDOCK",
        name: "Enclos de pâture · 1 210 TRN · 3×3",
        how: "À coller contre l’étable. Les bêtes au pré, le lait monte.",
        usedBy: "Éleveur.",
      },
      {
        id: "PIG_YARD",
        name: "Courette à porcs · 780 TRN · 2×3",
        how: "À coller contre la porcherie.",
        usedBy: "Éleveur.",
      },
      {
        id: "HEN_YARD",
        name: "Courette à poules · 520 TRN · 2×3",
        how: "À coller contre le poulailler. Les poules picorent, elles pondent mieux.",
        usedBy: "Éleveur.",
      },
      {
        id: "BUNKER_SILO",
        name: "Silo couloir · 1 400 TRN · 3×2",
        how: "Tasse ensilage et paille. Le fourrage d’hiver a besoin d’une place.",
        usedBy: "Éleveur. Céréalier qui ensile pour vendre au voisin.",
      },
    ],
  },
  {
    id: "machines",
    title: "Machines",
    lead: "Sans la bonne machine, le geste est refusé — ou vous payez quelqu’un, contre des terrons.",
    entries: [
      {
        id: "TRACTOR",
        name: "Tracteur T1 · 2 800 TRN",
        how: "Semis, labour, ferti, ramassage des bottes.",
        usedBy: "Les deux métiers. Idle, il va aussi chez le voisin.",
      },
      {
        id: "HARVESTER",
        name: "Moissonneuse T1 · 4 000 TRN",
        how: "Récolte. On ne la donne pas au départ : demandez de l’aide, ou achetez-la plus tard.",
        usedBy: "Céréalier (ou il fait venir quelqu’un). Chantier le plus demandé.",
      },
      {
        id: "SPREADER",
        name: "Épandeur T1 · 1 500 TRN",
        how: "Fertilisation plus douce pour la machine que le tracteur.",
        usedBy: "Céréalier. Missions d’épandage.",
      },
      {
        id: "DISC_HARROW",
        name: "Déchaumeur · 1 600 TRN",
        how: "Enterre les chaumes.",
        usedBy: "Céréalier. Pour nettoyer le sol après la récolte.",
      },
      {
        id: "BALER",
        name: "Presse à balles · 1 800 TRN",
        how: "Presse l’andain en bottes. Sans elle, la paille reste au champ.",
        usedBy: "Céréalier. Missions de pressage. L’éleveur achète les bottes.",
      },
      {
        id: "FORAGE_HARVESTER",
        name: "Ensileuse T1 · 4 200 TRN",
        how: "Maïs plante entière, avant la maturité grain. Plus de tonnage, pour le troupeau.",
        usedBy: "Céréalier. Missions d’ensilage.",
      },
    ],
  },
  {
    id: "herd",
    title: "Troupeau",
    lead: "L’élevage ne pousse pas tout seul : ration, bonheur, froid. L’éleveur achète ce que le céréalier vend.",
    entries: [
      {
        id: "feed",
        name: "Nourrir",
        how: "Fourrage, ensilage, maïs, orge ou blé. Les poules aiment l’orge et le blé ; les moutons, le foin.",
        usedBy: "Éleveur. Céréalier : débouché pour le grain et l’herbe.",
      },
      {
        id: "milk-job",
        name: "Traire",
        how: "Onglet Élevage, sur un troupeau bovin nourri.",
        usedBy: "Éleveur.",
      },
      {
        id: "collect-eggs",
        name: "Ramasser les œufs",
        how: "Onglet Élevage, sur un poulailler. Souvent, peu à la fois. Ça se gâte.",
        usedBy: "Éleveur.",
      },
      {
        id: "shear",
        name: "Tondre",
        how: "Onglet Élevage, sur une bergerie. La laine ne se gâte pas.",
        usedBy: "Éleveur.",
      },
      {
        id: "graze",
        name: "Sortir au pré",
        how: "Enclos collé à l’étable. Le bonheur monte, le lait aussi.",
        usedBy: "Éleveur.",
      },
      {
        id: "manure-pit",
        name: "Fosse à fumier",
        how: "Le tas grossit tout seul. Épandez (Ferti) ou vendez au voisin. À 80 %, ça sent ; à 100 %, plus rien n’entre.",
        usedBy: "Éleveur. Céréalier : azote moins cher que l’engrais du magasin.",
      },
      {
        id: "cold",
        name: "Chambre froide",
        how: "Ralentit la perte du lait, de la viande et des œufs de 40 %.",
        usedBy: "Éleveur qui ne vend pas dans la minute.",
      },
    ],
  },
  {
    id: "triangle",
    title: "Cultiver, élever, aider",
    lead: "Deux métiers. Personne ne gagne tout seul — pendant que ça pousse, allez aider un voisin.",
    entries: [
      {
        id: "cer",
        name: "Céréalier",
        how: "Produit blé, maïs, pois, orge et colza. Moissonne lui-même ou demande de l’aide. Paille et ensilage pour l’éleveur.",
        usedBy: "Nourrit l’éleveur. Occupe les machines des autres aux pics de saison.",
      },
      {
        id: "elv",
        name: "Éleveur",
        how: "Produit lait, viande, œufs, laine et fumier. Achète foin et grain, ou fauche son herbe. Le fumier part au champ du céréalier, ou s’épand chez soi.",
        usedBy: "Achète le grain du céréalier. On peut l’aider à épandre.",
      },
      {
        id: "appoint",
        name: "Aider les voisins",
        how: "Ce n’est pas un métier. Missions → un travail de 8 à 24 cases chez un voisin. Un peu d’argent, pas une rente.",
        usedBy: "Les deux, pendant que les cultures poussent ou que le troupeau mange.",
      },
      {
        id: "npc",
        name: "Pas la machine du moment ?",
        how: "Un joueur fera mieux. Si personne ne vient, on envoie quelqu’un. Demandez de l’aide, ou « Payer quelqu’un ».",
        usedBy: "Céréalier et éleveur sans la machine sous la main.",
      },
    ],
  },
];
