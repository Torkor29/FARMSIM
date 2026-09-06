/**
 * L'hiver ne dure plus autant que les autres saisons.
 *
 * ## La demande, et pourquoi elle avait été refusée
 *
 * « L'hiver était supposé être plus rapide ? » Il l'était à l'origine, puis il
 * a été ramené à sept jours en même temps qu'on décrochait le calendrier de la
 * semaine réelle. Le motif n'était pas que l'hiver méritait sept jours : c'est
 * que la seule implémentation de saisons inégales à portée de main était une
 * **table indexée par jour de semaine**, qui imposait un pas d'un jour entier
 * et ramenait donc le calage hebdomadaire — la porte fermée qu'on venait
 * d'ouvrir. Une raison d'implémentation, pas de conception, restée écrite
 * comme si c'en était une.
 *
 * `time.ts` ne consulte plus aucun jour de semaine : l'année est une suite
 * d'intervalles de longueurs quelconques, et la saison se trouve par un modulo
 * sur la position dans l'année. Les deux propriétés qui protègent le joueur
 * régulier portent sur la longueur de l'**année**, et sont vérifiées dans
 * `time.test.ts`.
 *
 * ## Ce que ce fichier tient
 *
 * Ce que le joueur constate — l'hiver passe plus vite —, et les trois choses
 * qu'un hiver court ne doit pas casser au passage : la pousse d'hiver garde
 * son sens, le champ ne s'accélère pas, et les fenêtres de semis restent
 * atteignables.
 */

import {
  CROP_DEFS,
  GAME_DAY_MS,
  SEASON_CYCLE,
  SEASON_DAYS,
  WINTER_DAYS,
  YEAR_DAYS,
  YEAR_MS,
  canSowInSeason,
  currentSeason,
  cropGrowMs,
  dayOfSeason,
  growthRate,
  msUntilNextSeason,
  seasonDurationMs,
  seasonLengthDays,
  seasonStartOfIndex,
  type CropCode,
  type Season,
} from "@farmsim/shared";
import { integrateGrowth } from "../index";

const HEURE = 3_600_000;
const debutDe = (s: Season) => seasonStartOfIndex(SEASON_CYCLE.indexOf(s));

describe("ce que le joueur constate", () => {
  it("traverse l’hiver en 5 h 43 au lieu de 10 h", () => {
    expect(seasonDurationMs("WINTER") / HEURE).toBeCloseTo(40 / 7, 6);
    expect(seasonDurationMs("SUMMER") / HEURE).toBeCloseTo(10, 6);
    // Un peu plus de quatre heures de gagnées à chaque tour de calendrier.
    const gagne = (seasonDurationMs("SUMMER") - seasonDurationMs("WINTER")) / HEURE;
    expect(gagne).toBeGreaterThan(4);
  });

  it("annonce « jour 3 sur 4 » en hiver, pas « jour 3 sur 7 »", () => {
    // C'est la seule trace visible du changement dans le bandeau. Elle doit
    // dire la vraie longueur, sinon la barre paraît coincée à mi-chemin.
    const hiver = debutDe("WINTER");
    expect(seasonLengthDays("WINTER")).toBe(WINTER_DAYS);
    expect(dayOfSeason(hiver + 2.5 * GAME_DAY_MS)).toBe(3);
    expect(dayOfSeason(hiver + seasonDurationMs("WINTER") - 1)).toBe(WINTER_DAYS);
  });

  it("raccourcit l’année d’autant, et pas davantage", () => {
    expect(YEAR_DAYS).toBe(3 * SEASON_DAYS + WINTER_DAYS);
    expect(YEAR_MS / HEURE).toBeCloseTo(3 * 10 + 40 / 7, 6);
  });

  it("fait tomber le compte à rebours sous six heures en hiver", () => {
    // Ce que lit le calendrier des cultures : « prochaine saison dans… ».
    const hiver = debutDe("WINTER");
    expect(msUntilNextSeason(hiver) / HEURE).toBeCloseTo(40 / 7, 6);
    expect(msUntilNextSeason(debutDe("SPRING")) / HEURE).toBeCloseTo(10, 6);
  });
});

describe("ce qu’un hiver court ne doit pas casser", () => {
  it("garde à l’hiver son rôle : le champ y avance toujours au ralenti", () => {
    /*
     * Un hiver court ne doit pas devenir un hiver indolore. La morte-saison
     * est un arbitrage — occuper le champ d'une céréale d'hiver, ou le laisser
     * — et elle disparaîtrait si la pousse d'hiver rattrapait celle d'été.
     */
    expect(growthRate("MAIZE", "WINTER")).toBeLessThan(growthRate("MAIZE", "SUMMER") / 10);
    // Le blé d'hiver, lui, avance : c'est sa raison d'être.
    expect(growthRate("WHEAT", "WINTER")).toBeGreaterThan(0.2);
  });

  it("ne fait pas pousser plus vite — il y a juste moins d’hiver à passer", () => {
    /*
     * Le piège qu'on aurait pu tendre en raccourcissant l'hiver : accélérer le
     * jour de jeu au lieu d'en retirer. Un maïs semé au printemps doit avancer
     * exactement comme avant sur une durée donnée ; ce qui change, c'est
     * combien d'hiver s'intercale ensuite.
     */
    const printemps = debutDe("SPRING");
    const acquis = integrateGrowth({
      crop: "MAIZE",
      plantedAt: printemps,
      until: printemps + 3 * GAME_DAY_MS,
      hemisphere: "N",
    });
    expect(acquis).toBeCloseTo(3 * GAME_DAY_MS * growthRate("MAIZE", "SPRING"), 6);
  });

  it("laisse chaque culture atteindre sa fenêtre de semis", () => {
    // Une fenêtre de semis qui ne tomberait jamais sous le créneau d'un joueur
    // serait la porte fermée d'avant, sous une autre forme.
    for (const crop of Object.keys(CROP_DEFS) as CropCode[]) {
      const ouvertes = SEASON_CYCLE.filter((s) => canSowInSeason(crop, s).ok);
      expect({ crop, ouvertes: ouvertes.length > 0 }).toEqual({ crop, ouvertes: true });
    }
  });

  it("laisse le blé d’hiver traverser l’hiver, et pas l’enjamber", () => {
    /*
     * Le garde-fou de l'autre côté : si l'hiver devenait assez court pour
     * qu'un blé semé à l'automne mûrisse sans jamais rencontrer le froid, la
     * céréale d'hiver n'aurait plus de raison d'exister.
     */
    const automne = debutDe("AUTUMN");
    const growMs = cropGrowMs("WHEAT");
    expect(growMs).toBeGreaterThan(seasonDurationMs("AUTUMN") + seasonDurationMs("WINTER"));

    // Et il rencontre bien l'hiver en chemin : on regarde les saisons
    // traversées entre le semis et la maturité annoncée.
    const traversees = new Set<Season>();
    for (let t = automne; t < automne + growMs; t += GAME_DAY_MS / 2) {
      traversees.add(currentSeason("N", t));
    }
    expect([...traversees]).toContain("WINTER");
  });
});
