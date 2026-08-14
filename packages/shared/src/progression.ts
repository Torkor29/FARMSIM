import { BUILDING_DEFS, BUILDING_LEVELS, MAX_BUILDING_LEVEL, type BuildingType } from "./index.js";
import { PARCEL_LEVEL_GATES } from "./land.js";

/**
 * La progression du joueur : expérience, niveaux, et ce que chaque palier ouvre.
 *
 * Rien de tout cela n'existait. `user.level` n'était écrit que par le
 * triche-code du panneau de développement, et l'expérience ne tombait qu'en
 * trois endroits — mission terminée `+15`, contrat `+15`, vente `+10` quelle
 * que soit la quantité vendue. Un joueur légitime restait donc Nv.1 à vie,
 * pendant que les paliers de parcelle exigeaient le niveau 6, puis 10, puis 14.
 * Les deux moitiés du reproche — « on gagne de l'XP avec rien » et « niveau
 * trop bas pour une parcelle » — avaient la même cause.
 *
 * Deux principes commandent ce module.
 *
 * **L'expérience se gagne au travail, pas au clic.** Chaque barème est indexé
 * sur ce qui a réellement été fait : le nombre de cases, le tonnage récolté,
 * les bêtes soignées. Vendre une remorque ne peut pas rapporter autant qu'un
 * sac.
 *
 * **Un niveau ouvre des portes, il ne rend pas fort.** La charte
 * (`docs/research/06_PROGRESSION.md` §1) plafonne les bonus de niveau à +10 %
 * et préfère les déblocages non-statistiques. On va au bout de l'idée : **aucun
 * bonus chiffré**. Le niveau donne accès à des parcelles, à des paliers de
 * bâtiment et à des quêtes — le matériel et les décisions font le reste.
 */

/* ------------------------------------------------------------------ */
/* La courbe                                                           */
/* ------------------------------------------------------------------ */

/**
 * Coefficients de la courbe.
 *
 * Calés sur un rythme délibérément lent : une heure de jeu actif — un cycle
 * complet sur une parcelle de 144 cases, plus une vente — vaut environ 1 200
 * points au barème ci-dessous. Le deuxième champ (Nv.6) tombe donc vers la
 * troisième heure, le troisième (Nv.10) vers la septième. Les derniers paliers
 * se comptent en semaines : ils existent pour un joueur installé.
 */
const XP_BASE = 280;
const XP_CURVE = 1.55;

/** Dernier niveau utile : le plus haut palier de parcelle publié. */
export const MAX_LEVEL = PARCEL_LEVEL_GATES[PARCEL_LEVEL_GATES.length - 1];

/** Expérience cumulée nécessaire pour atteindre un niveau. */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  if (n <= 1) return 0;
  return Math.round(XP_BASE * Math.pow(n - 1, XP_CURVE));
}

/** Niveau atteint avec une expérience cumulée donnée. */
export function levelForXp(xp: number): number {
  const total = Math.max(0, Math.floor(xp));
  // L'inverse analytique, puis un pas de correction : l'arrondi de
  // `xpForLevel` peut décaler d'un rang près des seuils, et un joueur qui voit
  // « 3 500 / 3 500 XP » sans monter de niveau a raison de crier au bug.
  let n = Math.floor(Math.pow(total / XP_BASE, 1 / XP_CURVE)) + 1;
  while (n > 1 && xpForLevel(n) > total) n--;
  while (n < MAX_LEVEL && xpForLevel(n + 1) <= total) n++;
  return Math.min(MAX_LEVEL, Math.max(1, n));
}

/** Où en est le joueur dans son palier : de quoi dessiner une jauge. */
export function levelProgress(xp: number): {
  level: number;
  into: number;
  span: number;
  toNext: number;
} {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = level >= MAX_LEVEL ? floor : xpForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = Math.max(0, Math.min(span, xp - floor));
  return { level, into, span, toNext: Math.max(0, ceil - xp) };
}

/* ------------------------------------------------------------------ */
/* Le barème                                                           */
/* ------------------------------------------------------------------ */

export type XpEvent =
  | "PLANT"
  | "FERTILIZE"
  | "PLOW"
  | "STUBBLE"
  | "HARVEST"
  | "MOW"
  | "GRAZE"
  | "FEED"
  | "COLLECT"
  | "SLAUGHTER"
  | "BUILD"
  | "UPGRADE"
  | "MACHINE_CARE"
  | "MACHINE_BUY"
  | "SELL"
  | "DELIVER"
  | "CONTRACT"
  | "LABOR"
  | "QUEST";

/** Ce qui a réellement été fait — c'est là-dessus que se calcule le gain. */
export type XpContext = {
  /** Cases travaillées */
  cells?: number;
  /** Tonnes récoltées, vendues ou livrées */
  tons?: number;
  /** Bêtes concernées */
  animals?: number;
  /** Dépense engagée, en TRN */
  cost?: number;
  /** Récompense annoncée d'une quête */
  reward?: number;
};

/**
 * Barème d'expérience.
 *
 * Chaque ligne se lit « pour combien de travail, combien de points ». Les
 * forfaits qui subsistent — construire, entretenir — portent sur des gestes
 * uniques et coûteux, où il n'y a rien à compter.
 */
export const XP_TABLE: Record<XpEvent, (ctx: XpContext) => number> = {
  PLANT: (c) => cells(c),
  FERTILIZE: (c) => cells(c),
  // Le labour est le travail le plus lourd de la rotation.
  PLOW: (c) => cells(c) * 2,
  STUBBLE: (c) => cells(c),
  // La moisson paie deux fois : la surface parcourue, et ce qu'elle a donné.
  // C'est ce qui distingue un champ bien mené d'un champ affamé.
  HARVEST: (c) => cells(c) * 2 + Math.round(tons(c) * 8),
  MOW: (c) => Math.round(cells(c) * 1.5) + Math.round(tons(c) * 6),
  GRAZE: () => 4,
  FEED: () => 3,
  // Traire, ramasser, tondre : le geste, plus la taille du lot.
  COLLECT: (c) => 6 + animals(c) * 2,
  SLAUGHTER: (c) => 4 + animals(c) * 2,
  // Bâtir : proportionnel au prix, donc à l'ampleur du chantier.
  BUILD: (c) => 40 + Math.round(cost(c) / 50),
  UPGRADE: (c) => 30 + Math.round(cost(c) / 60),
  MACHINE_CARE: (c) => (cost(c) > 0 ? 8 + Math.round(cost(c) / 40) : 4),
  MACHINE_BUY: (c) => 20 + Math.round(cost(c) / 200),
  // Une tonne vendue, un point. Le forfait de dix payait pareil un sac et une
  // remorque — le geste comptait, pas la récolte.
  SELL: (c) => Math.max(1, Math.round(tons(c))),
  DELIVER: (c) => 12 + Math.round(tons(c)),
  CONTRACT: (c) => 15 + cells(c),
  LABOR: (c) => 15 + cells(c),
  QUEST: (c) => Math.max(0, Math.round(c.reward ?? 0)),
};

function cells(c: XpContext): number {
  return Math.max(0, Math.floor(c.cells ?? 0));
}
function tons(c: XpContext): number {
  return Math.max(0, c.tons ?? 0);
}
function animals(c: XpContext): number {
  return Math.max(0, Math.floor(c.animals ?? 0));
}
function cost(c: XpContext): number {
  return Math.max(0, c.cost ?? 0);
}

/** Points gagnés pour un travail donné. Jamais négatif. */
export function xpFor(event: XpEvent, ctx: XpContext = {}): number {
  return Math.max(0, Math.round(XP_TABLE[event](ctx)));
}

/* ------------------------------------------------------------------ */
/* Ce que chaque niveau ouvre                                          */
/* ------------------------------------------------------------------ */

export type LevelUnlock = {
  level: number;
  /** Expérience cumulée pour y arriver */
  xp: number;
  /** Ce qui s'ouvre, en une ligne */
  label: string;
  /** Pourquoi ça compte */
  detail: string;
};

/** Le rang d'une parcelle, en toutes lettres. */
function rank(n: number): string {
  return n === 2 ? "deuxième" : n === 3 ? "troisième" : `${n}ᵉ`;
}

/**
 * La table des paliers, **dérivée des règles** et non recopiée à la main.
 *
 * C'est ce qui garantit que la documentation en jeu dit la vérité : si un
 * palier de parcelle ou de bâtiment bouge, cette table bouge avec lui. Une
 * table écrite à part aurait divergé au premier ajustement.
 */
export function levelUnlocks(): LevelUnlock[] {
  const byLevel = new Map<number, string[]>();
  const add = (level: number, what: string) => {
    const list = byLevel.get(level) ?? [];
    list.push(what);
    byLevel.set(level, list);
  };

  PARCEL_LEVEL_GATES.forEach((level, i) => {
    if (i === 0) return;
    add(level, `${rank(i + 1)} parcelle`);
  });

  for (let l = 2; l <= MAX_BUILDING_LEVEL; l++) {
    const def = BUILDING_LEVELS[l - 1];
    if (def.requiredLevel <= 1) continue;
    add(def.requiredLevel, `bâtiments niveau ${l} — ${def.name.toLowerCase()}`);
  }

  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([level, what]) => ({
      level,
      xp: xpForLevel(level),
      label: what.join(" · "),
      detail:
        what.length > 1
          ? "Deux ouvertures d'un coup à ce palier."
          : what[0].includes("parcelle")
            ? "Un champ de plus à acheter — il reste à le payer."
            : "Vos bâtiments peuvent monter d'un cran.",
    }));
}

/**
 * Le palier suivant qui apporte quelque chose, s'il y en a un.
 *
 * Beaucoup de niveaux n'ouvrent rien : le dire franchement vaut mieux que
 * d'inventer un demi-pourcent pour meubler.
 */
export function nextUnlock(level: number): LevelUnlock | null {
  return levelUnlocks().find((u) => u.level > level) ?? null;
}

/** Ce qu'il manque pour un palier, dit en clair plutôt qu'en « niveau trop bas ». */
export function shortfall(xp: number, requiredLevel: number): string {
  const now = levelForXp(xp);
  const need = Math.max(0, xpForLevel(requiredLevel) - xp);
  return `Niveau ${requiredLevel} requis — vous êtes Nv.${now}, encore ${need} XP`;
}

/** Coût d'un bâtiment, pour le barème de `BUILD`. */
export function buildingXpCost(type: BuildingType): number {
  return BUILDING_DEFS[type].cost;
}
