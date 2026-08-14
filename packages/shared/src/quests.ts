import type { Specialization } from "./index.js";

/**
 * Les objectifs du joueur — de vraies quêtes, avec un état et une récompense.
 *
 * Il en existait onze, mais ce n'étaient que des prédicats évalués côté client
 * sur un instantané de la ferme : rien n'était enregistré, leur champ
 * « débloque » était de la prose, et les drapeaux de progression vivaient dans
 * le stockage local du navigateur — vider son cache remettait tout à zéro.
 *
 * Le principe retenu : **l'avancement se déduit, il ne se stocke pas**. Chaque
 * route de travail incrémente des compteurs cumulés ; une quête n'est qu'une
 * lecture de ces compteurs. Il n'y a donc rien à synchroniser, et donc rien qui
 * puisse se désynchroniser. Seul l'encaissement de la récompense est
 * enregistré, parce que c'est le seul fait qui ne se recalcule pas.
 */

/** Compteurs cumulés de travail, alimentés à chaque geste. */
export type PlayerStats = {
  cellsPlanted?: number;
  cellsFertilized?: number;
  cellsPlowed?: number;
  cellsStubbled?: number;
  cellsHarvested?: number;
  tonsHarvested?: number;
  tonsSold?: number;
  buildingsBuilt?: number;
  buildingsUpgraded?: number;
  machinesServiced?: number;
  animalsCollected?: number;
  grazings?: number;
  feedings?: number;
  deliveries?: number;
  contracts?: number;
};

export type StatKey = keyof PlayerStats;

export const STAT_LABELS: Record<StatKey, string> = {
  cellsPlanted: "cases semées",
  cellsFertilized: "cases fertilisées",
  cellsPlowed: "cases labourées",
  cellsStubbled: "cases nettoyées",
  cellsHarvested: "cases moissonnées",
  tonsHarvested: "tonnes récoltées",
  tonsSold: "tonnes vendues",
  buildingsBuilt: "bâtiments posés",
  buildingsUpgraded: "améliorations",
  machinesServiced: "entretiens",
  animalsCollected: "bêtes traites ou tondues",
  grazings: "sorties au pré",
  feedings: "rations distribuées",
  deliveries: "livraisons",
  contracts: "missions terminées",
};

export type QuestDef = {
  id: string;
  title: string;
  /** Ce qu'il faut faire, en une phrase */
  hint: string;
  /** Compteur suivi, et le seuil à atteindre */
  stat: StatKey;
  target: number;
  /** Niveau à partir duquel la quête apparaît */
  level: number;
  /** Réservée à un métier, ou ouverte aux deux */
  spec?: Specialization;
  reward: { xp: number; crd: number };
};

/**
 * Le carnet de quêtes.
 *
 * Il suit la courbe : les premières se tiennent dans la première demi-heure,
 * les dernières accompagnent un joueur installé. Les récompenses restent
 * modestes en argent — elles aident à financer le premier silo, elles ne
 * remplacent pas le métier.
 */
export const QUEST_DEFS: QuestDef[] = [
  {
    id: "first-sowing",
    title: "Mettre en terre",
    hint: "Semez vos vingt premières cases.",
    stat: "cellsPlanted",
    target: 20,
    level: 1,
    reward: { xp: 60, crd: 250 },
  },
  {
    id: "first-harvest",
    title: "La première moisson",
    hint: "Moissonnez vingt cases arrivées à maturité.",
    stat: "cellsHarvested",
    target: 20,
    level: 1,
    reward: { xp: 80, crd: 350 },
  },
  {
    id: "first-sale",
    title: "Vendre sa récolte",
    hint: "Écoulez cinq tonnes, au champ ou depuis le silo.",
    stat: "tonsSold",
    target: 5,
    level: 1,
    reward: { xp: 80, crd: 300 },
  },
  {
    id: "clean-ground",
    title: "Rendre le sol",
    hint: "Nettoyez trente cases de chaumes après la moisson.",
    stat: "cellsStubbled",
    target: 30,
    level: 2,
    reward: { xp: 120, crd: 400 },
  },
  {
    id: "first-building",
    title: "Bâtir",
    hint: "Posez votre premier bâtiment.",
    stat: "buildingsBuilt",
    target: 1,
    level: 2,
    reward: { xp: 150, crd: 500 },
  },
  {
    id: "plow",
    title: "Reprendre le fond",
    hint: "Labourez quarante cases : au bout de trois récoltes, c'est obligatoire.",
    stat: "cellsPlowed",
    target: 40,
    level: 3,
    reward: { xp: 200, crd: 600 },
  },
  {
    id: "feed-well",
    title: "Nourrir le troupeau",
    hint: "Distribuez dix rations.",
    stat: "feedings",
    target: 10,
    level: 3,
    spec: "ELEVEUR",
    reward: { xp: 200, crd: 600 },
  },
  {
    id: "graze",
    title: "Les sortir au pré",
    hint: "Faites sortir le troupeau cinq fois.",
    stat: "grazings",
    target: 5,
    level: 3,
    spec: "ELEVEUR",
    reward: { xp: 180, crd: 500 },
  },
  {
    id: "collect",
    title: "Traire, ramasser, tondre",
    hint: "Récoltez la production de cinquante bêtes.",
    stat: "animalsCollected",
    target: 50,
    level: 4,
    spec: "ELEVEUR",
    reward: { xp: 280, crd: 800 },
  },
  {
    id: "fertilize",
    title: "Soigner le rendement",
    hint: "Fertilisez cent cases.",
    stat: "cellsFertilized",
    target: 100,
    level: 4,
    spec: "CEREALIER",
    reward: { xp: 280, crd: 800 },
  },
  {
    id: "upkeep",
    title: "Tenir le matériel",
    hint: "Cinq passages d'entretien : graissage, nettoyage, révision.",
    stat: "machinesServiced",
    target: 5,
    level: 4,
    reward: { xp: 240, crd: 700 },
  },
  {
    id: "hundred-tons",
    title: "Cent tonnes",
    hint: "Cumulez cent tonnes récoltées, toutes cultures confondues.",
    stat: "tonsHarvested",
    target: 100,
    level: 5,
    reward: { xp: 450, crd: 1200 },
  },
  {
    id: "neighbours",
    title: "Donner un coup de main",
    hint: "Terminez cinq missions pour un voisin.",
    stat: "contracts",
    target: 5,
    level: 6,
    reward: { xp: 400, crd: 1000 },
  },
  {
    id: "estate",
    title: "Une vraie exploitation",
    hint: "Améliorez trois bâtiments.",
    stat: "buildingsUpgraded",
    target: 3,
    level: 8,
    reward: { xp: 600, crd: 1600 },
  },
];

export type QuestView = QuestDef & {
  progress: number;
  done: boolean;
  claimed: boolean;
};

/** Les quêtes visibles pour un joueur, avec leur avancement. */
export function questsFor(
  spec: Specialization,
  level: number,
  stats: PlayerStats,
  claimed: ReadonlySet<string> | readonly string[] = [],
): QuestView[] {
  const taken = claimed instanceof Set ? claimed : new Set(claimed);
  return QUEST_DEFS.filter((q) => (!q.spec || q.spec === spec) && q.level <= level).map((q) => {
    const progress = Math.max(0, stats[q.stat] ?? 0);
    return {
      ...q,
      progress: Math.min(progress, q.target),
      done: progress >= q.target,
      claimed: taken.has(q.id),
    };
  });
}

/** Une quête encaissable : tenue, et pas encore payée. */
export function claimable(
  spec: Specialization,
  level: number,
  stats: PlayerStats,
  claimed: ReadonlySet<string> | readonly string[] = [],
): QuestView[] {
  return questsFor(spec, level, stats, claimed).filter((q) => q.done && !q.claimed);
}

/** Lecture tolérante d'un blob de compteurs venu de la base. */
export function readStats(json: string | null | undefined): PlayerStats {
  if (!json) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: PlayerStats = {};
    for (const key of Object.keys(STAT_LABELS) as StatKey[]) {
      const v = raw[key];
      if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    }
    return out;
  } catch {
    // Un compteur illisible ne doit pas empêcher de jouer : on repart de zéro
    // plutôt que de renvoyer une erreur au milieu d'une moisson.
    return {};
  }
}

/** Additionne des compteurs, en gardant les tonnages au dixième. */
export function addStats(base: PlayerStats, add: PlayerStats): PlayerStats {
  const out: PlayerStats = { ...base };
  for (const key of Object.keys(add) as StatKey[]) {
    const next = (out[key] ?? 0) + (add[key] ?? 0);
    out[key] = key.startsWith("tons") ? Math.round(next * 10) / 10 : Math.round(next);
  }
  return out;
}
