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
 *
 * ## Pourquoi les colonnes ont changé
 *
 * Elles étaient les sept jours de la semaine, parce que l'année de jeu en
 * faisait une. C'était le défaut à corriger : les fenêtres de semis étant
 * verrouillées par saison, un joueur du week-end ne pouvait jamais semer la
 * moitié du catalogue. Les colonnes sont maintenant les quatre saisons — de
 * toute façon le seul repère dont un agriculteur se sert.
 */

import {
  CROP_DEFS,
  PLANTING_WINDOW,
  SEASON_CYCLE,
  SEASON_LABELS_FR,
  SEASON_REAL_HOURS,
  canSowInSeason,
  cropCalendar,
  cropGrowMs,
  growthRate,
  maturityAt,
  type CropCode,
  type Season,
} from "@farmsim/shared";

const LIGNES = cropCalendar();
const PAR_CULTURE = new Map(LIGNES.map((r) => [r.crop, r]));

describe("le calendrier couvre le catalogue", () => {
  it("donne une ligne par culture, et une seule", () => {
    const vues = LIGNES.map((r) => r.crop).sort();
    expect(vues).toEqual((Object.keys(CROP_DEFS) as CropCode[]).sort());
  });

  it("donne à chaque culture une fenêtre de semis et une récolte", () => {
    // Une culture qu'on ne peut jamais semer, ou jamais moissonner, serait une
    // ligne morte du tableau — et une impasse dans la partie.
    for (const r of LIGNES) {
      expect({ crop: r.crop, semis: r.sowSeasons.length > 0 }).toEqual({
        crop: r.crop,
        semis: true,
      });
      expect({ crop: r.crop, récolte: r.harvestSeasons.length > 0 }).toEqual({
        crop: r.crop,
        récolte: true,
      });
    }
  });
});

describe("ce que le tableau montre est ce que la partie fait", () => {
  it("affiche exactement les saisons de semis que la règle accepte", () => {
    /*
     * La bande verte et le refus du serveur viennent de la même règle. C'est
     * exactement la divergence qu'on veut rendre impossible : un joueur qui
     * lit « semable à l'automne » et se fait répondre « hors saison ».
     *
     * L'équivalence se vérifie dans les deux sens : le tableau ne doit ni
     * inventer une saison ni en cacher une.
     */
    for (const r of LIGNES) {
      for (const s of SEASON_CYCLE) {
        const permis = canSowInSeason(r.crop, s).ok;
        expect({ crop: r.crop, saison: SEASON_LABELS_FR[s], affiché: r.sowSeasons.includes(s) })
          .toEqual({ crop: r.crop, saison: SEASON_LABELS_FR[s], affiché: permis });
      }
    }
  });

  it("annonce la saison de récolte où la culture est réellement mûre", () => {
    /**
     * On refait la pousse ici, à la main, sans passer par `maturityAt` ni par
     * `cropCalendar` : on avance saison par saison en **unités de saison**, là
     * où le module compte en millisecondes. Deux implémentations
     * indépendantes qui tombent d'accord, c'est ce qui donne au tableau sa
     * valeur de preuve.
     */
    for (const r of LIGNES) {
      for (const o of r.outcomes) {
        const objectif = cropGrowMs(r.crop) / (SEASON_REAL_HOURS * 3_600_000);
        let curseur = SEASON_CYCLE.indexOf(o.sowSeason) + o.at;
        let acquis = 0;
        let garde = 0;
        while (acquis < objectif && garde++ < 40) {
          const rang = Math.floor(curseur);
          const vitesse = growthRate(r.crop, SEASON_CYCLE[rang % 4]!);
          const reste = rang + 1 - curseur;
          if (vitesse > 0 && acquis + reste * vitesse >= objectif) {
            curseur += (objectif - acquis) / vitesse;
            acquis = objectif;
            break;
          }
          acquis += reste * vitesse;
          curseur = rang + 1;
        }
        const attendu = SEASON_CYCLE[Math.floor(curseur) % 4]!;
        expect({ crop: r.crop, semé: o.sowSeason, à: o.at, mûr: o.harvestSeason }).toEqual({
          crop: r.crop,
          semé: o.sowSeason,
          à: o.at,
          mûr: attendu,
        });
      }
    }
  });

  it("n’affiche aucune saison de récolte que personne ne produit", () => {
    // L'inverse : la colonne « récolte » doit se déduire des semis listés, et
    // pas être une union approximative.
    for (const r of LIGNES) {
      const produites = new Set(r.outcomes.map((o) => o.harvestSeason));
      expect({ crop: r.crop, colonnes: [...r.harvestSeasons].sort() }).toEqual({
        crop: r.crop,
        colonnes: [...produites].sort(),
      });
    }
  });

  it("dit vrai sur le meilleur moment de semis", () => {
    // « Le plus court » est la colonne qu'on lit en premier : elle doit
    // désigner le semis qui mène réellement le plus vite à maturité.
    for (const r of LIGNES) {
      const meilleur = Math.min(...r.outcomes.map((o) => o.realHours));
      expect({ crop: r.crop, h: r.bestRealHours }).toEqual({ crop: r.crop, h: meilleur });
      expect(r.outcomes.some((o) => o.sowSeason === r.bestSowSeason && o.realHours === meilleur))
        .toBe(true);
    }
  });
});

describe("les céréales d’hiver traversent l’hiver", () => {
  it("sème le blé, l’orge et le colza avant l’hiver, et les moissonne après", () => {
    /*
     * La vérification agronomique, et la raison d'être de tout ce
     * changement de calendrier. Une céréale d'hiver qui se sème et se
     * moissonne dans la même saison n'est pas une céréale d'hiver.
     */
    for (const crop of ["WHEAT", "BARLEY", "RAPE"] as CropCode[]) {
      const r = PAR_CULTURE.get(crop)!;
      const depuisDebut = r.outcomes.find((o) => o.sowSeason === PLANTING_WINDOW[crop][0] && o.at === 0)!;
      expect({ crop, mûrLaMêmeSaison: depuisDebut.harvestSeason === depuisDebut.sowSeason })
        .toEqual({ crop, mûrLaMêmeSaison: false });
      expect(depuisDebut.realHours).toBeGreaterThan(SEASON_REAL_HOURS);
    }
  });

  it("ne laisse pas semer une culture de printemps en hiver", () => {
    // Le maïs et le pois gèlent : leur colonne d'hiver doit rester vide, sinon
    // le tableau invite à une impasse.
    for (const c of ["MAIZE", "PEA"] as CropCode[]) {
      expect({ crop: c, hiver: PAR_CULTURE.get(c)!.sowSeasons.includes("WINTER") })
        .toEqual({ crop: c, hiver: false });
    }
  });
});

describe("les durées annoncées", () => {
  it("restent des durées, et pas des « jamais »", () => {
    for (const r of LIGNES) {
      expect({ crop: r.crop, positive: r.bestRealHours > 0 }).toEqual({
        crop: r.crop,
        positive: true,
      });
    }
  });

  it("tiennent dans l’année, sinon la ligne ne veut rien dire", () => {
    /*
     * Une culture qui mettrait plus d'une année de jeu à mûrir ne serait plus
     * une culture mais une immobilisation : on ne pourrait pas la faire entrer
     * dans une rotation.
     */
    const ANNEE = SEASON_CYCLE.length * SEASON_REAL_HOURS;
    for (const r of LIGNES) {
      for (const o of r.outcomes) {
        expect({ crop: r.crop, semé: o.sowSeason, à: o.at, dansLAnnée: o.realHours < ANNEE })
          .toEqual({ crop: r.crop, semé: o.sowSeason, à: o.at, dansLAnnée: true });
      }
    }
  });

  it("garde au moins une culture qui boucle dans sa saison", () => {
    /*
     * Le garde-fou de l'autre côté. Si toutes les cultures tenaient trois
     * saisons, un débutant n'aurait rien à récolter de ses premières heures.
     */
    const courtes = LIGNES.filter((r) => r.bestRealHours <= SEASON_REAL_HOURS);
    expect(courtes.map((r) => r.crop)).toContain("GRASS");
  });

  it("classe les lignes par ordre d’entrée en saison", () => {
    // Le joueur cherche d'abord ce qu'il peut semer là où il en est : la
    // première colonne de semis doit donc commander le tri.
    const rangs = LIGNES.map((r) => SEASON_CYCLE.indexOf(r.sowSeasons[0]!));
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs);
  });
});

describe("le module et la vue s’accordent", () => {
  it("donne la même maturité que `maturityAt`, semis par semis", () => {
    // `cropCalendar` s'appuie sur `maturityAt` ; ce test tient qu'il ne
    // réinterprète pas son résultat en chemin.
    const SAISON_MS = SEASON_REAL_HOURS * 3_600_000;
    for (const r of LIGNES) {
      for (const o of r.outcomes) {
        const t0 = (SEASON_CYCLE.indexOf(o.sowSeason) + o.at) * SAISON_MS;
        const mur = maturityAt(r.crop, t0);
        expect({ crop: r.crop, semé: o.sowSeason, trouvé: mur !== null }).toEqual({
          crop: r.crop,
          semé: o.sowSeason,
          trouvé: true,
        });
        const saison: Season = SEASON_CYCLE[Math.floor(mur! / SAISON_MS) % 4]!;
        expect({ crop: r.crop, à: o.at, saison: o.harvestSeason }).toEqual({
          crop: r.crop,
          à: o.at,
          saison,
        });
        expect((mur! - t0) / 3_600_000).toBeCloseTo(o.realHours, 1);
      }
    }
  });
});
