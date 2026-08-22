/**
 * Le calendrier des cultures, **déduit** de la simulation.
 *
 * Un calendrier agricole dessiné à la main est un mensonge en sursis : il dit
 * « le blé se moissonne en été » jusqu'au jour où l'on retouche une vitesse de
 * pousse, et plus personne ne s'en aperçoit. Ce module ne dessine rien. Il
 * fait pousser chaque culture, jour de jeu par jour de jeu, avec exactement
 * les fonctions qu'emploie le champ — `canSowInSeason` pour la fenêtre de
 * semis, `growthRate` pour la vitesse — et rapporte ce qui s'est passé.
 *
 * Le calendrier ne peut donc pas mentir : s'il affiche une récolte le vendredi,
 * c'est qu'une graine semée lundi est mûre le vendredi.
 *
 * ## Pourquoi une semaine
 *
 * L'année de jeu tombe sur la semaine réelle — lundi et mardi au printemps,
 * mercredi et jeudi en été, vendredi et samedi à l'automne, l'hiver le
 * dimanche. Les colonnes du calendrier sont donc les sept jours, et non des
 * mois : c'est le repère que le joueur a déjà dans la tête.
 *
 * ## Ce qui est volontairement ignoré
 *
 * La météo. Elle accélère ou ralentit la pousse au jour le jour, mais elle est
 * tirée par zone : l'intégrer donnerait un calendrier différent par région et
 * par semaine, ce qui n'est plus un calendrier mais un bulletin. On dit le
 * temps qu'il fait ailleurs ; ici on dit la saison.
 */

import { canSowInSeason, growthRate } from "./calendar.js";
import { CROP_DEFS, cropGrowMs, type CropCode } from "./index.js";
import { GAME_DAY_MS, GAME_DAYS_PER_REAL_DAY, seasonOfWeekday, YEAR_REAL_DAYS } from "./time.js";
import type { Season } from "./world.js";

/** Les jours de la semaine, dans l'ordre où le calendrier les affiche. */
export const WEEKDAY_LABELS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

/** Version courte, pour les colonnes étroites. */
export const WEEKDAY_SHORT = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"] as const;

/** Une ligne du calendrier : une culture, ses deux barres. */
export type CropCalendarRow = {
  crop: CropCode;
  /** Jours où l'on peut semer — lundi = 0. */
  sowDays: number[];
  /** Jours où une culture semée dans sa fenêtre est mûre. */
  harvestDays: number[];
  /** Saisons de semis, telles que la règle les déclare. */
  sowSeasons: Season[];
  /** Durée de pousse nominale, en jours de jeu. */
  growDays: number;
  /**
   * Ce que met réellement la culture, semée à son meilleur jour, en jours
   * réels. C'est le seul chiffre qui réponde à « je sème ce soir, c'est prêt
   * quand ? » — la durée nominale, elle, ignore les saisons traversées.
   */
  realDays: number;
  /** Le meilleur jour de semis : celui qui mène le plus vite à maturité. */
  bestSowDay: number;
};

/** Plafond de sécurité : une culture qui ne mûrit pas en deux ans n'existe pas. */
const MAX_JOURS = YEAR_REAL_DAYS * GAME_DAYS_PER_REAL_DAY * 2;

/**
 * Quand une graine semée au début du jour `sowDay` est-elle mûre ?
 *
 * On avance jour de jeu par jour de jeu en cumulant la vitesse de la saison
 * traversée — le même calcul que le champ, sans la météo. Renvoie le nombre de
 * jours de jeu écoulés, ou `null` si la culture n'y arrive pas.
 */
function joursJusquAMaturite(
  crop: CropCode,
  sowDay: number,
  hemisphere: "N" | "S",
): number | null {
  const objectif = cropGrowMs(crop);
  let acquis = 0;
  for (let i = 0; i < MAX_JOURS; i++) {
    // Chaque jour réel porte quatre jours de jeu : la saison ne change qu'aux
    // frontières de jour réel, la vitesse est donc constante sur les quatre.
    const jourReel = sowDay + Math.floor(i / GAME_DAYS_PER_REAL_DAY);
    const saison = seasonOfWeekday(jourReel, hemisphere);
    acquis += GAME_DAY_MS * growthRate(crop, saison);
    if (acquis >= objectif) return i + 1;
  }
  return null;
}

/**
 * Le calendrier complet, une ligne par culture.
 *
 * Les cultures sont triées par ordre de semis puis par nom : le joueur qui
 * ouvre le calendrier un lundi veut voir en haut ce qu'il peut semer lundi.
 */
export function cropCalendar(hemisphere: "N" | "S" = "N"): CropCalendarRow[] {
  const cultures = Object.keys(CROP_DEFS) as CropCode[];
  const lignes: CropCalendarRow[] = [];

  for (const crop of cultures) {
    const sowDays: number[] = [];
    const harvestDays = new Set<number>();
    const sowSeasons = new Set<Season>();
    let meilleur = { jour: 0, duree: Number.POSITIVE_INFINITY };

    for (let jour = 0; jour < YEAR_REAL_DAYS; jour++) {
      const saison = seasonOfWeekday(jour, hemisphere);
      if (!canSowInSeason(crop, saison).ok) continue;
      sowDays.push(jour);
      sowSeasons.add(saison);

      const joursDeJeu = joursJusquAMaturite(crop, jour, hemisphere);
      if (joursDeJeu === null) continue;
      const joursReels = joursDeJeu / GAME_DAYS_PER_REAL_DAY;
      if (joursReels < meilleur.duree) meilleur = { jour, duree: joursReels };
      // Le jour de récolte, ramené dans la semaine : l'année boucle.
      harvestDays.add(Math.floor(jour + joursReels) % YEAR_REAL_DAYS);
    }

    lignes.push({
      crop,
      sowDays,
      harvestDays: [...harvestDays].sort((a, b) => a - b),
      sowSeasons: [...sowSeasons],
      growDays: cropGrowMs(crop) / GAME_DAY_MS,
      realDays: Number.isFinite(meilleur.duree) ? Math.round(meilleur.duree * 10) / 10 : 0,
      bestSowDay: meilleur.jour,
    });
  }

  return lignes.sort(
    (a, b) => (a.sowDays[0] ?? 9) - (b.sowDays[0] ?? 9) || a.crop.localeCompare(b.crop),
  );
}
