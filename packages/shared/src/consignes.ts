/**
 * Consignes d’absence : si le joueur part, les cases déjà engagées se
 * publient toutes seules. Jamais de culture nouvelle — trop de décision.
 *
 * @see docs/research/49_TRIANGLE_METIERS.md §6
 */

export const CONSIGNE_AWAY_MS = 180_000;

/**
 * Part de la commune tenue par des exploitants PNJ.
 *
 * Trente pour cent laissaient sept parcelles sur dix sans personne dessus :
 * vu du champ, le voisinage était un damier vide, et le reproche revenait —
 * « le PNJ a des bâtiments des bêtes céréales tout ». Une commune, c'est de la
 * terre exploitée ; les parcelles libres en sont l'exception, pas la règle.
 *
 * La moitié, et pas davantage : le joueur ne peut posséder que quarante pour
 * cent d'une région (`LAND_CAPS.regionSharePct`), et il doit rester plus de
 * terre à vendre que ce plafond — sans quoi on lui montrerait une limite qu'il
 * ne pourrait jamais atteindre.
 */
export const NPC_PARCEL_SHARE = 0.5;

/** Les fermes PNJ paient un peu moins que le barème joueur. */
export const NPC_LABOR_QUOTE_MULT = 0.88;

export type Consignes = {
  harvest: boolean;
  stubble: boolean;
  plow: boolean;
  straw: boolean;
  /** Si personne ne prend, une culture peut se perdre. Affiché en rouge. */
  npcAllowed: boolean;
  /** Plafond de dépense pour une absence, en €. */
  maxSpend: number;
};

export const DEFAULT_CONSIGNES: Consignes = {
  harvest: true,
  stubble: true,
  plow: false,
  straw: true,
  npcAllowed: true,
  maxSpend: 500,
};

export type AbsenceLogLine = {
  at: string;
  text: string;
};

export type AbsenceLog = {
  spent: number;
  lines: AbsenceLogLine[];
};

export const EMPTY_ABSENCE_LOG: AbsenceLog = { spent: 0, lines: [] };

export function parseConsignes(raw: string | null | undefined): Consignes {
  if (!raw) return { ...DEFAULT_CONSIGNES };
  try {
    const v = JSON.parse(raw) as Partial<Consignes>;
    const maxSpend = Number(v.maxSpend);
    return {
      harvest: v.harvest !== false,
      stubble: v.stubble !== false,
      plow: v.plow === true,
      straw: v.straw !== false,
      npcAllowed: v.npcAllowed !== false,
      maxSpend: Number.isFinite(maxSpend) ? Math.max(0, Math.round(maxSpend)) : DEFAULT_CONSIGNES.maxSpend,
    };
  } catch {
    return { ...DEFAULT_CONSIGNES };
  }
}

export function parseAbsenceLog(raw: string | null | undefined): AbsenceLog {
  if (!raw) return { spent: 0, lines: [] };
  try {
    const v = JSON.parse(raw) as Partial<AbsenceLog>;
    const spent = Number(v.spent);
    const lines = Array.isArray(v.lines)
      ? v.lines.filter(
          (l): l is AbsenceLogLine =>
            !!l && typeof l === "object" && typeof l.at === "string" && typeof l.text === "string",
        )
      : [];
    return { spent: Number.isFinite(spent) ? Math.max(0, spent) : 0, lines };
  } catch {
    return { spent: 0, lines: [] };
  }
}

/** Travaux que les consignes ont le droit de publier — jamais un semis. */
export const CONSIGNE_WORKS = [
  "HARVEST",
  "STUBBLE",
  "PLOW",
  "BALE",
  "COLLECT",
  "SILAGE",
] as const;

export type ConsigneWork = (typeof CONSIGNE_WORKS)[number];

export function isConsigneWork(work: string): work is ConsigneWork {
  return (CONSIGNE_WORKS as readonly string[]).includes(work);
}
