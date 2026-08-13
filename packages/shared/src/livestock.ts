/**
 * Élevage bovin — bien-être animal, pâturage et production.
 *
 * Réponse à la demande client : l'étable seule est un **bâtiment fermé** (les
 * bêtes ne sortent jamais), et c'est l'ajout d'un **enclos adjacent** qui
 * débloque la sortie au pré. Les bêtes qui sortent régulièrement voient leur
 * bonheur monter, et ce bonheur se paie en litres de lait et en kilos de
 * carcasse à l'abattage.
 *
 * Tout est pur : aucune fonction ne lit l'horloge, la base ou le réseau —
 * l'instant courant est toujours passé en paramètre pour rester rejouable en
 * simulation (même contrat que `land.ts`).
 *
 * Le pari d'équilibrage : le bonheur n'est **jamais** un interrupteur, c'est un
 * état lent (constantes de temps de 12 h à 36 h). Un joueur ne peut donc pas
 * « faire sortir les vaches juste avant la traite » pour rafler le bonus : il
 * doit tenir un régime de sorties sur plusieurs jours. Inversement, oublier
 * ses bêtes trois jours ne les ruine pas, ça les ramène au plancher.
 *
 * @see docs/research/07_ANIMAL_SYSTEM.md
 */

/**
 * Recopié de `index.js` : l'importer d'ici créerait un cycle, puisque
 * `index.ts` réexporte l'ensemble du domaine. Toute évolution doit rester
 * synchronisée avec `WeatherState` (même convention que `climate.ts`).
 */
export type WeatherState = "CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "SNOW";

/** Recopié de `index.js` (`MAX_BUILDING_LEVEL`) — à garder synchronisé. */
export const MAX_BARN_LEVEL = 5;

/**
 * Durée d'un cycle d'élevage `[GD]`.
 *
 * Le temps du jeu est compressé : une culture mûrit en 3 minutes, une saison
 * dure 15 minutes. Un cycle d'élevage calé sur 24 h réelles rendrait le
 * bien-être animal strictement invisible — le joueur sortirait ses bêtes et
 * ne verrait jamais la jauge bouger. On l'aligne donc sur une saison.
 */
export const LIVESTOCK_CYCLE_MS = 15 * 60 * 1000;

/** Traite / œufs / laine : prêt au bout de 15 % d’un cycle. */
export const COLLECT_READY_RATIO = 0.15;

/** 0 = vient d’être collecté, 1 = prêt. */
export function collectProgress(
  lastAt: number | null,
  bornAt: number,
  now: number,
  cycleMs = LIVESTOCK_CYCLE_MS,
): number {
  const start = lastAt ?? bornAt;
  const need = cycleMs * COLLECT_READY_RATIO;
  if (need <= 0) return 1;
  return Math.min(1, Math.max(0, (now - start) / need));
}

export function collectReady(
  lastAt: number | null,
  bornAt: number,
  now: number,
  cycleMs = LIVESTOCK_CYCLE_MS,
): boolean {
  return collectProgress(lastAt, bornAt, now, cycleMs) >= 1;
}

/**
 * « Heure » d'élevage — unité de toutes les constantes de dérive. Elle suit le
 * temps compressé du jeu, pas l'horloge murale : 24 heures d'élevage font un
 * cycle. Exportée pour que l'UI et les tests parlent la même langue.
 */
export const LIVESTOCK_HOUR_MS = LIVESTOCK_CYCLE_MS / 24;

const HOUR_MS = LIVESTOCK_HOUR_MS;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arrondi à un dixième — les jauges d'UI n'affichent qu'une décimale. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* 1. Entités                                                          */
/* ------------------------------------------------------------------ */

export type AnimalKind = "COW" | "PIG" | "HEN" | "SHEEP";

/** Éleveur débutant : quelques vaches, pas une étable vide. */
export const STARTER_COW_COUNT = 3;
/** Foin offert à l’installation, pour tenir le premier cycle. */
export const STARTER_HAY_TONS = 2;

export const ANIMAL_PRICE: Record<AnimalKind, number> = {
  COW: 420,
  PIG: 420,
  HEN: 28,
  SHEEP: 160,
};

/** Ration de base par bête et par cycle, en kg `[GD]` */
export const FEED_BASE: Record<AnimalKind, number> = {
  COW: 14,
  PIG: 14,
  HEN: 2,
  SHEEP: 8,
};

export function kindForBarn(type: string): AnimalKind | null {
  if (type === "CATTLE_BARN") return "COW";
  if (type === "PIGSTY") return "PIG";
  if (type === "HENHOUSE") return "HEN";
  if (type === "SHEEPFOLD") return "SHEEP";
  return null;
}

/** Aire de sortie collée au bâtiment : pré pour vaches/moutons, courette sinon. */
export function yardTypeForBarn(type: string): string {
  if (type === "PIGSTY") return "PIG_YARD";
  if (type === "HENHOUSE") return "HEN_YARD";
  return "PADDOCK";
}

/**
 * Un lot d'animaux, pas un animal : la doc §2 impose l'agrégat en V1, sinon la
 * simulation d'un gros cheptel devient un problème de perf pour rien.
 */
export type Herd = {
  id: string;
  kind: AnimalKind;
  /** Effectif du lot */
  size: number;
  /** Âge moyen du lot, en ms de jeu écoulés depuis la naissance */
  averageAgeMs: number;
  /**
   * Bien-être `∈ [0 ; 1]`. Parce que `tickHappiness()` est une relaxation
   * exponentielle, cette valeur **est** déjà une moyenne mobile pondérée des
   * conditions de vie récentes : c'est ce qui autorise `meatYield()` à s'en
   * servir comme proxy du bonheur cumulé sur la vie de l'animal (§3).
   */
  happiness: number;
  /** Timestamp de la dernière sortie au pâturage, `null` si jamais sortie */
  lastGrazedAt: number | null;
  /** Timestamp de la dernière traite, `null` si jamais traite */
  lastMilkedAt: number | null;
};

/**
 * L'enclos vu depuis l'étable. `adjacent` est le résultat de
 * `isPaddockAdjacent()` : un enclos posé à l'autre bout de la ferme existe
 * mais ne sert à rien, et le joueur doit le voir.
 */
export type PaddockState = {
  /** L'enclos partage-t-il un bord avec l'étable ? */
  adjacent: boolean;
  /** Surface de l'enclos, en cases de grille */
  cells: number;
  /** Places disponibles, cf. `paddockCapacity()` */
  capacity: number;
};

/* ------------------------------------------------------------------ */
/* 2. Bonheur — le cœur de la demande                                  */
/* ------------------------------------------------------------------ */

/**
 * Constantes de dérive du bien-être `[GD]`.
 *
 * Le plancher de 0,35 n'est pas 0 à dessein : une vache correctement nourrie
 * dans une étable propre n'est pas maltraitée, elle est juste *sans plus*. Le
 * zéro est réservé au surpeuplement, qui seul peut pousser la cible **sous**
 * le plancher — c'est le seul cas de figure vraiment punitif.
 */
export const HAPPINESS = {
  /** Bornes dures de la jauge */
  min: 0,
  max: 1,
  /** Cible d'une bête qui ne sort jamais `[GD]` */
  confinedFloor: 0.35,
  /** Cible d'une bête sortie du jour, enclos non saturé `[GD]` */
  grazedCeiling: 0.95,
  /**
   * Constante de temps de la **baisse**, en heures `[TEST]`. Volontairement
   * lente : 36 h ⇒ il faut ~3 jours sans sortie pour retomber au plancher.
   */
  decayTauH: 36,
  /** Constante de temps de la **hausse**, en heures `[TEST]` — 3× plus rapide */
  riseTauH: 12,
  /**
   * Mémoire de la dernière sortie `[GD]`. Au-delà de 48 h, la cible est
   * redescendue au plancher : le rythme attendu est « une sortie par cycle ».
   */
  grazeMemoryMs: 48 * HOUR_MS,
  /** Taux d'occupation de l'enclos toléré sans stress `[TEST]` */
  crowdingComfort: 0.85,
  /** Taux d'occupation où le stress est maximal `[TEST]` */
  crowdingCritical: 1.5,
  /** Pénalité maximale de surpeuplement, en points de cible `[GD]` */
  crowdingPenaltyMax: 0.3,
} as const;

/**
 * Pénalité de surpeuplement `∈ [0 ; 0,30]`, linéaire entre 85 % et 150 %
 * d'occupation. En dessous de 85 %, aucune pénalité : le joueur n'a pas à
 * calculer au ras des places disponibles pour être optimal.
 */
export function crowdingPenalty(crowding: number): number {
  const excess = Math.max(0, crowding) - HAPPINESS.crowdingComfort;
  if (excess <= 0) return 0;
  const span = HAPPINESS.crowdingCritical - HAPPINESS.crowdingComfort;
  return HAPPINESS.crowdingPenaltyMax * clamp(excess / span, 0, 1);
}

/**
 * Cible de bonheur vers laquelle le lot dérive, à conditions constantes.
 *
 * Sans enclos adjacent, la cible est le plancher, point. Avec enclos, elle
 * décroît linéairement du plafond vers le plancher au fil de l'oubli, sur
 * `grazeMemoryMs`.
 */
export function happinessTarget(input: {
  hasPaddock: boolean;
  /** Ancienneté de la dernière sortie, en ms (`+∞` si jamais sortie) */
  grazedRecentlyMs: number;
  /** Effectif / capacité de l'enclos */
  crowding: number;
  /** Pénalité de faim, cf. `hungerPenalty()` */
  hunger?: number;
}): number {
  const span = HAPPINESS.grazedCeiling - HAPPINESS.confinedFloor;
  const freshness = input.hasPaddock
    ? clamp(1 - Math.max(0, input.grazedRecentlyMs) / HAPPINESS.grazeMemoryMs, 0, 1)
    : 0;
  const base = HAPPINESS.confinedFloor + span * freshness;
  // La faim passe avant le confort : une bête affamée ne se console pas d'un
  // beau pré, et la pénalité peut donc pousser sous le plancher.
  const malus = crowdingPenalty(input.crowding) + Math.max(0, input.hunger ?? 0);
  return clamp(base - malus, HAPPINESS.min, HAPPINESS.max);
}

/**
 * Fait dériver le bonheur d'un lot sur `elapsedMs`.
 *
 * Relaxation exponentielle `h' = cible + (h − cible) × e^(−Δt/τ)` : elle est
 * inconditionnellement bornée par la cible, donc la jauge ne peut ni dépasser
 * le plafond ni percer le plancher, quel que soit le pas de temps. C'est ce
 * qui permet au serveur de rattraper un joueur absent en un seul tick sans
 * dériver d'un calcul pas-à-pas.
 */
export function tickHappiness(input: {
  happiness: number;
  hasPaddock: boolean;
  /** Ancienneté de la dernière sortie, en ms */
  grazedRecentlyMs: number;
  /** Effectif / capacité de l'enclos */
  crowding: number;
  elapsedMs: number;
  /** Pénalité de faim, cf. `hungerPenalty()` */
  hunger?: number;
}): number {
  const current = clamp(input.happiness, HAPPINESS.min, HAPPINESS.max);
  const hours = Math.max(0, input.elapsedMs) / HOUR_MS;
  if (hours === 0) return current;

  const target = happinessTarget(input);
  const tau = target < current ? HAPPINESS.decayTauH : HAPPINESS.riseTauH;
  const next = target + (current - target) * Math.exp(-hours / tau);
  return clamp(next, HAPPINESS.min, HAPPINESS.max);
}

/**
 * Indice de bien-être normalisé `∈ [0 ; 1]` : 0 au plancher de l'enfermement,
 * 1 au plafond du pâturage. C'est **lui** qui pilote les bonus de production,
 * jamais le bonheur brut — sinon une bête enfermée toucherait déjà 35 % du
 * bonus sans que le joueur ait rien construit.
 */
export function welfareIndex(happiness: number): number {
  const span = HAPPINESS.grazedCeiling - HAPPINESS.confinedFloor;
  return clamp((happiness - HAPPINESS.confinedFloor) / span, 0, 1);
}

/** Météo qui interdit la sortie `[GD]` — orage (foudre) et neige (pas d'herbe). */
export const GRAZING_BLOCKING_WEATHER: readonly WeatherState[] = ["STORM", "SNOW"];

/** Motif de refus de sortie, tel qu'il s'affiche dans l'UI. */
export type GrazingRefusal = "NO_PADDOCK" | "PADDOCK_FULL" | "BAD_WEATHER" | "WRONG_SPECIES";

/* ------------------------------------------------------------------ */
/* Alimentation — la ration conditionne tout le reste                  */
/* ------------------------------------------------------------------ */

/**
 * Effet de la faim `[GD]`.
 *
 * Un troupeau non nourri ne meurt pas : il maigrit et se stresse. La cible de
 * bien-être s'effondre, donc lait et viande suivent. C'est la sanction la plus
 * lisible — le joueur voit sa jauge plonger sans qu'on lui supprime son
 * cheptel du jour au lendemain.
 */
/** Ration de base d'une bête par cycle, en kg de matière sèche `[RÉEL]` */
export const FEED_BASE_PER_COW = 14;

export const HUNGER = {
  /** Au-delà, la ration précédente ne compte plus `[GD]` */
  memoryMs: 0,
  /** Pénalité maximale sur la cible de bien-être `[GD]` */
  penaltyMax: 0.55,
  /**
   * Ration d'une bête pour un cycle, en kg équivalent fourrage `[RÉEL]`.
   * Doit rester égal à `FEED_BASE_PER_COW` : c'est la même ration, vue une
   * fois du côté du besoin et une fois du côté de la consommation.
   */
  unitsPerAnimalPerCycle: FEED_BASE_PER_COW,
} as const;

/**
 * Pénalité de faim, de 0 (rassasié) à `penaltyMax` (réserve vide).
 * La réserve est exprimée en unités nutritives déjà distribuées.
 */
export function hungerPenalty(input: {
  feedStock: number;
  herdSize: number;
  kind?: AnimalKind;
}): number {
  const per = FEED_BASE[input.kind ?? "COW"] ?? HUNGER.unitsPerAnimalPerCycle;
  const need = Math.max(1, input.herdSize) * per;
  const covered = Math.max(0, Math.min(1, input.feedStock / need));
  return (1 - covered) * HUNGER.penaltyMax;
}

/**
 * Fourrage consommé sur une durée donnée, en kg.
 *
 * S'appuie sur `feedConsumption()` plutôt que de recalculer la ration : une
 * étable mieux isolée économise du foin, et cette économie doit valoir aussi
 * bien pour l'affichage que pour la consommation réelle.
 */
export function feedBurn(input: {
  herdSize: number;
  elapsedMs: number;
  cycleMs: number;
  /** Au pré, les bêtes se nourrissent en partie seules */
  grazing: boolean;
  /** Niveau de l'étable ; par défaut, la plus rustique */
  barnLevel?: number;
  kind?: AnimalKind;
}): number {
  const cycles = Math.max(0, input.elapsedMs) / Math.max(1, input.cycleMs);
  const perCycle = feedConsumption({
    herdSize: input.herdSize,
    grazing: input.grazing,
    barnLevel: input.barnLevel ?? 1,
    kind: input.kind,
  });
  return perCycle * cycles;
}

export const GRAZING_REFUSAL_LABELS: Record<GrazingRefusal, string> = {
  NO_PADDOCK: "Aucun enclos accolé à l’étable",
  PADDOCK_FULL: "Enclos saturé",
  BAD_WEATHER: "Météo impraticable",
  WRONG_SPECIES: "Cette aire de sortie n’est pas faite pour cette espèce",
};

/**
 * Une sortie est possible si — et seulement si — il existe un enclos adjacent,
 * qu'il reste de la place et que la météo le permet.
 */
export function canGraze(input: {
  paddock: PaddockState | null;
  /** Nombre de bêtes que l'on veut sortir */
  animals: number;
  /** Bêtes déjà dehors */
  animalsOutside?: number;
  weather: WeatherState;
  kind?: AnimalKind;
  /** Espèce que l'aire de sortie accueille ; par défaut, des bovins */
  paddockKind?: AnimalKind;
}): { ok: boolean; reason?: GrazingRefusal } {
  // Une vache ne se met pas dans une souille, un porc ne pâture pas : chaque
  // espèce a son aire de sortie.
  if ((input.kind ?? "COW") !== (input.paddockKind ?? "COW")) {
    return { ok: false, reason: "WRONG_SPECIES" };
  }
  if (input.paddock === null || !input.paddock.adjacent) {
    return { ok: false, reason: "NO_PADDOCK" };
  }
  if (GRAZING_BLOCKING_WEATHER.includes(input.weather)) {
    return { ok: false, reason: "BAD_WEATHER" };
  }
  const free = input.paddock.capacity - Math.max(0, input.animalsOutside ?? 0);
  if (input.animals <= 0 || free < input.animals) return { ok: false, reason: "PADDOCK_FULL" };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* 3. Production                                                       */
/* ------------------------------------------------------------------ */

/** Litres par vache et par cycle, étable niveau 1, ration basique `[GD]` */
export const MILK_BASE_PER_COW = 22;

/**
 * Écart de production maximal entre une vache enfermée et une vache au pré
 * `[GD]` : **+32 %**.
 *
 * Le choix se justifie par deux bornes. En dessous de +25 %, l'enclos (400 CRD
 * + 90 CRD/case, soit ~1 850 CRD pour 16 cases) ne se rembourse pas assez vite
 * pour qu'un joueur le construise ; au-dessus de +40 %, l'étable fermée
 * devient un piège de conception (« tu as mal joué au moment de bâtir ») et le
 * lait au pré écrase les autres filières. +32 % laisse l'enclos rentable en
 * une quinzaine de cycles tout en gardant l'étable seule jouable.
 */
export const MILK_HAPPINESS_SPAN = 0.32;

/** Gain de traite par niveau d'étable au-dessus de 1 `[TEST]` — ×1,24 au niveau 5 */
export const MILK_BARN_LEVEL_STEP = 0.06;

/** Gain de ration : basique → premium, aligné sur la table §3 de la doc `[GD]` */
export const MILK_FEED_SPAN = 0.2;

/**
 * Lait produit par cycle, en litres.
 *
 * `L = 22 × effectif × (1 + 0,32 × w) × (1 + 0,06 × (niveau − 1)) × (1 + 0,20 × ration)`
 * où `w = welfareIndex(happiness)`. Les trois multiplicateurs sont bornés, donc
 * l'écart total entre le pire et le meilleur troupeau reste ~×1,96 : l'élevage
 * ne peut pas déraper en écart de puissance entre joueurs.
 */
export function milkYield(input: {
  herdSize: number;
  happiness: number;
  barnLevel: number;
  /** Qualité de la ration, 0 = basique, 1 = premium */
  feedQuality: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;

  const welfare = 1 + MILK_HAPPINESS_SPAN * welfareIndex(input.happiness);
  const level = clamp(Math.round(input.barnLevel), 1, MAX_BARN_LEVEL);
  const barn = 1 + MILK_BARN_LEVEL_STEP * (level - 1);
  const feed = 1 + MILK_FEED_SPAN * clamp(input.feedQuality, 0, 1);

  return round1(MILK_BASE_PER_COW * size * welfare * barn * feed);
}

/** Caisses d'œufs par poule et par cycle `[GD]` */
export const EGGS_BASE_PER_HEN = 0.14;

export function eggYield(input: {
  herdSize: number;
  happiness: number;
  barnLevel: number;
  feedQuality: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;
  const welfare = 1 + MILK_HAPPINESS_SPAN * welfareIndex(input.happiness);
  const level = clamp(Math.round(input.barnLevel), 1, MAX_BARN_LEVEL);
  const barn = 1 + MILK_BARN_LEVEL_STEP * (level - 1);
  const feed = 1 + MILK_FEED_SPAN * clamp(input.feedQuality, 0, 1);
  return Math.round(EGGS_BASE_PER_HEN * size * welfare * barn * feed * 100) / 100;
}

/** Tonnes de laine par mouton et par tonte `[GD]` */
export const WOOL_BASE_PER_SHEEP = 0.012;

export function woolYield(input: {
  herdSize: number;
  happiness: number;
  barnLevel: number;
  feedQuality: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;
  const welfare = 1 + MILK_HAPPINESS_SPAN * 0.6 * welfareIndex(input.happiness);
  const level = clamp(Math.round(input.barnLevel), 1, MAX_BARN_LEVEL);
  const barn = 1 + MILK_BARN_LEVEL_STEP * (level - 1);
  const feed = 1 + MILK_FEED_SPAN * 0.5 * clamp(input.feedQuality, 0, 1);
  return Math.round(WOOL_BASE_PER_SHEEP * size * welfare * barn * feed * 1000) / 1000;
}

/** Poids de carcasse d'un bovin adulte, en kg `[GD]` */
export const MEAT_BASE_KG = 280;

/** Âge de maturité bouchère `[GD]` — 30 cycles, soit 30 jours réels */
export const MEAT_MATURITY_MS = 30 * LIVESTOCK_CYCLE_MS;

/** Part du poids adulte déjà atteinte à la naissance `[TEST]` */
export const MEAT_AGE_FLOOR = 0.35;

/**
 * Écart de rendement carcasse dû au bien-être `[GD]` : **+22 %**, donc moins
 * que le lait. La viande dépend d'abord de la croissance (l'âge), et le
 * bien-être n'y agit qu'indirectement, via l'ingéré et l'absence de stress.
 * Un écart aussi fort que sur le lait rendrait l'abattage systématiquement
 * plus rentable que la traite, ce que la doc §8 interdit explicitement.
 */
export const MEAT_HAPPINESS_SPAN = 0.22;

/** Gain d'abattage par niveau d'étable au-dessus de 1 `[TEST]` — ×1,12 au niveau 5 */
export const MEAT_BARN_LEVEL_STEP = 0.03;

/**
 * Viande obtenue à l'abattage d'un lot, en kg.
 *
 * `kg = 280 × effectif × âge × (1 + 0,22 × w) × (1 + 0,03 × (niveau − 1))`
 *
 * **Comment le bonheur cumulé compte** : `happiness` n'est pas la photo d'un
 * instant, c'est la sortie de `tickHappiness()`, une relaxation de constante
 * 12 h à la hausse et 36 h à la baisse. La valeur stockée est donc
 * mathématiquement une moyenne mobile exponentielle des conditions de vie du
 * lot, pondérée en faveur des derniers jours. Conséquence de design voulue :
 * on ne peut pas « engraisser le bonheur » la veille de l'abattage (il faut
 * ~2 jours de sorties pour approcher le plafond), mais un éleveur qui a tenu
 * le rythme toute la vie du lot touche le bonus plein. Aucun historique n'est
 * stocké : la jauge *est* l'historique.
 */
export function meatBaseKg(kind: AnimalKind = "COW"): number {
  if (kind === "HEN") return 2.2;
  if (kind === "SHEEP") return 42;
  return MEAT_BASE_KG;
}

export function meatYield(input: {
  herdSize: number;
  happiness: number;
  averageAgeMs: number;
  barnLevel: number;
  kind?: AnimalKind;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;

  // Croissance linéaire jusqu'à maturité, puis plateau : pas de dépréciation
  // du vieux bétail, sinon oublier un lot deviendrait une perte sèche.
  const growth = clamp(
    MEAT_AGE_FLOOR + (1 - MEAT_AGE_FLOOR) * (Math.max(0, input.averageAgeMs) / MEAT_MATURITY_MS),
    MEAT_AGE_FLOOR,
    1,
  );
  const welfare = 1 + MEAT_HAPPINESS_SPAN * welfareIndex(input.happiness);
  const level = clamp(Math.round(input.barnLevel), 1, MAX_BARN_LEVEL);
  const barn = 1 + MEAT_BARN_LEVEL_STEP * (level - 1);

  return Math.round(meatBaseKg(input.kind ?? "COW") * size * growth * welfare * barn);
}

/** Fourrage distribué par vache et par cycle, en kg de matière sèche `[GD]` */

/**
 * Part du fourrage encore distribuée quand le lot pâture `[GD]` : **65 %**.
 *
 * Décision assumée : le pâturage **réduit** la consommation de fourrage
 * stocké, parce que l'herbe de l'enclos couvre le tiers de l'ingéré. C'est
 * donc un double gain (plus de lait, moins de foin) — sinon l'enclos serait
 * un investissement au bilan trop mince pour intéresser qui que ce soit. Le
 * contrepoids n'est pas économique mais logistique : l'enclos coûte des cases
 * de terrain constructible, exige l'adjacence à l'étable, et la sortie tombe
 * à l'eau dès l'orage ou la neige. Le joueur qui vise le rendement maximal
 * doit donc surveiller la météo, pas juste cliquer une fois.
 */
export const FEED_GRAZING_RATIO = 0.65;

/** Économie de gaspillage par niveau d'étable (mangeoire mieux réglée) `[TEST]` */
export const FEED_BARN_LEVEL_STEP = 0.03;

/** Économie de gaspillage maximale, quel que soit le niveau `[GD]` */
export const FEED_BARN_SAVING_CAP = 0.12;

/**
 * Fourrage consommé par cycle, en kg de matière sèche.
 *
 * `kg = 14 × effectif × (pâture ? 0,65 : 1) × (1 − min(0,12 ; 0,03 × (niveau − 1)))`
 */
export function feedConsumption(input: {
  herdSize: number;
  /** Le lot est-il sorti au pré sur ce cycle ? */
  grazing: boolean;
  barnLevel: number;
  kind?: AnimalKind;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;

  const level = clamp(Math.round(input.barnLevel), 1, MAX_BARN_LEVEL);
  const saving = Math.min(FEED_BARN_SAVING_CAP, FEED_BARN_LEVEL_STEP * (level - 1));
  const pasture = input.grazing ? FEED_GRAZING_RATIO : 1;
  const base = FEED_BASE[input.kind ?? "COW"] ?? FEED_BASE_PER_COW;

  return round1(base * size * pasture * (1 - saving));
}

/* ------------------------------------------------------------------ */
/* 4. Enclos                                                           */
/* ------------------------------------------------------------------ */

/**
 * Paramètres de l'enclos `[GD]`.
 *
 * Proposition de bâtiment à ajouter soi-même dans `BUILDING_DEFS`
 * (`BuildingType` devrait recevoir `"PADDOCK"`) :
 *
 * ```ts
 * PADDOCK: {
 *   type: "PADDOCK",
 *   name: "Enclos de pâture",
 *   w: 4,
 *   h: 4,
 *   cost: 1840, // PADDOCK.baseCost + 16 × PADDOCK.costPerCell
 *   description: "Accolé à une étable, permet de sortir les vaches : +32 % de lait au maximum.",
 *   cattleSlots: 32, // paddockCapacity(16)
 * }
 * ```
 *
 * Note d'intégration : contrairement à l'étable, `cattleSlots` d'un enclos
 * n'est pas une place de logement mais une place de **sortie**. Il ne doit
 * donc pas s'additionner à la capacité d'hébergement du cheptel.
 */
export const PADDOCK = {
  /** Bêtes qui peuvent sortir par case d'enclos `[GD]` */
  capacityPerCell: 2,
  /** En dessous, la parcelle est un couloir, pas un pré : capacité nulle `[GD]` */
  minCells: 6,
  /** Base de coût, en CRD `[TEST]` */
  baseCost: 400,
  /** Coût par case, en CRD `[TEST]` */
  costPerCell: 90,
} as const;

/**
 * Places de sortie offertes par un enclos de `cells` cases.
 * Un enclos trop petit ne vaut rien du tout : pas de dégressivité douce, un
 * seuil net, plus lisible pour le joueur.
 */
export function paddockCapacity(cells: number): number {
  const n = Math.max(0, Math.floor(cells));
  if (n < PADDOCK.minCells) return 0;
  return n * PADDOCK.capacityPerCell;
}

/** Coût de construction d'un enclos, en CRD. */
export function paddockCost(cells: number): number {
  const n = Math.max(0, Math.floor(cells));
  return PADDOCK.baseCost + n * PADDOCK.costPerCell;
}

/** Emprise rectangulaire d'un bâtiment sur la grille. */
export type Footprint = { originX: number; originY: number; w: number; h: number };

/** Les intervalles `[a ; a+la[` et `[b ; b+lb[` se chevauchent-ils vraiment ? */
function overlaps(a: number, la: number, b: number, lb: number): boolean {
  return Math.max(a, b) < Math.min(a + la, b + lb);
}

/**
 * Vraie adjacence : les deux emprises partagent un **bord commun de longueur
 * non nulle**. Le coin à coin est refusé — une vache ne passe pas par une
 * diagonale, et accepter le contact diagonal ouvrirait des placements en
 * damier absurdes visuellement.
 */
export function isPaddockAdjacent(barn: Footprint, paddock: Footprint): boolean {
  const touchesVertically =
    (barn.originY + barn.h === paddock.originY || paddock.originY + paddock.h === barn.originY) &&
    overlaps(barn.originX, barn.w, paddock.originX, paddock.w);

  const touchesHorizontally =
    (barn.originX + barn.w === paddock.originX || paddock.originX + paddock.w === barn.originX) &&
    overlaps(barn.originY, barn.h, paddock.originY, paddock.h);

  return touchesVertically || touchesHorizontally;
}

/* ------------------------------------------------------------------ */
/* 5. Cycle de sortie — pilotage de l'animation 3D                     */
/* ------------------------------------------------------------------ */

/** Une vague de sortie : quand, jusqu'à quand, et combien de bêtes. */
export type GrazingWindow = { startsAt: number; endsAt: number; animals: number };

/**
 * Paramètres de la sortie au pré `[GD]`.
 *
 * Les bêtes sortent par vagues de 8 : c'est autant une contrainte d'animation
 * (un troupeau de 50 qui franchit la porte d'un coup ne peut pas être lisible)
 * qu'un choix de simulation (l'ingéré d'un pré ne se reconstitue pas
 * instantanément).
 */
export const GRAZING = {
  /** Bêtes par vague `[GD]` */
  waveSize: 8,
  /** Rassemblement avant l'ouverture de la porte `[TEST]` — 5 min de jeu */
  leadInMs: (5 / 60) * HOUR_MS,
  /** Durée de base d'une sortie `[GD]` — 3 h */
  baseDurationMs: 3 * HOUR_MS,
  /** Rallonge par bête de la vague `[TEST]` — 6 min de jeu */
  perAnimalMs: (6 / 60) * HOUR_MS,
  /** Durée maximale d'une sortie `[GD]` — 6 h */
  maxDurationMs: 6 * HOUR_MS,
  /** Une sortie par cycle : en deçà, `planGrazing()` refuse `[GD]` */
  cooldownMs: 20 * HOUR_MS,
} as const;

/**
 * Planifie la prochaine vague de sortie, ou `null` si elle est impossible.
 *
 * Entièrement déterministe (aucun aléa, aucune horloge lue) : le client 3D peut
 * rejouer la même fenêtre que le serveur à partir des mêmes entrées.
 * La météo n'est volontairement pas un paramètre ici : la planification est
 * une intention, c'est `canGraze()` qui tranche au moment de l'ouverture.
 */
export function planGrazing(
  now: number,
  herd: Herd,
  paddock: PaddockState | null,
): GrazingWindow | null {
  if (paddock === null || !paddock.adjacent) return null;

  const size = Math.max(0, Math.floor(herd.size));
  const places = Math.min(size, Math.max(0, Math.floor(paddock.capacity)));
  if (places <= 0) return null;

  // Cooldown : une sortie déjà faite dans les 20 dernières heures suffit.
  if (herd.lastGrazedAt !== null && now - herd.lastGrazedAt < GRAZING.cooldownMs) return null;

  const animals = Math.min(places, GRAZING.waveSize);
  const startsAt = now + GRAZING.leadInMs;
  const duration = Math.min(
    GRAZING.maxDurationMs,
    GRAZING.baseDurationMs + GRAZING.perAnimalMs * animals,
  );

  return { startsAt, endsAt: startsAt + duration, animals };
}

/** Nombre de vagues nécessaires pour sortir tout le lot. */
export function grazingWaveCount(herdSize: number, paddockCapacity: number): number {
  const places = Math.min(
    Math.max(0, Math.floor(herdSize)),
    Math.max(0, Math.floor(paddockCapacity)),
  );
  return Math.ceil(places / GRAZING.waveSize);
}

/* ------------------------------------------------------------------ */
/* 6. Libellés français                                                */
/* ------------------------------------------------------------------ */

/**
 * Tranches de bien-être, de la pire à la meilleure. Les seuils sont accrochés
 * aux constantes : « Correctes » démarre exactement au plancher de
 * l'enfermement, pour qu'un joueur sans enclos lise « Correctes » et non
 * « Stressées » — il n'a rien fait de mal, il n'a juste pas encore construit.
 */
export const HAPPINESS_LABELS: readonly { min: number; label: string }[] = [
  { min: 0, label: "Stressées" },
  { min: HAPPINESS.confinedFloor, label: "Correctes" },
  { min: 0.6, label: "Sereines" },
  { min: 0.85, label: "Épanouies" },
];

/** Libellé d'affichage d'une jauge de bien-être. */
export function happinessLabel(happiness: number): string {
  const h = clamp(happiness, HAPPINESS.min, HAPPINESS.max);
  let label = HAPPINESS_LABELS[0].label;
  for (const tier of HAPPINESS_LABELS) {
    if (h >= tier.min) label = tier.label;
  }
  return label;
}

/* ------------------------------------------------------------------ */
/* Mortalité et âge du lot                                             */
/* ------------------------------------------------------------------ */

/**
 * Un troupeau affamé finit par perdre des bêtes.
 *
 * Sans cela, négliger son élevage ne coûtait rien : le bien-être tombait au
 * plancher, la production s'effondrait, et le lot attendait indéfiniment que
 * le joueur revienne. La faim devient une vraie perte, mais lente — on doit
 * avoir le temps de réagir en rentrant.
 */
export const MORTALITY = {
  /** En dessous de ce bien-être, les pertes commencent `[GD]` */
  floor: 0.15,
  /** Part du lot perdue par cycle, bien-être au plus bas `[GD]` */
  perCycleAtWorst: 0.06,
} as const;

/**
 * Pertes d'un lot sur une durée donnée.
 *
 * La dette fractionnaire est reportée d'un appel à l'autre : sans elle, un lot
 * de trois bêtes ne perdrait jamais rien, la perte attendue par cycle restant
 * sous l'unité. Elle est retournée pour être stockée.
 */
export function mortalityToll(input: {
  happiness: number;
  herdSize: number;
  elapsedMs: number;
  cycleMs: number;
  debt: number;
}): { deaths: number; debt: number } {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size <= 0) return { deaths: 0, debt: 0 };
  if (input.happiness >= MORTALITY.floor) {
    // Un troupeau qu'on remet d'aplomb ne traîne pas sa dette : la pression
    // retombe avec la faim.
    return { deaths: 0, debt: Math.max(0, input.debt - 0.25) };
  }
  const severity = clamp((MORTALITY.floor - input.happiness) / MORTALITY.floor, 0, 1);
  const cycles = Math.max(0, input.elapsedMs) / Math.max(1, input.cycleMs);
  const debt = input.debt + size * MORTALITY.perCycleAtWorst * severity * cycles;
  const deaths = Math.min(size, Math.floor(debt));
  return { deaths, debt: debt - deaths };
}

/** Âge des bêtes achetées : on achète du bétail élevé, pas des nouveau-nés `[GD]` */
export const PURCHASED_AGE_MS = Math.round(0.6 * MEAT_MATURITY_MS);

/**
 * Âge moyen du lot après l'arrivée de bêtes plus jeunes — naissances ou achat.
 *
 * L'âge était celui du lot depuis sa création, si bien qu'un veau né le jour
 * même comptait comme ses aînés à l'abattage. La moyenne se dilue désormais à
 * chaque arrivée, au prorata des effectifs.
 */
export function blendedAgeMs(input: {
  herdSize: number;
  averageAgeMs: number;
  added: number;
  addedAgeMs: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  const added = Math.max(0, Math.floor(input.added));
  if (added <= 0) return Math.max(0, input.averageAgeMs);
  const total = size + added;
  if (total <= 0) return 0;
  return Math.max(0, (input.averageAgeMs * size + input.addedAgeMs * added) / total);
}
