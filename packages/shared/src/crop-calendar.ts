/**
 * Le calendrier des cultures, **déduit** de la simulation.
 *
 * Un calendrier agricole dessiné à la main est un mensonge en sursis : il dit
 * « le blé se moissonne en été » jusqu'au jour où l'on retouche une vitesse de
 * pousse, et plus personne ne s'en aperçoit. Ce module ne dessine rien. Il
 * fait pousser chaque culture avec exactement les fonctions qu'emploie le
 * champ — `canSowInSeason` pour la fenêtre, `growthRate` pour la vitesse — et
 * rapporte ce qui s'est passé.
 *
 * ## Pourquoi des saisons, et non plus des jours
 *
 * Le calendrier avait sept colonnes, une par jour de la semaine, parce que
 * l'année de jeu tombait pile sur la semaine réelle. C'était précisément le
 * défaut à corriger : un joueur du week-end ne voyait que deux saisons sur
 * quatre, à vie. Les saisons glissent désormais dans la journée
 * (`SEASON_REAL_HOURS`), et « lundi » ne dit plus rien de la saison qu'il
 * portera.
 *
 * Les colonnes sont donc les quatre saisons, ce qui est de toute façon le seul
 * repère dont un agriculteur se sert : on ne sème pas « un mardi », on sème à
 * l'automne.
 *
 * ## Ce qui est volontairement ignoré
 *
 * La météo. Elle accélère ou ralentit la pousse au jour le jour, mais elle est
 * tirée par zone : l'intégrer donnerait un calendrier différent par région,
 * ce qui n'est plus un calendrier mais un bulletin.
 */

import { canSowInSeason, growthRate } from "./calendar.js";
import { cropGrowMs, type CropCode, CROP_DEFS } from "./index.js";
import { SEASON_CYCLE, SEASON_REAL_MS } from "./time.js";
import type { Season } from "./world.js";

export const SEASON_LABELS_FR: Record<Season, string> = {
  SPRING: "Printemps",
  SUMMER: "Été",
  AUTUMN: "Automne",
  WINTER: "Hiver",
};

/** Version courte, pour les colonnes étroites. */
export const SEASON_SHORT_FR: Record<Season, string> = {
  SPRING: "PRI",
  SUMMER: "ÉTÉ",
  AUTUMN: "AUT",
  WINTER: "HIV",
};

/** Ce qu'un semis à un moment donné produit comme récolte. */
export type SowOutcome = {
  /** Saison du semis. */
  sowSeason: Season;
  /** Semé au début, au milieu ou en fin de saison — 0, 0.5, 0.9. */
  at: number;
  /** Saison où la culture est mûre. */
  harvestSeason: Season;
  /** Attente réelle, en heures. */
  realHours: number;
};

/** Une ligne du calendrier : une culture, et ce qu'elle donne. */
export type CropCalendarRow = {
  crop: CropCode;
  /** Saisons où le semis est autorisé. */
  sowSeasons: Season[];
  /** Saisons où l'on récolte, tous semis de la fenêtre confondus. */
  harvestSeasons: Season[];
  /** Le détail, semis par semis : c'est là que se lit l'arbitrage. */
  outcomes: SowOutcome[];
  /**
   * Ce que met la culture semée à son meilleur moment, en heures réelles.
   * Le seul chiffre qui réponde à « je sème ce soir, c'est prêt quand ? ».
   */
  bestRealHours: number;
  /** Le meilleur moment de semis : celui qui mène le plus vite à maturité. */
  bestSowSeason: Season;
};

/** Plafond de sécurité : une culture qui ne mûrit pas en trois ans n'existe pas. */
const MAX_SAISONS = SEASON_CYCLE.length * 3;

/**
 * Quand une graine semée à l'instant `t0` est-elle mûre ?
 *
 * On avance **de frontière de saison en frontière de saison** en cumulant la
 * vitesse traversée. Découper à la saison plutôt qu'au jour de jeu est ce qui
 * rend le calcul exact : une saison de dix heures ne fait pas un nombre entier
 * de jours de jeu de six heures, et un pas d'un jour entier sauterait ou
 * compterait deux fois la frontière.
 *
 * Renvoie l'instant de maturité, ou `null` si la culture n'y arrive jamais —
 * ce qui n'est pas une erreur : un maïs semé en fin d'été n'y arrive pas.
 */
export function maturityAt(crop: CropCode, t0: number): number | null {
  const objectif = cropGrowMs(crop);
  let t = t0;
  let acquis = 0;
  for (let i = 0; i < MAX_SAISONS; i++) {
    const rang = Math.floor(t / SEASON_REAL_MS);
    const finSaison = (rang + 1) * SEASON_REAL_MS;
    const saison = SEASON_CYCLE[((rang % 4) + 4) % 4]!;
    const vitesse = growthRate(crop, saison);
    const tranche = finSaison - t;
    if (vitesse > 0 && acquis + tranche * vitesse >= objectif) {
      return t + (objectif - acquis) / vitesse;
    }
    acquis += tranche * vitesse;
    t = finSaison;
  }
  return null;
}

/** La saison à un rang donné du cycle, sans passer par une horloge. */
function saisonAuRang(rang: number): Season {
  return SEASON_CYCLE[((rang % 4) + 4) % 4]!;
}

/**
 * Le calendrier complet, une ligne par culture.
 *
 * Chaque culture est semée à trois moments de chacune de ses saisons de
 * fenêtre — début, milieu, fin. Trois suffisent : c'est ce qui montre
 * l'arbitrage « semer tôt ou semer tard » sans noyer le tableau.
 */
export function cropCalendar(): CropCalendarRow[] {
  const lignes: CropCalendarRow[] = [];

  for (const crop of Object.keys(CROP_DEFS) as CropCode[]) {
    const outcomes: SowOutcome[] = [];
    const sowSeasons: Season[] = [];
    const harvestSeasons = new Set<Season>();
    let meilleur = { saison: "SPRING" as Season, heures: Number.POSITIVE_INFINITY };

    for (let rang = 0; rang < SEASON_CYCLE.length; rang++) {
      const saison = saisonAuRang(rang);
      if (!canSowInSeason(crop, saison).ok) continue;
      sowSeasons.push(saison);

      for (const at of [0, 0.5, 0.9]) {
        const t0 = (rang + at) * SEASON_REAL_MS;
        const mur = maturityAt(crop, t0);
        if (mur === null) continue;
        const recolte = saisonAuRang(Math.floor(mur / SEASON_REAL_MS));
        const heures = Math.round(((mur - t0) / 3_600_000) * 10) / 10;
        harvestSeasons.add(recolte);
        outcomes.push({ sowSeason: saison, at, harvestSeason: recolte, realHours: heures });
        if (heures < meilleur.heures) meilleur = { saison, heures };
      }
    }

    lignes.push({
      crop,
      sowSeasons,
      harvestSeasons: SEASON_CYCLE.filter((s) => harvestSeasons.has(s)),
      outcomes,
      bestRealHours: Number.isFinite(meilleur.heures) ? meilleur.heures : 0,
      bestSowSeason: meilleur.saison,
    });
  }

  // Trié par ordre de semis dans le cycle, puis par nom : le joueur cherche
  // d'abord ce qu'il peut semer à la saison où il se trouve.
  return lignes.sort(
    (a, b) =>
      SEASON_CYCLE.indexOf(a.sowSeasons[0] ?? "WINTER") -
        SEASON_CYCLE.indexOf(b.sowSeasons[0] ?? "WINTER") || a.crop.localeCompare(b.crop),
  );
}
