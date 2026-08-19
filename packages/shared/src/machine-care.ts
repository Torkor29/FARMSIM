/** Entretien des machines — graisse, saleté, pannes. Ouvert à tous. `[GD]` */

export type BreakdownKind = "BELT" | "HYDRAULIC" | "ENGINE";

export const BREAKDOWN_LABELS: Record<BreakdownKind, string> = {
  BELT: "courroie",
  HYDRAULIC: "hydraulique",
  ENGINE: "moteur",
};

/**
 * Au-dessus, la machine est annoncée « sale » au joueur `[GD]`.
 *
 * Ce seuil valait 25 alors qu'un chantier de 144 cases en déposait 86 : la
 * machine était donc sale **dès son premier champ**, définitivement, quoi que
 * fasse le joueur. Un état permanent n'est pas un état. Avec les dépôts remis
 * à l'échelle du chantier (~30 points par champ), 45 veut dire « tu as sauté
 * un nettoyage », ce qui se répare et se voit venir.
 */
export const DIRT_DIRTY_THRESHOLD = 45;
export const GREASE_COST_CRD = 12;
/** Plein réservoir. Un champ 12×12 (~144 cases) en consomme ~36. */
export const GREASE_FULL = 100;
/** Points vidés par case — assez bas pour deux ou trois champs d’affilée. */
export const GREASE_PER_CELL = 0.25;
/** Surcoût si la machine est déjà sale. */
export const GREASE_DIRT_EXTRA = 0.1;
/** En dessous, plus de bonus « nickel », mais on peut encore partir. */
export const GREASE_OK = 20;

export function greaseCost(cells: number, dirt: number): number {
  const extra = dirt >= DIRT_DIRTY_THRESHOLD ? GREASE_DIRT_EXTRA : 0;
  return Math.round((GREASE_PER_CELL + extra) * Math.max(0, cells) * 100) / 100;
}

export function applyGreaseUse(grease: number, cells: number, dirt: number): number {
  return Math.max(0, Math.round((grease - greaseCost(cells, dirt)) * 100) / 100);
}

/** Assez de graisse pour le bonus d’usure / récolte. */
export function greaseIsOk(grease: number): boolean {
  return grease >= GREASE_OK;
}

export function greaseIsEmpty(grease: number): boolean {
  return grease <= 0;
}
export const CLEAN_COST_CRD = 18;
/** Remise réparation atelier uniquement — plus de caste ETA `[GD]` */
export const ETA_REPAIR_EXTRA_DISCOUNT = 0;

/**
 * Saleté déposée par case travaillée `[GD]`.
 *
 * Ces chiffres étaient calibrés pour le geste, pas pour le chantier. Sur un
 * champ entier de 144 cases ils donnaient : semis 86, moisson 115, labour
 * 173, **fertilisation 346** — c'est-à-dire la jauge saturée par un seul
 * passage, et parfois par le tiers d'un passage.
 *
 * La graisse, elle, avait déjà été mise à l'échelle du chantier (un plein
 * tient deux champs, il y a un test qui le dit). La saleté ne l'avait jamais
 * été. C'est tout l'écart.
 *
 * Barème actuel, par champ de 144 cases : fauche 22, semis 29, moisson 35,
 * déchaumage 37, labour 40, fertilisation 52. Trois champs environ entre deux
 * coups de karcher, et la fertilisation reste le travail le plus salissant.
 */
export const DIRT_PER_CELL: Record<string, number> = {
  PLANT: 0.2,
  FERTILIZE: 0.36,
  HARVEST: 0.24,
  PLOW: 0.28,
  STUBBLE: 0.26,
  MOW: 0.15,
  // Trois travaux qui existaient dans `MachineDef.works` sans jamais avoir de
  // ligne ici : ils retombaient sur le défaut de 0,8, c'est-à-dire 115 points
  // par champ — une ensileuse ressortait crasseuse à 100 de chaque parcelle,
  // nettoyée ou non. Le défaut est aligné sur la moyenne pour que l'oubli
  // suivant coûte moins cher.
  BALE: 0.22,
  COLLECT: 0.18,
  SILAGE: 0.3,
};

/** Travail sans barème connu — au niveau de la moyenne, pas au-dessus. */
export const DIRT_PER_CELL_DEFAULT = 0.24;

export const REPAIR_RESTORE: Record<
  BreakdownKind,
  { conditionDelta: number | "full"; partCount: number; ordered: boolean }
> = {
  BELT: { conditionDelta: 30, partCount: 3, ordered: false },
  HYDRAULIC: { conditionDelta: 50, partCount: 4, ordered: false },
  ENGINE: { conditionDelta: "full", partCount: 6, ordered: true },
};

export const REPAIR_PARTS: Record<BreakdownKind, string[]> = {
  BELT: ["Courroie", "Galet", "Carter"],
  HYDRAULIC: ["Flexible", "Collier", "Joint", "Pompe"],
  ENGINE: ["Filtre", "Bougie", "Durite", "Pompe", "Joint", "Vidange"],
};

/** Points de graissage, en % de l'illustration. */
export const GREASE_POINTS: Array<{ x: number; y: number }> = [
  { x: 28, y: 38 },
  { x: 72, y: 36 },
  { x: 48, y: 52 },
  { x: 32, y: 74 },
  { x: 68, y: 76 },
];

export const DUST_POINTS: Array<{ x: number; y: number }> = [
  { x: 18, y: 22 },
  { x: 42, y: 16 },
  { x: 70, y: 24 },
  { x: 22, y: 48 },
  { x: 55, y: 44 },
  { x: 78, y: 52 },
  { x: 30, y: 70 },
  { x: 62, y: 68 },
];

export const MUD_POINTS: Array<{ x: number; y: number }> = [
  { x: 24, y: 58 },
  { x: 48, y: 72 },
  { x: 70, y: 62 },
  { x: 38, y: 36 },
  { x: 64, y: 40 },
];

/**
 * Plein régime au-dessus de ce niveau d'usure `[GD]`.
 *
 * Au-delà, entretenir davantage ne rapporte rien : il faut une plage où la
 * machine est simplement bonne, sinon le joueur passe sa partie à l'atelier.
 */
export const CONDITION_FULL_POWER = 80;

/** Ce qu'il reste de rendement sur une machine à bout de souffle `[GD]`. */
export const CONDITION_WORST_FACTOR = 0.7;

/**
 * Ce que l'état de la machine fait perdre au chantier.
 *
 * La graisse et la saleté agissaient déjà sur le rendement — trois paliers,
 * de +8 % à −6 %. **La condition, elle, n'entrait nulle part.** Une
 * moissonneuse à 13 % ramassait autant, aussi vite, qu'une machine neuve :
 * l'usure se calculait, se réparait, se payait, et ne coûtait jamais rien.
 * Elle n'agissait que de deux façons, toutes deux tout-ou-rien — bloquer sous
 * `minCondition`, et tirer au sort une panne sous 50 %.
 *
 * D'où : aucune raison d'entretenir au-dessus du seuil de blocage. On
 * repoussait jusqu'à la panne, et la révision n'était pas un calcul mais une
 * corvée.
 *
 * La perte est **continue et douce** : plein régime au-dessus de 80 %, puis
 * une pente régulière jusqu'à −30 % à zéro. Aux valeurs qui comptent :
 *
 *     100 %  →  rendement plein
 *      80 %  →  rendement plein
 *      40 %  →  −15 %
 *      20 %  →  −22 %
 *      12 %  →  −25 %   (seuil de blocage d'une moissonneuse)
 *
 * C'est ce qui transforme la révision en arbitrage — « est-ce qu'elle se
 * paie ? » — au lieu d'une case à cocher avant la panne.
 */
export function conditionYieldFactor(condition: number): number {
  const c = Math.max(0, Math.min(100, condition));
  if (c >= CONDITION_FULL_POWER) return 1;
  const perte = (1 - CONDITION_WORST_FACTOR) * (c / CONDITION_FULL_POWER);
  return Math.round((CONDITION_WORST_FACTOR + perte) * 1000) / 1000;
}

/** Part de graisse restante, 0 → 1, quelle que soit la forme de l'état. */
function greaseFraction(opts: { greased?: boolean; grease?: number }): number {
  const g = opts.grease != null ? opts.grease : opts.greased ? GREASE_FULL : 0;
  return Math.max(0, Math.min(1, g / GREASE_FULL));
}

/** Part de propreté, 0 → 1. */
function cleanFraction(dirt: number): number {
  return Math.max(0, Math.min(1, 1 - dirt / 100));
}

/**
 * Ce que l'entretien fait à l'usure `[GD]`.
 *
 * L'ancienne version était en marches : 0,75 si nickel, puis ×1,5 à sec et
 * ×2 si sale, jusqu'à ×3. Deux défauts, et c'est le second qui rendait les
 * tracteurs injouables.
 *
 * D'abord une **falaise invisible** : entre saleté 24 et saleté 25, la même
 * action coûtait deux fois plus cher, sans que rien ne le dise. Ensuite, un
 * chantier salissait bien au-delà du seuil (86 points pour un semis de 144
 * cases contre un seuil à 25) : le joueur passait donc de ×0,75 à ×2 entre
 * son premier et son deuxième champ. Un tracteur neuf tombait sous son seuil
 * de blocage en deux passages, sans avoir rien fait de mal.
 *
 * La réponse est une **pente continue** sur les deux jauges :
 *
 *     graisse pleine, machine propre  →  ×0,80
 *     jauges à moitié                 →  ×1,04
 *     à sec et crasseuse              →  ×1,95
 *
 * L'écart utile est conservé — soigner sa machine vaut toujours près de la
 * moitié de l'usure — mais il se gagne et se perd graduellement, et aucun
 * point de bascule ne se cache entre deux chantiers.
 */
export function careWearMultiplier(opts: { greased?: boolean; grease?: number; dirt: number }): number {
  const graisse = 1.3 - 0.5 * greaseFraction(opts);
  const salete = 1.5 - 0.5 * cleanFraction(opts.dirt);
  return Math.round(graisse * salete * 1000) / 1000;
}

/**
 * Propre et graissé : un peu plus de récolte. Sale et à sec : un peu moins.
 *
 * Même pente continue que l'usure, et pour la même raison : le palier du
 * milieu rendait le soin invisible sur une large plage. Extrêmes inchangés,
 * +8 % nickel et −6 % à l'abandon.
 */
export function careYieldBonus(opts: { greased?: boolean; grease?: number; dirt: number }): number {
  const soin = (greaseFraction(opts) + cleanFraction(opts.dirt)) / 2;
  return Math.round((0.08 * soin - 0.06 * (1 - soin)) * 1000) / 1000;
}

/**
 * Combien d'heures de travail la machine peut encore encaisser avant
 * l'atelier, à son entretien du moment `[GD]`.
 *
 * L'atelier affichait un pourcentage de condition et une jauge de graisse.
 * Aucun des deux ne répond à la seule question qu'on se pose avant de lancer
 * un chantier — « est-ce que je peux y aller ? ».
 *
 * Estimation volontairement pessimiste : elle suppose l'entretien figé à son
 * niveau du moment, alors qu'il se dégrade en cours de route.
 */
export function hoursBeforeWorkshop(opts: {
  condition: number;
  minCondition: number;
  lifeHours: number;
  careMult?: number;
  inShed?: boolean;
}): number {
  const marge = opts.condition - opts.minCondition;
  if (marge <= 0) return 0;
  const parHeure =
    (100 / Math.max(1, opts.lifeHours)) * (opts.careMult ?? 1) * (opts.inShed ? 0.85 : 1);
  if (parHeure <= 0) return Infinity;
  return Math.round(marge / parHeure);
}

/**
 * Heures au-delà desquelles la cote d'un engin ne descend plus `[GD]`.
 *
 * Il reste toujours quelque chose à reprendre — la casse, les pièces. C'est
 * aussi ce qui rend le matériel d'occasion intéressant : une vieille machine
 * bien tenue est un vrai bon plan, pas un piège.
 */
export const MACHINE_END_OF_LIFE_HOURS = 1500;

/**
 * Ce que les heures retirent au rendement, définitivement `[GD]`.
 *
 * `conditionYieldFactor` punit le manque d'entretien, et l'atelier le répare.
 * Les heures, elles, ne se réparent pas — et jusqu'ici elles ne coûtaient rien
 * en jeu, seulement à la revente. Une moissonneuse de 1 500 h remise à neuf
 * ramassait donc exactement autant qu'une neuve, ce qui laissait le marché de
 * l'occasion sans contrepartie : on achetait moins cher, sans rien perdre.
 *
 * Un joueur l'a formulé comme la règle à trouver : une machine d'occasion doit
 * rendre « moins vite ou avec un malus sur le rendement, mais pas assez grave
 * pour que ça punisse trop », et l'affaire doit rester meilleure que faire
 * venir une entreprise.
 *
 * D'où une pente très douce, plafonnée à −8 % en fin de vie :
 *
 *     0 h    →  rendement plein
 *   300 h    →  −1,6 %      (occasion récente)
 *   600 h    →  −3,2 %      (occasion courante)
 *  1500 h +  →  −8 %        (bon pour la casse)
 *
 * Le repère : faire moissonner un champ par une entreprise coûte 22 % de sa
 * valeur, service et malus compris. Même à −8 %, posséder reste très loin
 * devant — c'est ce qui garde l'occasion attractive plutôt que piégeuse.
 */
export const MACHINE_AGE_YIELD_MALUS = 0.08;

export function machineAgeYieldFactor(hours: number): number {
  const part = Math.max(0, Math.min(1, hours / MACHINE_END_OF_LIFE_HOURS));
  return Math.round((1 - MACHINE_AGE_YIELD_MALUS * part) * 1000) / 1000;
}

export function isBreakdownKind(v: string | null | undefined): v is BreakdownKind {
  return v === "BELT" || v === "HYDRAULIC" || v === "ENGINE";
}

export function suggestedRepairKind(
  breakdown: string | null | undefined,
  condition: number,
): BreakdownKind {
  if (isBreakdownKind(breakdown)) return breakdown;
  if (condition < 20) return "ENGINE";
  if (condition < 45) return "HYDRAULIC";
  return "BELT";
}
