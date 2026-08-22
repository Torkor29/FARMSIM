/**
 * Le calendrier affiché dit-il la vérité ?
 *
 * Un calendrier agricole dessiné à la main est un mensonge en sursis : il
 * annonce « le blé se moissonne en été » jusqu'au jour où l'on retouche une
 * vitesse de pousse, et plus personne ne s'en aperçoit. `cropCalendar()` ne
 * dessine rien — il fait pousser chaque culture avec les fonctions du champ et
 * rapporte ce qui s'est passé.
 *
 * Ces tests referment la boucle : ce que le tableau montre doit être ce que la
 * partie ferait. Si les deux divergent un jour, c'est ici qu'on l'apprend, et
 * pas dans un Discord six mois plus tard.
 */

import {
  CROP_DEFS,
  GAME_DAY_MS,
  GAME_DAYS_PER_REAL_DAY,
  WEEKDAY_LABELS,
  YEAR_REAL_DAYS,
  canSowInSeason,
  cropCalendar,
  cropGrowMs,
  growthRate,
  seasonOfWeekday,
  type CropCode,
} from "@farmsim/shared";

const HEMISPHERES = ["N", "S"] as const;

describe("le calendrier couvre le catalogue", () => {
  for (const h of HEMISPHERES) {
    it(`donne une ligne par culture, hémisphère ${h}`, () => {
      const vues = cropCalendar(h).map((r) => r.crop).sort();
      expect(vues).toEqual((Object.keys(CROP_DEFS) as CropCode[]).sort());
    });

    it(`donne à chaque culture une fenêtre de semis et une récolte, hémisphère ${h}`, () => {
      // Une culture qu'on ne peut jamais semer, ou jamais moissonner, serait
      // une ligne morte du tableau — et une impasse dans la partie.
      for (const r of cropCalendar(h)) {
        expect(`${r.crop} semis=${r.sowDays.length}`).not.toBe(`${r.crop} semis=0`);
        expect(`${r.crop} récolte=${r.harvestDays.length}`).not.toBe(`${r.crop} récolte=0`);
      }
    });
  }
});

describe("ce que le tableau montre est ce que la partie fait", () => {
  it("chaque jour de semis affiché est un jour que la règle accepte", () => {
    /*
     * La bande verte et le refus du serveur doivent venir de la même règle.
     * C'est exactement la divergence qu'on veut rendre impossible : un joueur
     * qui lit « semable samedi » et se fait répondre « hors saison ».
     */
    for (const h of HEMISPHERES) {
      for (const r of cropCalendar(h)) {
        for (const jour of r.sowDays) {
          const verdict = canSowInSeason(r.crop, seasonOfWeekday(jour, h));
          expect(`${r.crop} ${WEEKDAY_LABELS[jour]} ${verdict.ok}`).toBe(
            `${r.crop} ${WEEKDAY_LABELS[jour]} true`,
          );
        }
      }
    }
  });

  it("aucun jour semable n’est oublié", () => {
    // L'inverse du test précédent : le tableau ne doit pas non plus cacher une
    // possibilité. Les deux ensemble en font une équivalence.
    for (const h of HEMISPHERES) {
      for (const r of cropCalendar(h)) {
        for (let jour = 0; jour < YEAR_REAL_DAYS; jour++) {
          const permis = canSowInSeason(r.crop, seasonOfWeekday(jour, h)).ok;
          expect(`${r.crop} ${jour} ${r.sowDays.includes(jour)}`).toBe(`${r.crop} ${jour} ${permis}`);
        }
      }
    }
  });

  it("le jour de récolte annoncé est celui où la culture est réellement mûre", () => {
    /**
     * On refait la pousse ici, à la main, avec les mêmes briques mais sans
     * passer par `cropCalendar` : si les deux tombent d'accord, c'est que le
     * tableau intègre bien ce qu'il prétend intégrer.
     */
    for (const r of cropCalendar("N")) {
      for (const semis of r.sowDays) {
        // En jours de jeu des deux côtés : `growthRate` est un coefficient,
        // pas une durée, et le comparer à des millisecondes ne veut rien dire.
        const objectif = cropGrowMs(r.crop) / GAME_DAY_MS;
        let acquis = 0;
        let joursDeJeu = 0;
        while (acquis < objectif && joursDeJeu < 400) {
          const jourReel = semis + Math.floor(joursDeJeu / GAME_DAYS_PER_REAL_DAY);
          acquis += growthRate(r.crop, seasonOfWeekday(jourReel, "N"));
          joursDeJeu++;
        }
        const attendu = Math.floor(semis + joursDeJeu / GAME_DAYS_PER_REAL_DAY) % YEAR_REAL_DAYS;
        expect(`${r.crop} semé ${semis} → ${r.harvestDays.includes(attendu)}`).toBe(
          `${r.crop} semé ${semis} → true`,
        );
      }
    }
  });
});

describe("l’hiver reste le jour creux", () => {
  it("le dimanche ne sème que ce que la règle autorise en hiver", () => {
    const dimanche = 6;
    expect(seasonOfWeekday(dimanche, "N")).toBe("WINTER");
    for (const r of cropCalendar("N")) {
      const permis = canSowInSeason(r.crop, "WINTER").ok;
      expect(`${r.crop} ${r.sowDays.includes(dimanche)}`).toBe(`${r.crop} ${permis}`);
    }
  });

  it("une culture d’été ne se sème pas le dimanche", () => {
    // Le maïs et le pois sont les cultures de printemps-été : le tableau doit
    // laisser leur colonne du dimanche vide, sinon il invite à une impasse.
    const parCulture = new Map(cropCalendar("N").map((r) => [r.crop, r]));
    for (const c of ["MAIZE", "PEA"] as CropCode[]) {
      expect(`${c} ${parCulture.get(c)!.sowDays.includes(6)}`).toBe(`${c} false`);
    }
  });
});

describe("les durées annoncées", () => {
  it("tiennent dans la semaine, sinon la ligne ne veut rien dire", () => {
    for (const h of HEMISPHERES) {
      for (const r of cropCalendar(h)) {
        expect(`${r.crop} ${r.realDays} j`).toBe(`${r.crop} ${r.realDays} j`);
        expect(r.realDays).toBeGreaterThan(0);
        expect(r.realDays).toBeLessThan(YEAR_REAL_DAYS);
      }
    }
  });

  it("restent rapides sans être instantanées", () => {
    /*
     * La consigne d'origine : « relativement rapide mais pas trop ». En jours
     * réels, cela veut dire qu'on sème le soir et qu'on moissonne le lendemain
     * ou le surlendemain — pas dans l'heure, pas la semaine suivante.
     */
    const durees = cropCalendar("N").map((r) => r.realDays);
    expect(Math.min(...durees)).toBeGreaterThanOrEqual(0.4);
    expect(Math.max(...durees)).toBeLessThanOrEqual(3);
  });
});
