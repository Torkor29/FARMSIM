/**
 * Économie foncière v2 — moteur de prix, plafonds, taxe, inactivité, enchères.
 *
 * Implémentation de `docs/research/32_LAND_ECONOMY.md`. Tout est pur : aucune
 * fonction ne lit l'horloge, la base ou le réseau — l'instant courant est
 * toujours passé en paramètre pour rester rejouable en simulation.
 *
 * Le pari d'équilibrage : le prix est un produit de facteurs **tous bornés**,
 * ce qui borne mécaniquement l'écart entre la meilleure et la pire parcelle
 * (ratio visé 3–5×), tandis que l'escalade patrimoniale `1,40^(n−1)`, elle,
 * n'est pas bornée par le marché mais par le plafond dur de 16 parcelles.
 * C'est cette escalade qui porte l'essentiel du frein anti-monopole.
 *
 * @see docs/research/32_LAND_ECONOMY.md
 */

import type { Hemisphere } from "./world.js";

/* ------------------------------------------------------------------ */
/* Constantes de référence                                             */
/* ------------------------------------------------------------------ */

/** Prix de référence surfacique `[GD]` */
export const LAND_BASE_PER_HA = 420;

/** Surface d'une parcelle 12×12 `[GD]` — figé par `23_GRID_SIZING.md` */
export const LAND_PARCEL_HA = 14;

/** Prix d'une parcelle « tout neutre » : 420 × 14 = 5 880 CRD `[GD]` */
export const LAND_REFERENCE_PRICE = LAND_BASE_PER_HA * LAND_PARCEL_HA;

/** Escalade patrimoniale par parcelle déjà possédée `[GD]` */
export const LAND_OWNERSHIP_STEP = 1.4;

/** Plancher / plafond du produit des facteurs de marché `[GD]` */
export const LAND_PRICE_FLOOR_MULT = 0.45;
export const LAND_PRICE_CEIL_MULT = 6;

/** Les prix affichés sont arrondis au multiple de 50 supérieur `[GD]` */
export const LAND_PRICE_ROUNDING = 50;

/** Durée d'un cycle économique foncier `[GD]` — 24 h réelles */
export const LAND_CYCLE_MS = 24 * 60 * 60 * 1000;

/** Une saison foncière vaut 7 cycles `[GD]` */
export const LAND_CYCLES_PER_SEASON = 7;

/** Rachat au NPC : 65 % de la valeur publique, les 35 % restants sont un sink `[GD]` */
export const LAND_BUYBACK_RATE = 0.65;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arrondi au multiple supérieur — lisibilité des prix en UI. */
function roundUpTo(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

/* ------------------------------------------------------------------ */
/* 1. Les six facteurs de marché                                       */
/* ------------------------------------------------------------------ */

/**
 * Aptitude agronomique moyenne par climat de Köppen `[GD]`.
 * Les climats à forte marge (Csa, Aw) sont volontairement médiocres pour les
 * céréales : aucune région ne doit être « la meilleure pour tout ».
 */
export const KOPPEN_CLIMATE_FACTOR: Record<string, number> = {
  Cfb: 1.15,
  Cfa: 1.12,
  Dfa: 1.2,
  Dfb: 1.05,
  Csa: 1.0,
  Aw: 0.95,
  BSk: 0.88,
  BWh: 0.8,
  Dfc: 0.8,
  ET: 0.8,
};

/** Valeur de repli par famille Köppen, pour les climats hors table `[HYPOTHÈSE]` */
const KOPPEN_FAMILY_FALLBACK: Record<string, number> = {
  A: 0.95,
  B: 0.85,
  C: 1.05,
  D: 1.0,
  E: 0.8,
};

/** Surcote si la région est classée A pour au moins deux cultures actives `[GD]` */
export const CROP_FIT_BONUS = 1.05;

/** Bornes explicites de chaque facteur — la borne, pas la formule, tient l'équilibrage. */
export const LAND_FACTOR_BOUNDS = {
  fertility: { min: 0.7, max: 1.3 },
  climate: { min: 0.8, max: 1.25 },
  access: { min: 0.8, max: 1.1 },
  density: { min: 1.0, max: 1.35 },
  scarcity: { min: 1.0, max: 1.9 },
  adjacency: { min: 1.0, max: 1.32 },
} as const;

/** `f_fert = 0,70 + 0,60 × fertility` `[GD]` */
export function fertilityFactor(fertility: number): number {
  const raw = 0.7 + 0.6 * clamp(fertility, 0, 1);
  return clamp(raw, LAND_FACTOR_BOUNDS.fertility.min, LAND_FACTOR_BOUNDS.fertility.max);
}

/** `f_clim = K[koppen] × cropFitBonus` `[GD]` */
export function climateFactor(koppen: string, cropFitA: boolean = false): number {
  const table = KOPPEN_CLIMATE_FACTOR[koppen];
  const base = table ?? KOPPEN_FAMILY_FALLBACK[koppen.charAt(0)] ?? 1;
  const raw = base * (cropFitA ? CROP_FIT_BONUS : 1);
  return clamp(raw, LAND_FACTOR_BOUNDS.climate.min, LAND_FACTOR_BOUNDS.climate.max);
}

/** `f_access = 0,80 + 0,30 × A` `[GD]` */
export function accessFactor(accessIndex: number): number {
  const raw = 0.8 + 0.3 * clamp(accessIndex, 0, 1);
  return clamp(raw, LAND_FACTOR_BOUNDS.access.min, LAND_FACTOR_BOUNDS.access.max);
}

/** Distance maximale au hub prise en compte dans l'indice d'accès `[GD]` */
export const LAND_HUB_DISTANCE_MAX = 8;

/**
 * Indice d'accès `A ∈ [0 ; 1]` : 70 % de proximité du hub, 30 % d'infrastructures.
 * Une région qui gagne un silo revalorise donc **toutes** ses parcelles — c'est
 * un levier de méta-jeu voulu, pas un effet de bord. `[GD]`
 */
export function accessIndex(input: {
  /** Distance de Chebyshev en cases carte jusqu'au hub de marché */
  hubDistance: number;
  road: number;
  silo: number;
  rail: number;
}): number {
  const proximity = clamp(1 - input.hubDistance / LAND_HUB_DISTANCE_MAX, 0, 1);
  const infra =
    0.4 * clamp(input.road, 0, 1) +
    0.35 * clamp(input.silo, 0, 1) +
    0.25 * clamp(input.rail, 0, 1);
  return clamp(proximity * 0.7 + infra * 0.3, 0, 1);
}

/**
 * `f_dens = 1 + 0,35 × ρ^0,8` `[TEST]`
 * La densité de voisins apporte des externalités réelles (marché local liquide,
 * contrats ETA, entraide) : elle doit se payer.
 */
export function densityFactor(neighborDensity: number): number {
  const raw = 1 + 0.35 * Math.pow(clamp(neighborDensity, 0, 1), 0.8);
  return clamp(raw, LAND_FACTOR_BOUNDS.density.min, LAND_FACTOR_BOUNDS.density.max);
}

/** `f_scar = 1 + 0,90 × O²` `[TEST]` — quadratique : la tension ne mord qu'en fin de peuplement */
export function scarcityFactor(occupancy: number): number {
  const o = clamp(occupancy, 0, 1);
  return clamp(1 + 0.9 * o * o, LAND_FACTOR_BOUNDS.scarcity.min, LAND_FACTOR_BOUNDS.scarcity.max);
}

/** Nombre maximal de bords communs d'une parcelle carrée. */
export const LAND_MAX_ADJACENT_BORDERS = 4;

/**
 * `f_adj = 1 + 0,08 × k` `[GD]`
 * L'adjacence est un bénéfice (§3.1), donc elle se paie : sans cette surcote,
 * « toujours acheter contigu » serait l'optimum trivial.
 */
export function adjacencyFactor(adjacentOwnedBorders: number): number {
  const k = clamp(Math.floor(adjacentOwnedBorders), 0, LAND_MAX_ADJACENT_BORDERS);
  return clamp(
    1 + 0.08 * k,
    LAND_FACTOR_BOUNDS.adjacency.min,
    LAND_FACTOR_BOUNDS.adjacency.max,
  );
}

/**
 * `f_own = 1,40^(n−1)`, `n` = rang de la parcelle pour l'acheteur `[GD]`.
 * Rang 1 (la starter, offerte) → 1,00 ; rang 16 (plafond dur) → ×155.
 */
export function ownershipFactor(ownershipRank: number): number {
  const exponent = clamp(Math.floor(ownershipRank) - 1, 0, LAND_CAPS.global - 1);
  return Math.pow(LAND_OWNERSHIP_STEP, exponent);
}

/* ------------------------------------------------------------------ */
/* 1.b Prix : marketValue (public) et askPrice (personnalisé)          */
/* ------------------------------------------------------------------ */

/** Entrées publiques d'une parcelle — identiques pour tous les joueurs. */
export type ParcelValuationInput = {
  /** Fertilité du sol, 0–1 */
  fertility: number;
  koppen: string;
  /** Région classée A pour ≥ 2 cultures du catalogue actif */
  cropFitA?: boolean;
  /** Indice d'accès `A ∈ [0 ; 1]`, cf. `accessIndex()` */
  accessIndex: number;
  /** Densité de voisins `ρ ∈ [0 ; 1]` */
  neighborDensity: number;
  /** Occupation du continent `O ∈ [0 ; 1]` */
  occupancy: number;
};

/** Entrées personnalisées : ce que le prix doit à l'acheteur, pas à la parcelle. */
export type AskPriceInput = ParcelValuationInput & {
  /** Bords communs avec les parcelles de l'acheteur, 0–4 */
  adjacentOwnedBorders: number;
  /** Rang de cette parcelle dans le patrimoine de l'acheteur (1 = la première) */
  ownershipRank: number;
};

/** Un facteur tel qu'il doit s'afficher : sa valeur et ce qu'il coûte en CRD. */
export type PriceFactorDetail = {
  /** Multiplicateur appliqué */
  value: number;
  /** CRD ajoutés (ou retirés) par ce facteur, dans l'ordre d'application */
  contribution: number;
};

/**
 * Décomposition intégrale du prix. Invariant garanti :
 * `base + Σ contributions + clampAdjustment + roundingAdjustment === total`.
 * La transparence est obligatoire (§10) : l'escalade `1,40^n` n'est acceptable
 * que si le joueur la voit ligne à ligne.
 */
export type PriceBreakdown = {
  base: number;
  fertility: PriceFactorDetail;
  climate: PriceFactorDetail;
  access: PriceFactorDetail;
  density: PriceFactorDetail;
  scarcity: PriceFactorDetail;
  adjacency: PriceFactorDetail;
  ownership: PriceFactorDetail;
  /** Effet du clamp `[0,45 ; 6,0] × P_ref × f_own` (anti-spirale inflationniste) */
  clampAdjustment: number;
  /** Effet de l'arrondi au multiple de 50 supérieur */
  roundingAdjustment: number;
  total: number;
};

type FactorSet = {
  fertility: number;
  climate: number;
  access: number;
  density: number;
  scarcity: number;
  adjacency: number;
  ownership: number;
};

function marketFactors(input: ParcelValuationInput): Omit<FactorSet, "adjacency" | "ownership"> {
  return {
    fertility: fertilityFactor(input.fertility),
    climate: climateFactor(input.koppen, input.cropFitA ?? false),
    access: accessFactor(input.accessIndex),
    density: densityFactor(input.neighborDensity),
    scarcity: scarcityFactor(input.occupancy),
  };
}

/**
 * Valeur publique de référence : **sans** adjacence ni escalade patrimoniale.
 * C'est elle qui sert d'assiette à la taxe, de mise à prix aux enchères, de
 * base au rachat NPC et d'affichage des parcelles d'autrui.
 */
export function marketValue(input: ParcelValuationInput): number {
  const f = marketFactors(input);
  const raw =
    LAND_REFERENCE_PRICE * f.fertility * f.climate * f.access * f.density * f.scarcity;
  const bounded = clamp(
    raw,
    LAND_PRICE_FLOOR_MULT * LAND_REFERENCE_PRICE,
    LAND_PRICE_CEIL_MULT * LAND_REFERENCE_PRICE,
  );
  return roundUpTo(bounded, LAND_PRICE_ROUNDING);
}

/**
 * Prix d'achat au NPC pour **ce** joueur : valeur de marché × surcote
 * d'adjacence × escalade patrimoniale, borné puis arrondi.
 */
export function askPrice(input: AskPriceInput): { total: number; breakdown: PriceBreakdown } {
  const f: FactorSet = {
    ...marketFactors(input),
    adjacency: adjacencyFactor(input.adjacentOwnedBorders),
    ownership: ownershipFactor(input.ownershipRank),
  };

  // Contributions calculées en cascade : chaque facteur s'applique au sous-total
  // déjà accumulé, ce qui rend la somme exactement égale au produit.
  let running = LAND_REFERENCE_PRICE;
  const detail = (value: number): PriceFactorDetail => {
    const contribution = running * (value - 1);
    running += contribution;
    return { value, contribution };
  };

  const fertility = detail(f.fertility);
  const climate = detail(f.climate);
  const access = detail(f.access);
  const density = detail(f.density);
  const scarcity = detail(f.scarcity);
  const adjacency = detail(f.adjacency);
  const ownership = detail(f.ownership);

  // Le clamp suit l'escalade patrimoniale : il borne le marché, pas l'anti-monopole.
  const bounded = clamp(
    running,
    LAND_PRICE_FLOOR_MULT * LAND_REFERENCE_PRICE * f.ownership,
    LAND_PRICE_CEIL_MULT * LAND_REFERENCE_PRICE * f.ownership,
  );
  const total = roundUpTo(bounded, LAND_PRICE_ROUNDING);

  return {
    total,
    breakdown: {
      base: LAND_REFERENCE_PRICE,
      fertility,
      climate,
      access,
      density,
      scarcity,
      adjacency,
      ownership,
      clampAdjustment: bounded - running,
      roundingAdjustment: total - bounded,
      total,
    },
  };
}

/** Prix de rachat par le NPC — l'écart de 35 % décourage le flip spéculatif `[GD]` */
export function buybackPrice(parcelMarketValue: number): number {
  return Math.round(Math.max(0, parcelMarketValue) * LAND_BUYBACK_RATE);
}

/* ------------------------------------------------------------------ */
/* 2. Anti-monopole                                                    */
/* ------------------------------------------------------------------ */

export type LandCaps = {
  /** Parcelles par joueur, toutes régions confondues */
  global: number;
  /** Parcelles par joueur et par région */
  perRegion: number;
  /** Part maximale d'une région détenue par un seul joueur */
  regionSharePct: number;
};

/** Plafonds durs §5.1 `[GD]` — aucune exception, non déblocables en PRM. */
export const LAND_CAPS: LandCaps = { global: 16, perRegion: 6, regionSharePct: 0.4 };

export type AcquisitionRule =
  | "LEVEL_TOO_LOW"
  | "MAX_PARCELS_PER_PLAYER"
  | "MAX_PARCELS_PER_REGION"
  | "MAX_REGION_SHARE_PLAYER";

export type AcquisitionState = {
  /** Parcelles déjà possédées, toutes régions confondues */
  ownedTotal: number;
  /** Parcelles déjà possédées dans la région visée */
  ownedInRegion: number;
  /** Nombre total de parcelles de la région visée */
  regionParcelCount: number;
  /** Niveau du joueur */
  playerLevel: number;
};

/**
 * Éligibilité à l'acquisition : trois plafonds durs + le palier de niveau.
 * L'ordre des vérifications est celui de l'UI (le motif le plus explicable
 * d'abord) et le premier échec l'emporte.
 */
export function canAcquire(state: AcquisitionState): { ok: boolean; reason?: AcquisitionRule } {
  const nextRank = Math.max(0, Math.floor(state.ownedTotal)) + 1;

  if (state.playerLevel < requiredLevelForParcel(nextRank)) {
    return { ok: false, reason: "LEVEL_TOO_LOW" };
  }
  if (nextRank > LAND_CAPS.global) {
    return { ok: false, reason: "MAX_PARCELS_PER_PLAYER" };
  }
  if (state.ownedInRegion + 1 > LAND_CAPS.perRegion) {
    return { ok: false, reason: "MAX_PARCELS_PER_REGION" };
  }
  if (
    state.regionParcelCount > 0 &&
    (state.ownedInRegion + 1) / state.regionParcelCount > LAND_CAPS.regionSharePct
  ) {
    return { ok: false, reason: "MAX_REGION_SHARE_PLAYER" };
  }
  return { ok: true };
}

/**
 * Paliers de niveau §4.1 `[GD]`. Les rangs 11, 13 et 15, absents de la table
 * publiée, sont interpolés linéairement entre leurs voisins `[HYPOTHÈSE]`.
 */
const PARCEL_LEVEL_GATES: readonly number[] = [
  1, 6, 10, 14, 18, 23, 28, 33, 39, 45, 51, 58, 65, 72, 78, 85,
];

/** Niveau minimum pour posséder la n-ième parcelle (1 = la starter, offerte). */
export function requiredLevelForParcel(index: number): number {
  const rank = clamp(Math.floor(index), 1, PARCEL_LEVEL_GATES.length);
  return PARCEL_LEVEL_GATES[rank - 1];
}

/** Charge de gestion de référence, en CRD par cycle et par parcelle `[GD]` */
export const LAND_MANAGEMENT_BASE = 180;

/**
 * Charge de gestion `180 × n^1,25` CRD/cycle `[GD]`.
 * Surlinéaire à dessein : contrairement aux économies d'échelle machine, qui
 * sont monotones, c'est ce poste-là qui rend la 11ᵉ parcelle discutable.
 */
export function managementLoad(parcelCount: number): number {
  const n = Math.max(0, Math.floor(parcelCount));
  if (n === 0) return 0;
  return Math.round(LAND_MANAGEMENT_BASE * Math.pow(n, 1.25));
}

/**
 * Rendements décroissants §5.2 `[GD]`, indexés sur le **rang** de la parcelle
 * (le malus frappe les parcelles de plus faible `marketValue`, pas celles que
 * le joueur choisirait — pas de micro-optimisation stérile).
 */
export function diminishingYield(parcelCount: number): number {
  const rank = Math.floor(parcelCount);
  if (rank <= 4) return 1;
  if (rank <= 8) return 0.97;
  if (rank <= 12) return 0.94;
  return 0.9;
}

/* ------------------------------------------------------------------ */
/* 3. Taxe foncière progressive                                        */
/* ------------------------------------------------------------------ */

/** Taux de base par saison `[TEST]` */
export const LAND_TAX_RATE = 0.016;

/** Progressivité par parcelle supplémentaire `[TEST]` */
export const LAND_TAX_PROGRESSION = 0.12;

/** Plafond du multiplicateur progressif — atteint à 13 parcelles `[TEST]` */
export const LAND_TAX_MULT_CAP = 2.5;

/**
 * Parcelles exonérées `[GD]` : la moins valorisée du patrimoine est assimilée à
 * la parcelle starter, inaliénable et jamais saisissable (§2.3). Le joueur
 * mono-parcelle ne paie donc rien — écart assumé avec la table §2.4, qui
 * facture 240 CRD dès la première.
 */
export const LAND_TAX_EXEMPT_COUNT = 1;

/** Multiplicateur progressif `1 + 0,12 × (n − 1)`, plafonné à ×2,5. */
export function landTaxMultiplier(parcelCount: number): number {
  const n = Math.max(1, Math.floor(parcelCount));
  return Math.min(LAND_TAX_MULT_CAP, 1 + LAND_TAX_PROGRESSION * (n - 1));
}

/**
 * Taxe foncière d'une saison, parcelle par parcelle.
 *
 * Le multiplicateur progressif se calcule sur le patrimoine **entier**
 * (exonérations comprises) : l'exonération protège l'entrée de jeu, elle
 * n'allège pas la progressivité des gros patrimoines.
 */
export function landTax(parcels: { marketValue: number }[]): {
  total: number;
  perParcel: number[];
  exemptCount: number;
} {
  const multiplier = landTaxMultiplier(parcels.length);
  const exemptCount = Math.min(LAND_TAX_EXEMPT_COUNT, parcels.length);

  // Exonération sur les parcelles les moins valorisées, désignées par valeur
  // et non par choix du joueur.
  const exemptIndexes = new Set(
    parcels
      .map((p, index) => ({ index, value: p.marketValue }))
      .sort((a, b) => a.value - b.value || a.index - b.index)
      .slice(0, exemptCount)
      .map((p) => p.index),
  );

  const perParcel = parcels.map((parcel, index) =>
    exemptIndexes.has(index)
      ? 0
      : Math.round(Math.max(0, parcel.marketValue) * LAND_TAX_RATE * multiplier),
  );

  return {
    total: perParcel.reduce((sum, amount) => sum + amount, 0),
    perParcel,
    exemptCount,
  };
}

/** Prélèvement quotidien : la taxe de saison étalée sur 7 cycles. */
export function landTaxPerCycle(seasonTax: number): number {
  return seasonTax / LAND_CYCLES_PER_SEASON;
}

/* ------------------------------------------------------------------ */
/* 4. Inactivité, jachère, saisie                                      */
/* ------------------------------------------------------------------ */

export type LandStatus = "ACTIVE" | "DORMANT" | "FALLOW" | "SEIZED";

export const LAND_STATUS_LABELS: Record<LandStatus, string> = {
  ACTIVE: "Exploitée",
  DORMANT: "En veille",
  FALLOW: "En jachère",
  SEIZED: "Saisie",
};

/**
 * Seuils d'inactivité en cycles `[GD]`. Échelle progressive et réversible
 * jusqu'au dernier palier : squatter doit coûter cher, pas être impossible.
 */
export const LAND_INACTIVITY_CYCLES: Record<Exclude<LandStatus, "ACTIVE">, number> = {
  DORMANT: 14,
  FALLOW: 30,
  SEIZED: 60,
};

/** Effets de chaque palier, pour l'UI et le moteur de production `[GD]` */
export const LAND_STATUS_EFFECTS: Record<
  LandStatus,
  { yieldMult: number; taxMult: number; fertilityDriftPerCycle: number }
> = {
  ACTIVE: { yieldMult: 1, taxMult: 1, fertilityDriftPerCycle: 0 },
  DORMANT: { yieldMult: 0.5, taxMult: 1.5, fertilityDriftPerCycle: 0 },
  FALLOW: { yieldMult: 0, taxMult: 1.5, fertilityDriftPerCycle: -0.01 },
  SEIZED: { yieldMult: 0, taxMult: 0, fertilityDriftPerCycle: -0.01 },
};

/** Statut d'une parcelle d'après la dernière connexion de son propriétaire. */
export function landStatusFor(lastSeenMs: number, now: number): LandStatus {
  const cycles = Math.max(0, now - lastSeenMs) / LAND_CYCLE_MS;
  if (cycles >= LAND_INACTIVITY_CYCLES.SEIZED) return "SEIZED";
  if (cycles >= LAND_INACTIVITY_CYCLES.FALLOW) return "FALLOW";
  if (cycles >= LAND_INACTIVITY_CYCLES.DORMANT) return "DORMANT";
  return "ACTIVE";
}

/**
 * Coût d'une remise en état après jachère : `900 × (0,70 − fertility) / 0,10`,
 * plafonné à 4 500 CRD `[TEST]`.
 */
export function fallowRestorationCost(fertility: number): number {
  const gap = Math.max(0, 0.7 - fertility);
  return Math.round(Math.min(4500, (900 * gap) / 0.1));
}

/* ------------------------------------------------------------------ */
/* 5. Bénéfices de l'expansion                                         */
/* ------------------------------------------------------------------ */

/** Gain par bord commun et plafond global d'adjacence `[GD]` */
export const ADJACENCY_BONUS_PER_BORDER = 0.015;
export const ADJACENCY_BONUS_CAP = 0.1;

/** Couverture inter-hémisphères : les saisons inversées lissent l'année `[GD]` */
export const HEMISPHERE_HEDGE_BONUS = 0.05;

/** Coefficient de variation du revenu d'une parcelle isolée `[TEST]` */
export const INCOME_CV_SINGLE = 0.28;

/** Corrélation météo entre climats Köppen distincts `[HYPOTHÈSE]` */
export const INTER_CLIMATE_CORRELATION = 0.35;

/**
 * Conversion de la baisse de volatilité en bonus de rendement `[GD]`.
 * Volontairement faible : le vrai gain de la diversification reste la variance
 * évitée, pas un pourcentage de plus.
 */
export const DIVERSIFICATION_YIELD_WEIGHT = 0.14;
export const DIVERSIFICATION_BONUS_CAP = 0.04;

/** Plafond de l'ensemble des bonus patrimoniaux `[GD]` */
export const ESTATE_BONUS_CAP = 0.15;

/** `CV(k) = CV₁ × √((1 + (k−1)·ρ) / k)` pour `k` climats distincts. */
export function portfolioVolatility(distinctClimates: number): number {
  const k = Math.max(1, Math.floor(distinctClimates));
  return INCOME_CV_SINGLE * Math.sqrt((1 + (k - 1) * INTER_CLIMATE_CORRELATION) / k);
}

/** Volatilité évitée par rapport à une exploitation mono-climat (0 → 1). */
export function volatilityReduction(distinctClimates: number): number {
  return 1 - portfolioVolatility(distinctClimates) / INCOME_CV_SINGLE;
}

/**
 * Bonus structurels du patrimoine foncier.
 * Trois sources indépendantes, chacune plafonnée, et un plafond global : le
 * total ne doit jamais transformer l'expansion en « plus de tout ».
 */
export function estateBonuses(input: {
  adjacentOwned: number;
  hemispheres: Hemisphere[];
  climates: string[];
}): { adjacency: number; hedge: number; diversification: number; total: number } {
  const adjacency = Math.min(
    ADJACENCY_BONUS_CAP,
    ADJACENCY_BONUS_PER_BORDER * Math.max(0, Math.floor(input.adjacentOwned)),
  );

  const hedge =
    input.hemispheres.includes("N") && input.hemispheres.includes("S")
      ? HEMISPHERE_HEDGE_BONUS
      : 0;

  const distinctClimates = new Set(input.climates).size;
  const diversification = Math.min(
    DIVERSIFICATION_BONUS_CAP,
    DIVERSIFICATION_YIELD_WEIGHT * volatilityReduction(distinctClimates),
  );

  return {
    adjacency,
    hedge,
    diversification,
    total: Math.min(ESTATE_BONUS_CAP, adjacency + hedge + diversification),
  };
}

/* ------------------------------------------------------------------ */
/* 6. Enchères — données et calculs, sans API                          */
/* ------------------------------------------------------------------ */

export type AuctionReason = "PREMIUM" | "RECLAIM";

export type LandAuctionState = {
  parcelId: string;
  reason: AuctionReason;
  /** Mise à prix, égale à la valeur publique */
  startPrice: number;
  /** Meilleure mise, `null` tant qu'aucune n'est enregistrée */
  currentBid: number | null;
  bidCount: number;
  opensAtMs: number;
  closesAtMs: number;
};

/** Paramètres d'enchère §2.5 `[GD]` */
export const LAND_AUCTION = {
  durationMs: 48 * 60 * 60 * 1000,
  /** Incrément minimal entre deux mises */
  minIncrementPct: 0.02,
  /** Anti-snipe : toute mise dans la dernière fenêtre prolonge la vente */
  antiSnipeWindowMs: 2 * 60 * 1000,
  antiSnipeExtensionMs: 2 * 60 * 1000,
  /** Commission d'adjudication, détruite */
  commissionPct: 0.05,
  /** Dépôt de garantie bloqué, perdu en cas de défaut */
  depositPct: 0.1,
  /** Plafond de mise — anti-troll et anti-blanchiment */
  maxBidMultiple: 8,
  /** Les mises sont arrondies au multiple de 10 CRD supérieur */
  bidRounding: 10,
} as const;

/** Mise à prix : la valeur publique, sans surcote personnelle. */
export function auctionStartPrice(parcelMarketValue: number): number {
  return roundUpTo(
    Math.max(LAND_PRICE_ROUNDING, parcelMarketValue),
    LAND_PRICE_ROUNDING,
  );
}

/** Mise minimale suivante : `+2 %` arrondis au multiple de 10 supérieur. */
export function minimumBid(current: number): number {
  const target = Math.max(0, current) * (1 + LAND_AUCTION.minIncrementPct);
  return roundUpTo(target, LAND_AUCTION.bidRounding);
}

/** Plafond de mise d'un joueur : le moins-disant entre sa trésorerie et 8 × la valeur. */
export function maximumBid(parcelMarketValue: number, availableCrd: number): number {
  return Math.max(
    0,
    Math.min(availableCrd, LAND_AUCTION.maxBidMultiple * parcelMarketValue),
  );
}

/** Commission d'adjudication détruite à la clôture. */
export function auctionCommission(finalPrice: number): number {
  return Math.round(Math.max(0, finalPrice) * LAND_AUCTION.commissionPct);
}
