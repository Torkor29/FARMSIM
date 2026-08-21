/**
 * L'arbre de compétences — ce que la ferme sait faire, et pourquoi.
 *
 * Le jeu demandait au joueur, à l'inscription, s'il serait céréalier ou
 * éleveur. Le choix ne verrouillait pourtant **rien** : rien n'a jamais empêché
 * un céréalier de bâtir une étable ni un éleveur de semer. Il ne filtrait que
 * les quêtes et les objectifs du guide — autrement dit, il cachait la moitié du
 * jeu à chacun tout en la laissant jouable. C'était le pire des deux mondes :
 * l'impression d'une classe, sans la substance d'une classe.
 *
 * On retire donc le choix, et on le remplace par ce que le joueur **fait**.
 *
 * ## Trois règles, et elles se tiennent
 *
 * **1. Rien ne se dépense.** Pas de points à placer : une compétence s'ouvre
 * quand sa condition est remplie, point. Le joueur n'arbitre pas, il pratique.
 *
 * **2. Rien ne se stocke.** L'état des compétences est une **fonction pure** de
 * l'état de la ferme — compteurs cumulés, bâtiments, parc, troupeau. C'est le
 * principe déjà écrit dans `quests.ts` : « l'avancement se déduit, il ne se
 * stocke pas ». Il n'y a donc rien à synchroniser, donc rien qui puisse se
 * désynchroniser, et rien à migrer.
 *
 * **3. Ce qui se perd se reperd.** Vendre l'étable referme les compétences
 * d'élevage **et tout ce qui en dépend**, en cascade. C'est la conséquence
 * directe de la règle 2, et c'est voulu : une compétence dit ce que la ferme
 * sait faire *aujourd'hui*, pas ce qu'elle a su un jour.
 *
 * Attention à ne pas s'en effrayer : les conditions assises sur un **compteur
 * cumulé** (semer cent cases) ne redescendent jamais. Seules les conditions
 * d'**état** (posséder, héberger) peuvent se perdre. C'est exactement la
 * frontière qu'on veut — le savoir-faire reste, l'outillage se perd.
 *
 * ## Ce module ne sait rien du serveur
 *
 * Il ne connaît ni Prisma, ni les routes : il reçoit un instantané et rend un
 * verdict. C'est ce qui permet de l'éprouver sans base, et à l'écran d'afficher
 * exactement ce que le serveur calculera.
 */

import type { BuildingType, MachineType } from "./index.js";
import type { AnimalKind } from "./livestock.js";
import type { PlayerStats, StatKey } from "./quests.js";

/* ------------------------------------------------------------------ */
/* L'instantané dont vivent les conditions                             */
/* ------------------------------------------------------------------ */

/**
 * Tout ce qu'une condition a le droit de regarder.
 *
 * Volontairement étroit. Une condition qui aurait besoin d'autre chose est
 * une condition qu'on ne sait pas alimenter honnêtement — et un compteur
 * jamais alimenté est un verrou que le joueur ne peut pas ouvrir. Le jeu en
 * portait déjà un : la quête « Nourrir le troupeau » attendait dix rations sur
 * un compteur que personne n'incrémentait.
 */
export type SkillSnapshot = {
  /** Compteurs cumulés de travail. Ne redescendent jamais. */
  stats: PlayerStats;
  /** Niveau du joueur. */
  level: number;
  /** Bâtiments possédés, avec leur palier. */
  buildings: { type: BuildingType; level: number }[];
  /** Parc matériel, avec palier et heures au compteur. */
  machines: { type: MachineType; tier: number; hours: number }[];
  /** Troupeaux hébergés, par espèce. */
  herds: { species: AnimalKind; size: number }[];
};

export function emptySnapshot(): SkillSnapshot {
  return { stats: {}, level: 1, buildings: [], machines: [], herds: [] };
}

/* ------------------------------------------------------------------ */
/* Les conditions, composables                                         */
/* ------------------------------------------------------------------ */

/**
 * Une condition de déblocage.
 *
 * `all` et `any` en font un arbre : « semer cent cases **et** posséder un
 * semoir », « moissonner mille tonnes **ou** posséder une moissonneuse de
 * palier 3 ». Ajouter une compétence ne demande donc jamais de toucher au
 * moteur — seulement d'écrire sa condition.
 */
export type SkillCondition =
  /** Un compteur cumulé a atteint un seuil. */
  | { kind: "stat"; stat: StatKey; atLeast: number }
  /** Posséder un bâtiment, éventuellement à un palier donné. */
  | { kind: "building"; building: BuildingType; level?: number }
  /** Posséder une machine, éventuellement à un palier donné. */
  | { kind: "machine"; machine: MachineType; tier?: number }
  /** Avoir accumulé des heures — sur une machine précise, ou sur tout le parc. */
  | { kind: "machineHours"; machine?: MachineType; atLeast: number }
  /** Héberger des bêtes — d'une espèce, ou toutes espèces confondues. */
  | { kind: "herd"; species?: AnimalKind; atLeast: number }
  /** Avoir atteint un niveau. */
  | { kind: "level"; atLeast: number }
  /** Tenir une autre compétence — c'est ce qui fait les branches. */
  | { kind: "skill"; skill: SkillId }
  | { kind: "all"; of: SkillCondition[] }
  | { kind: "any"; of: SkillCondition[] };

/* ------------------------------------------------------------------ */
/* Les effets                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ce qu'une compétence change, vraiment.
 *
 * Chaque genre correspond à un levier qui **existe déjà** dans le jeu et qui
 * est déjà branché quelque part. Aucun effet décoratif : si on ne sait pas où
 * l'appliquer, on ne l'écrit pas.
 */
export type SkillEffectKind =
  /** Rendement des cultures, en fraction. */
  | "CROP_YIELD"
  /** Gazole consommé par les chantiers, en fraction retirée. */
  | "FUEL_USE"
  /** Usure des machines, en fraction retirée. */
  | "WEAR"
  /** Prix des réparations et de l'entretien, en fraction retirée. */
  | "REPAIR_COST"
  /** Durée des chantiers, en fraction retirée. */
  | "WORK_SPEED"
  /** Production laitière, en fraction. */
  | "MILK_YIELD"
  /** Ponte, en fraction. */
  | "EGG_YIELD"
  /** Tonte, en fraction. */
  | "WOOL_YIELD"
  /** Ration consommée par les bêtes, en fraction retirée. */
  | "FEED_USE"
  /** Bien-être du troupeau, en points de bonheur. */
  | "ANIMAL_HAPPINESS"
  /** Capacité de stockage du grain, en tonnes. */
  | "STORAGE_GRAIN"
  /** Lenteur de la dégradation au stock, en fraction. */
  | "SPOILAGE_SLOW"
  /** Prix de vente obtenu, en fraction. */
  | "SALE_PRICE";

export type SkillEffect = { kind: SkillEffectKind; value: number };

/**
 * Le plafond de chaque levier, **pour les compétences seules**.
 *
 * Les bâtiments ont déjà leur propre enveloppe — `getFarmBonuses` borne le
 * rendement à +10 % et la remise d'atelier à 30 %. Les compétences ne s'y
 * ajoutent pas : elles ont la leur. Sans quoi il aurait fallu relever le
 * plafond commun, ce qui aurait dévalué tous les bâtiments d'un coup.
 *
 * Deux enveloppes qui s'additionnent restent lisibles ; une enveloppe unique
 * qu'on relève réécrit silencieusement l'équilibre de tout ce qui existe.
 */
export const SKILL_EFFECT_CAPS: Record<SkillEffectKind, number> = {
  CROP_YIELD: 0.15,
  FUEL_USE: 0.2,
  WEAR: 0.25,
  REPAIR_COST: 0.2,
  WORK_SPEED: 0.15,
  MILK_YIELD: 0.2,
  EGG_YIELD: 0.2,
  WOOL_YIELD: 0.2,
  FEED_USE: 0.2,
  ANIMAL_HAPPINESS: 0.12,
  // Une capacité, pas une fraction : c'est un nombre de tonnes.
  STORAGE_GRAIN: 60,
  SPOILAGE_SLOW: 0.2,
  SALE_PRICE: 0.08,
};

export type SkillBonuses = Record<SkillEffectKind, number>;

export function noSkillBonuses(): SkillBonuses {
  return {
    CROP_YIELD: 0,
    FUEL_USE: 0,
    WEAR: 0,
    REPAIR_COST: 0,
    WORK_SPEED: 0,
    MILK_YIELD: 0,
    EGG_YIELD: 0,
    WOOL_YIELD: 0,
    FEED_USE: 0,
    ANIMAL_HAPPINESS: 0,
    STORAGE_GRAIN: 0,
    SPOILAGE_SLOW: 0,
    SALE_PRICE: 0,
  };
}

/* ------------------------------------------------------------------ */
/* La définition d'une compétence                                      */
/* ------------------------------------------------------------------ */

/** Les grandes branches de l'arbre. Deux visuelles, deux transversales. */
export type SkillBranch = "FIELD" | "LIVESTOCK" | "MACHINE" | "TRADE";

export const BRANCH_LABELS: Record<SkillBranch, string> = {
  FIELD: "Cultures",
  LIVESTOCK: "Élevage",
  MACHINE: "Matériel",
  TRADE: "Récolte et vente",
};

export const BRANCH_ICONS: Record<SkillBranch, string> = {
  FIELD: "🌾",
  LIVESTOCK: "🐄",
  MACHINE: "🚜",
  TRADE: "⚖️",
};

export type SkillDef = {
  id: SkillId;
  name: string;
  /** Ce que ça veut dire, en langage de ferme. */
  description: string;
  branch: SkillBranch;
  /** Profondeur dans la branche : 1 s'ouvre tôt, 4 est un aboutissement. */
  tier: 1 | 2 | 3 | 4;
  /**
   * Nom du dessin, sans chemin ni extension.
   *
   * Le module reste ignorant de l'endroit où vivent les fichiers : c'est
   * l'écran qui sait qu'ils sont sous `/assets/icons/skills`. Sans quoi une
   * réorganisation des dossiers ferait bouger le règlement du jeu.
   */
  icon: string;
  condition: SkillCondition;
  effects: SkillEffect[];
};

/** Où vivent les dessins. Un seul endroit à changer si les dossiers bougent. */
export const SKILL_ICON_DIR = "/assets/icons/skills";

export function skillIconSrc(icon: string): string {
  return `${SKILL_ICON_DIR}/${icon}.svg`;
}

export const BRANCH_ICON_FILES: Record<SkillBranch, string> = {
  FIELD: "branch-field",
  LIVESTOCK: "branch-livestock",
  MACHINE: "branch-machine",
  TRADE: "branch-trade",
};

export type SkillId =
  /* —— Cultures —————————————————————————————————————————————— */
  | "SOWING_BASICS"
  | "IMPROVED_SEED"
  | "SOWING_MASTERY"
  | "STUBBLE_WORK"
  | "RESIDUE_MASTERY"
  | "PLOUGHING"
  | "DEEP_TILLAGE"
  | "FERTILISING"
  | "MANURE_PLAN"
  | "WEED_CONTROL"
  | "INTEGRATED_WEEDING"
  | "ROTATION"
  | "AGRONOMY"
  /* —— Élevage ——————————————————————————————————————————————— */
  | "ANIMAL_KEEPING"
  | "FEED_PLAN"
  | "FEED_MASTERY"
  | "HERD_COMFORT"
  | "MILKING"
  | "DAIRY_CRAFT"
  | "EGG_PRODUCTION"
  | "WOOL_PRODUCTION"
  | "PIG_KEEPING"
  | "LARGE_HERD"
  | "STOCKMANSHIP"
  /* —— Matériel —————————————————————————————————————————————— */
  | "MACHINE_UPKEEP"
  | "GREASE_ROUTINE"
  | "WORKSHOP_HAND"
  | "FUEL_DISCIPLINE"
  | "SEASONED_DRIVER"
  | "FLEET_MASTERY"
  | "SHED_LOGISTICS"
  /* —— Récolte et vente —————————————————————————————————————— */
  | "HARVEST_BASICS"
  | "HARVEST_MASTERY"
  | "GRAIN_STORAGE"
  | "STORAGE_MASTERY"
  | "MARKET_SENSE"
  | "NEGOTIATION"
  | "HAULAGE"
  | "COMPLETE_FARMER";

/* ------------------------------------------------------------------ */
/* L'arbre                                                             */
/* ------------------------------------------------------------------ */

/** Raccourcis d'écriture : une condition doit se lire d'un coup d'œil. */
const stat = (s: StatKey, atLeast: number): SkillCondition => ({ kind: "stat", stat: s, atLeast });
const has = (building: BuildingType, level?: number): SkillCondition => ({
  kind: "building",
  building,
  ...(level === undefined ? {} : { level }),
});
const owns = (machine: MachineType, tier?: number): SkillCondition => ({
  kind: "machine",
  machine,
  ...(tier === undefined ? {} : { tier }),
});
const hours = (atLeast: number, machine?: MachineType): SkillCondition => ({
  kind: "machineHours",
  atLeast,
  ...(machine === undefined ? {} : { machine }),
});
const herd = (atLeast: number, species?: AnimalKind): SkillCondition => ({
  kind: "herd",
  atLeast,
  ...(species === undefined ? {} : { species }),
});
const after = (skill: SkillId): SkillCondition => ({ kind: "skill", skill });
const all = (...of: SkillCondition[]): SkillCondition => ({ kind: "all", of });
const any = (...of: SkillCondition[]): SkillCondition => ({ kind: "any", of });

/**
 * Le catalogue.
 *
 * Les seuils montent vite : la première marche d'une branche se franchit dans
 * la première demi-heure, la dernière demande des semaines. C'est délibéré —
 * un arbre qu'on termine en une soirée n'est pas une progression, c'est une
 * liste de courses.
 *
 * Chaque condition est branchée sur une donnée que le jeu produit vraiment.
 * Là où le compteur manquait, il a été ajouté à la route correspondante plutôt
 * qu'inventé ici.
 */
export const SKILL_DEFS: SkillDef[] = [
  /* ================================================================ */
  /* Cultures                                                          */
  /* ================================================================ */
  {
    id: "SOWING_BASICS",
    name: "Tour de main du semis",
    description: "À force de passer le semoir, on ne perd plus une graine en bout de rang.",
    branch: "FIELD",
    tier: 1,
    icon: "seed",
    condition: stat("cellsPlanted", 24),
    effects: [{ kind: "CROP_YIELD", value: 0.01 }],
  },
  {
    id: "IMPROVED_SEED",
    name: "Semences triées",
    description: "On garde les meilleurs lots pour ressemer. Le champ lève plus dru.",
    branch: "FIELD",
    tier: 2,
    icon: "seed-plus",
    condition: all(after("SOWING_BASICS"), stat("cellsPlanted", 150), owns("SEEDER")),
    effects: [{ kind: "CROP_YIELD", value: 0.02 }],
  },
  {
    id: "SOWING_MASTERY",
    name: "Maîtrise du semis",
    description: "Profondeur, densité, date : plus rien n'est laissé au hasard.",
    branch: "FIELD",
    tier: 3,
    icon: "seed-plus",
    condition: all(after("IMPROVED_SEED"), stat("cellsPlanted", 600), owns("SEEDER", 2)),
    effects: [{ kind: "CROP_YIELD", value: 0.03 }],
  },
  {
    id: "STUBBLE_WORK",
    name: "Déchaumage",
    description: "Les résidus rentrent au lieu de sécher sur place.",
    branch: "FIELD",
    tier: 1,
    icon: "harrow",
    condition: stat("cellsStubbled", 30),
    effects: [{ kind: "CROP_YIELD", value: 0.01 }],
  },
  {
    id: "RESIDUE_MASTERY",
    name: "Gestion des résidus",
    description: "La paille enfouie au bon moment nourrit la terre au lieu de l'étouffer.",
    branch: "FIELD",
    tier: 2,
    icon: "harrow",
    condition: all(after("STUBBLE_WORK"), stat("cellsStubbled", 250), owns("DISC_HARROW")),
    effects: [{ kind: "CROP_YIELD", value: 0.02 }],
  },
  {
    id: "PLOUGHING",
    name: "Labour",
    description: "Le trait est droit, la raie est propre, le sol repart à neuf.",
    branch: "FIELD",
    tier: 1,
    icon: "plough",
    condition: stat("cellsPlowed", 40),
    effects: [{ kind: "FUEL_USE", value: 0.03 }],
  },
  {
    id: "DEEP_TILLAGE",
    name: "Travail profond",
    description: "On descend là où il faut, et pas plus bas : le gazole suit.",
    branch: "FIELD",
    tier: 2,
    icon: "plough",
    condition: all(after("PLOUGHING"), stat("cellsPlowed", 300), owns("PLOUGH", 2)),
    effects: [
      { kind: "FUEL_USE", value: 0.05 },
      { kind: "CROP_YIELD", value: 0.01 },
    ],
  },
  {
    id: "FERTILISING",
    name: "Fertilisation raisonnée",
    description: "On apporte ce qui manque, quand ça manque.",
    branch: "FIELD",
    tier: 1,
    icon: "fertiliser",
    condition: stat("cellsFertilized", 30),
    effects: [{ kind: "CROP_YIELD", value: 0.01 }],
  },
  {
    id: "MANURE_PLAN",
    name: "Plan d'épandage",
    description: "Le fumier du troupeau part au champ au lieu de s'entasser dans la cour.",
    branch: "FIELD",
    tier: 3,
    icon: "fertiliser",
    // La première passerelle entre les deux mondes : elle ne s'ouvre qu'à qui
    // cultive **et** élève. C'est l'inverse exact d'un choix exclusif.
    condition: all(after("FERTILISING"), stat("cellsFertilized", 200), herd(4)),
    effects: [{ kind: "CROP_YIELD", value: 0.02 }],
  },
  {
    id: "WEED_CONTROL",
    name: "Désherbage",
    description: "On passe avant que l'adventice monte en graine.",
    branch: "FIELD",
    tier: 1,
    icon: "sprayer",
    condition: all(stat("cellsWeeded", 20), owns("SPRAYER")),
    effects: [{ kind: "CROP_YIELD", value: 0.01 }],
  },
  {
    id: "INTEGRATED_WEEDING",
    name: "Désherbage intégré",
    description: "Faux-semis, rotation, pulvérisateur : trois leviers plutôt qu'un.",
    branch: "FIELD",
    tier: 3,
    icon: "sprayer",
    condition: all(after("WEED_CONTROL"), stat("cellsWeeded", 150), after("ROTATION")),
    effects: [{ kind: "CROP_YIELD", value: 0.02 }],
  },
  {
    id: "ROTATION",
    name: "Rotation des cultures",
    description: "Céréale, légumineuse, oléagineux : le sol ne s'épuise plus sur un seul poste.",
    branch: "FIELD",
    tier: 2,
    icon: "rotation",
    condition: all(stat("cellsPlanted", 200), stat("cellsHarvested", 120)),
    effects: [{ kind: "CROP_YIELD", value: 0.02 }],
  },
  {
    id: "AGRONOMY",
    name: "Agronomie",
    description: "La parcelle se lit comme un carnet : on sait ce qu'elle va donner avant de semer.",
    branch: "FIELD",
    tier: 4,
    icon: "agronomy",
    condition: all(after("SOWING_MASTERY"), after("ROTATION"), after("RESIDUE_MASTERY"), stat("tonsHarvested", 800)),
    effects: [{ kind: "CROP_YIELD", value: 0.03 }],
  },

  /* ================================================================ */
  /* Élevage                                                           */
  /* ================================================================ */
  {
    id: "ANIMAL_KEEPING",
    name: "Conduite du troupeau",
    description: "Sortir, rentrer, compter : le geste devient une habitude.",
    branch: "LIVESTOCK",
    tier: 1,
    icon: "herd",
    condition: all(herd(1), stat("grazings", 5)),
    effects: [{ kind: "ANIMAL_HAPPINESS", value: 0.02 }],
  },
  {
    id: "FEED_PLAN",
    name: "Ration équilibrée",
    description: "Foin, céréale, ensilage : chacun sa part, rien ne se gaspille.",
    branch: "LIVESTOCK",
    tier: 2,
    icon: "feed",
    condition: all(after("ANIMAL_KEEPING"), stat("feedings", 20)),
    effects: [{ kind: "FEED_USE", value: 0.05 }],
  },
  {
    id: "FEED_MASTERY",
    name: "Alimentation optimisée",
    description: "La ration suit la saison et l'état des bêtes, pas le calendrier.",
    branch: "LIVESTOCK",
    tier: 3,
    icon: "feed",
    condition: all(after("FEED_PLAN"), stat("feedings", 120), any(has("BUNKER_SILO"), has("HAY_BARN", 3))),
    effects: [
      { kind: "FEED_USE", value: 0.08 },
      { kind: "MILK_YIELD", value: 0.02 },
    ],
  },
  {
    id: "HERD_COMFORT",
    name: "Confort des animaux",
    description: "Litière propre, place à l'auge, accès au pré : des bêtes calmes produisent mieux.",
    branch: "LIVESTOCK",
    tier: 2,
    icon: "comfort",
    condition: all(after("ANIMAL_KEEPING"), stat("grazings", 40), any(has("PADDOCK"), has("CATTLE_BARN", 2))),
    effects: [{ kind: "ANIMAL_HAPPINESS", value: 0.04 }],
  },
  {
    id: "MILKING",
    name: "Traite",
    description: "Deux passages par jour, sans énerver personne.",
    branch: "LIVESTOCK",
    tier: 1,
    icon: "milk",
    condition: all(herd(1, "COW"), stat("animalsCollected", 10)),
    effects: [{ kind: "MILK_YIELD", value: 0.03 }],
  },
  {
    id: "DAIRY_CRAFT",
    name: "Métier du lait",
    description: "Refroidissement, hygiène, régularité : le litre gagne en valeur.",
    branch: "LIVESTOCK",
    tier: 3,
    icon: "milk",
    condition: all(after("MILKING"), stat("hlCollected", 200), has("DAIRY")),
    effects: [
      { kind: "MILK_YIELD", value: 0.06 },
      { kind: "SALE_PRICE", value: 0.02 },
    ],
  },
  {
    id: "EGG_PRODUCTION",
    name: "Conduite du poulailler",
    description: "Lumière, calme, ramassage régulier : la ponte suit.",
    branch: "LIVESTOCK",
    tier: 2,
    icon: "egg",
    condition: all(herd(6, "HEN"), has("HENHOUSE")),
    effects: [{ kind: "EGG_YIELD", value: 0.05 }],
  },
  {
    id: "WOOL_PRODUCTION",
    name: "Conduite du troupeau ovin",
    description: "La tonte au bon moment donne une laine propre et longue.",
    branch: "LIVESTOCK",
    tier: 2,
    icon: "wool",
    condition: all(herd(6, "SHEEP"), has("SHEEPFOLD")),
    effects: [{ kind: "WOOL_YIELD", value: 0.05 }],
  },
  {
    id: "PIG_KEEPING",
    name: "Conduite de l'élevage porcin",
    description: "Un atelier qui valorise la céréale de la ferme au lieu de la vendre brute.",
    branch: "LIVESTOCK",
    tier: 2,
    icon: "pig",
    condition: all(herd(6, "PIG"), has("PIGSTY")),
    effects: [{ kind: "FEED_USE", value: 0.04 }],
  },
  {
    id: "LARGE_HERD",
    name: "Grand troupeau",
    description: "Conduire trente bêtes n'est pas conduire trois : il faut de la méthode.",
    branch: "LIVESTOCK",
    tier: 3,
    icon: "herd",
    condition: all(after("HERD_COMFORT"), herd(30)),
    effects: [{ kind: "ANIMAL_HAPPINESS", value: 0.03 }],
  },
  {
    id: "STOCKMANSHIP",
    name: "Œil de l'éleveur",
    description: "On voit la bête qui couve quelque chose avant qu'elle ne le montre.",
    branch: "LIVESTOCK",
    tier: 4,
    icon: "stockman",
    condition: all(after("FEED_MASTERY"), after("LARGE_HERD"), stat("animalsCollected", 400)),
    effects: [
      { kind: "ANIMAL_HAPPINESS", value: 0.03 },
      { kind: "MILK_YIELD", value: 0.04 },
    ],
  },

  /* ================================================================ */
  /* Matériel                                                          */
  /* ================================================================ */
  {
    id: "MACHINE_UPKEEP",
    name: "Entretien courant",
    description: "Un coup d'œil aux niveaux avant de partir, et la panne n'arrive pas.",
    branch: "MACHINE",
    tier: 1,
    icon: "wrench",
    condition: stat("machinesServiced", 3),
    effects: [{ kind: "WEAR", value: 0.04 }],
  },
  {
    id: "GREASE_ROUTINE",
    name: "Graissage méthodique",
    description: "Tous les points, à chaque chantier. C'est long, ça double la vie d'un outil.",
    branch: "MACHINE",
    tier: 2,
    icon: "grease",
    condition: all(after("MACHINE_UPKEEP"), stat("machinesServiced", 20)),
    effects: [{ kind: "WEAR", value: 0.08 }],
  },
  {
    id: "WORKSHOP_HAND",
    name: "Mécanique de ferme",
    description: "On répare soi-même ce qui ne demande pas le concessionnaire.",
    branch: "MACHINE",
    tier: 3,
    icon: "workshop",
    condition: all(after("GREASE_ROUTINE"), has("WORKSHOP"), stat("machinesServiced", 60)),
    effects: [{ kind: "REPAIR_COST", value: 0.1 }],
  },
  {
    id: "FUEL_DISCIPLINE",
    name: "Conduite économe",
    description: "Le bon régime, la bonne vitesse : le réservoir dure plus longtemps.",
    branch: "MACHINE",
    tier: 2,
    icon: "fuel",
    condition: hours(60),
    effects: [{ kind: "FUEL_USE", value: 0.05 }],
  },
  {
    id: "SEASONED_DRIVER",
    name: "Chauffeur aguerri",
    description: "Les demi-tours se font sans temps mort. Le chantier avance.",
    branch: "MACHINE",
    tier: 3,
    icon: "steering",
    condition: all(after("FUEL_DISCIPLINE"), hours(250)),
    effects: [{ kind: "WORK_SPEED", value: 0.06 }],
  },
  {
    id: "FLEET_MASTERY",
    name: "Conduite de parc",
    description: "Chaque outil part quand il faut, et rentre avant d'être à bout.",
    branch: "MACHINE",
    tier: 4,
    icon: "steering",
    condition: all(after("WORKSHOP_HAND"), after("SEASONED_DRIVER"), hours(600)),
    effects: [
      { kind: "WEAR", value: 0.08 },
      { kind: "WORK_SPEED", value: 0.05 },
    ],
  },
  {
    id: "SHED_LOGISTICS",
    name: "Rangement du hangar",
    description: "Un parc abrité et rangé s'use moins et se sort plus vite.",
    branch: "MACHINE",
    tier: 2,
    icon: "shed",
    condition: all(has("MACHINE_SHED"), stat("machinesServiced", 10)),
    effects: [{ kind: "WEAR", value: 0.05 }],
  },

  /* ================================================================ */
  /* Récolte et vente                                                  */
  /* ================================================================ */
  {
    id: "HARVEST_BASICS",
    name: "Moisson",
    description: "Régler le bec de coupe, et laisser moins de grain derrière soi.",
    branch: "TRADE",
    tier: 1,
    icon: "combine",
    condition: stat("cellsHarvested", 30),
    effects: [{ kind: "CROP_YIELD", value: 0.01 }],
  },
  {
    id: "HARVEST_MASTERY",
    name: "Maîtrise de la moisson",
    description: "On moissonne au bon degré d'humidité, pas au bon moment de la semaine.",
    branch: "TRADE",
    tier: 3,
    icon: "combine",
    condition: all(after("HARVEST_BASICS"), stat("tonsHarvested", 400), owns("HARVESTER", 2)),
    effects: [{ kind: "CROP_YIELD", value: 0.02 }],
  },
  {
    id: "GRAIN_STORAGE",
    name: "Conduite du silo",
    description: "Ventiler, surveiller, ne pas mélanger les lots.",
    branch: "TRADE",
    tier: 2,
    icon: "silo",
    condition: all(has("SILO"), stat("tonsHarvested", 100)),
    effects: [
      { kind: "STORAGE_GRAIN", value: 20 },
      { kind: "SPOILAGE_SLOW", value: 0.05 },
    ],
  },
  {
    id: "STORAGE_MASTERY",
    name: "Stockage optimal",
    description: "Le grain attend le bon cours sans perdre un point de qualité.",
    branch: "TRADE",
    tier: 3,
    icon: "silo",
    condition: all(after("GRAIN_STORAGE"), has("SILO", 3), stat("tonsHarvested", 500)),
    effects: [
      { kind: "STORAGE_GRAIN", value: 40 },
      { kind: "SPOILAGE_SLOW", value: 0.1 },
    ],
  },
  {
    id: "MARKET_SENSE",
    name: "Sens du marché",
    description: "On connaît la saison où le cours monte, et on attend.",
    branch: "TRADE",
    tier: 2,
    icon: "market",
    condition: stat("tonsSold", 120),
    effects: [{ kind: "SALE_PRICE", value: 0.02 }],
  },
  {
    id: "NEGOTIATION",
    name: "Négoce",
    description: "Le camion est chargé plein, le contrat est lu jusqu'au bout.",
    branch: "TRADE",
    tier: 3,
    icon: "handshake",
    condition: all(after("MARKET_SENSE"), stat("tonsSold", 600), stat("contracts", 10)),
    effects: [{ kind: "SALE_PRICE", value: 0.03 }],
  },
  {
    id: "HAULAGE",
    name: "Logistique",
    description: "Les livraisons s'enchaînent sans qu'une remorque attende dans la cour.",
    branch: "TRADE",
    tier: 2,
    icon: "truck",
    condition: all(stat("deliveries", 15), owns("TRAILER")),
    effects: [{ kind: "WORK_SPEED", value: 0.04 }],
  },

  /* ================================================================ */
  /* L'aboutissement                                                   */
  /* ================================================================ */
  {
    id: "COMPLETE_FARMER",
    name: "Agriculteur complet",
    description:
      "Les quatre branches tiennent ensemble. La ferme ne dépend plus d'un seul atelier — c'est là que le métier commence vraiment.",
    branch: "TRADE",
    tier: 4,
    icon: "star",
    // Le sommet exige les quatre sommets. C'est le contraire d'un choix de
    // classe : on ne l'atteint qu'en ayant tout pratiqué.
    condition: all(after("AGRONOMY"), after("STOCKMANSHIP"), after("FLEET_MASTERY"), after("NEGOTIATION")),
    effects: [
      { kind: "CROP_YIELD", value: 0.02 },
      { kind: "MILK_YIELD", value: 0.02 },
      { kind: "SALE_PRICE", value: 0.02 },
    ],
  },
];

export const SKILL_BY_ID: Record<SkillId, SkillDef> = Object.fromEntries(
  SKILL_DEFS.map((d) => [d.id, d]),
) as Record<SkillId, SkillDef>;

/* ------------------------------------------------------------------ */
/* L'évaluation                                                        */
/* ------------------------------------------------------------------ */

/** Où en est une condition : de quoi dessiner « 37 / 50 ». */
export type ConditionProgress = {
  /** Ce que le joueur a, ce qu'il lui faut — absents pour un oui/non. */
  have?: number;
  need?: number;
  /** La condition en une phrase, telle qu'elle s'affiche. */
  label: string;
  ok: boolean;
};

export type SkillState = {
  def: SkillDef;
  unlocked: boolean;
  /** Le détail, condition par condition — c'est ce qui dit quoi faire. */
  progress: ConditionProgress[];
  /**
   * Part de la condition déjà remplie, de 0 à 1.
   *
   * Sert à ordonner « ce qui est le plus proche » et à dessiner une jauge
   * unique quand le détail ne tient pas à l'écran.
   */
  ratio: number;
};

function countBuilding(snap: SkillSnapshot, type: BuildingType, level: number): number {
  return snap.buildings.filter((b) => b.type === type && b.level >= level).length;
}

function countMachine(snap: SkillSnapshot, type: MachineType, tier: number): number {
  return snap.machines.filter((m) => m.type === type && m.tier >= tier).length;
}

function totalHours(snap: SkillSnapshot, type?: MachineType): number {
  return snap.machines
    .filter((m) => (type ? m.type === type : true))
    .reduce((somme, m) => somme + Math.max(0, m.hours), 0);
}

function herdSize(snap: SkillSnapshot, species?: AnimalKind): number {
  return snap.herds
    .filter((h) => (species ? h.species === species : true))
    .reduce((somme, h) => somme + Math.max(0, h.size), 0);
}

const SPECIES_LABELS: Record<AnimalKind, string> = {
  COW: "vache(s)",
  PIG: "porc(s)",
  HEN: "poule(s)",
  SHEEP: "brebis",
};

/**
 * Évalue une condition, et dit où on en est.
 *
 * `unlockedSoFar` porte les compétences déjà résolues : c'est ce qui permet
 * aux prérequis de fonctionner sans que le moteur ait à connaître l'arbre.
 */
function evalCondition(
  cond: SkillCondition,
  snap: SkillSnapshot,
  unlockedSoFar: Set<SkillId>,
  statLabel: (s: StatKey) => string,
  out: ConditionProgress[],
): { ok: boolean; ratio: number } {
  switch (cond.kind) {
    case "stat": {
      const have = Math.floor(snap.stats[cond.stat] ?? 0);
      const ok = have >= cond.atLeast;
      out.push({
        have,
        need: cond.atLeast,
        label: statLabel(cond.stat),
        ok,
      });
      return { ok, ratio: Math.min(1, have / Math.max(1, cond.atLeast)) };
    }
    case "building": {
      const niveau = cond.level ?? 1;
      const ok = countBuilding(snap, cond.building, niveau) > 0;
      out.push({
        label: niveau > 1 ? `${cond.building} (palier ${niveau})` : `${cond.building}`,
        ok,
      });
      return { ok, ratio: ok ? 1 : 0 };
    }
    case "machine": {
      const palier = cond.tier ?? 1;
      const ok = countMachine(snap, cond.machine, palier) > 0;
      out.push({
        label: palier > 1 ? `${cond.machine} (palier ${palier})` : `${cond.machine}`,
        ok,
      });
      return { ok, ratio: ok ? 1 : 0 };
    }
    case "machineHours": {
      const have = Math.floor(totalHours(snap, cond.machine));
      const ok = have >= cond.atLeast;
      out.push({
        have,
        need: cond.atLeast,
        label: cond.machine ? `heures de ${cond.machine}` : "heures de travail",
        ok,
      });
      return { ok, ratio: Math.min(1, have / Math.max(1, cond.atLeast)) };
    }
    case "herd": {
      const have = herdSize(snap, cond.species);
      const ok = have >= cond.atLeast;
      out.push({
        have,
        need: cond.atLeast,
        label: cond.species ? SPECIES_LABELS[cond.species] : "bête(s) au troupeau",
        ok,
      });
      return { ok, ratio: Math.min(1, have / Math.max(1, cond.atLeast)) };
    }
    case "level": {
      const ok = snap.level >= cond.atLeast;
      out.push({ have: snap.level, need: cond.atLeast, label: "niveau", ok });
      return { ok, ratio: Math.min(1, snap.level / Math.max(1, cond.atLeast)) };
    }
    case "skill": {
      const ok = unlockedSoFar.has(cond.skill);
      out.push({ label: SKILL_BY_ID[cond.skill]?.name ?? cond.skill, ok });
      return { ok, ratio: ok ? 1 : 0 };
    }
    case "all": {
      let ok = true;
      let somme = 0;
      for (const sous of cond.of) {
        const r = evalCondition(sous, snap, unlockedSoFar, statLabel, out);
        ok = ok && r.ok;
        somme += r.ratio;
      }
      return { ok, ratio: cond.of.length ? somme / cond.of.length : 1 };
    }
    case "any": {
      let ok = false;
      let meilleur = 0;
      for (const sous of cond.of) {
        const r = evalCondition(sous, snap, unlockedSoFar, statLabel, out);
        ok = ok || r.ok;
        meilleur = Math.max(meilleur, r.ratio);
      }
      return { ok, ratio: meilleur };
    }
  }
}

/**
 * L'état de tout l'arbre, pour un instantané donné.
 *
 * Les prérequis se résolvent par passes successives plutôt que par un tri
 * topologique : l'arbre est petit, et une passe de plus coûte moins cher qu'un
 * tri qui se casserait sur un cycle mal écrit. On s'arrête dès qu'une passe
 * n'ouvre plus rien — ce qui, au passage, rend un cycle inoffensif : les
 * compétences qui s'attendent l'une l'autre restent simplement fermées.
 */
export function evaluateSkills(
  snap: SkillSnapshot,
  statLabel: (s: StatKey) => string = (s) => String(s),
): SkillState[] {
  const unlocked = new Set<SkillId>();
  for (let passe = 0; passe < SKILL_DEFS.length; passe++) {
    let ajout = false;
    for (const def of SKILL_DEFS) {
      if (unlocked.has(def.id)) continue;
      const jetable: ConditionProgress[] = [];
      if (evalCondition(def.condition, snap, unlocked, statLabel, jetable).ok) {
        unlocked.add(def.id);
        ajout = true;
      }
    }
    if (!ajout) break;
  }
  // Seconde lecture, une fois l'ensemble stabilisé : le détail affiché doit
  // refléter l'état final, pas celui d'une passe intermédiaire.
  return SKILL_DEFS.map((def) => {
    const progress: ConditionProgress[] = [];
    const r = evalCondition(def.condition, snap, unlocked, statLabel, progress);
    return { def, unlocked: unlocked.has(def.id), progress, ratio: r.ok ? 1 : r.ratio };
  });
}

/** Les seules identités débloquées — pour qui n'a pas besoin du détail. */
export function unlockedSkills(snap: SkillSnapshot): SkillId[] {
  return evaluateSkills(snap)
    .filter((s) => s.unlocked)
    .map((s) => s.def.id);
}

/* ------------------------------------------------------------------ */
/* Les effets, agrégés                                                 */
/* ------------------------------------------------------------------ */

/**
 * Somme les effets des compétences ouvertes, chaque levier borné par le sien.
 *
 * L'enveloppe est **propre aux compétences** : elle ne se mélange pas à celle
 * des bâtiments. Deux enveloppes qui s'additionnent restent lisibles ; une
 * enveloppe unique qu'on relève réécrit en silence l'équilibre de tout ce qui
 * existait avant.
 */
export function skillBonuses(ids: Iterable<SkillId>): SkillBonuses {
  const out = noSkillBonuses();
  for (const id of ids) {
    const def = SKILL_BY_ID[id];
    if (!def) continue;
    for (const e of def.effects) out[e.kind] += e.value;
  }
  for (const cle of Object.keys(out) as SkillEffectKind[]) {
    out[cle] = Math.min(SKILL_EFFECT_CAPS[cle], Math.round(out[cle] * 1e6) / 1e6);
  }
  return out;
}

/** Raccourci : de l'instantané aux bonus, sans passer par le détail. */
export function bonusesFor(snap: SkillSnapshot): SkillBonuses {
  return skillBonuses(unlockedSkills(snap));
}

/** Compte ce qui est ouvert, par branche — pour l'en-tête de l'écran. */
export function branchTally(states: SkillState[]): Record<SkillBranch, { open: number; total: number }> {
  const out = {
    FIELD: { open: 0, total: 0 },
    LIVESTOCK: { open: 0, total: 0 },
    MACHINE: { open: 0, total: 0 },
    TRADE: { open: 0, total: 0 },
  };
  for (const s of states) {
    out[s.def.branch].total++;
    if (s.unlocked) out[s.def.branch].open++;
  }
  return out;
}
