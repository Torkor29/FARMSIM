/**
 * Des parcelles de tailles différentes, et un prix qui le sache.
 *
 * ## Le signalement
 *
 * « Les parcelles ont toutes les mêmes tailles, il devrait y avoir des tailles
 * différentes ; seule la parcelle de base qu'on a tous devrait avoir une
 * taille standard. » Puis, en revenant dessus : « il faut le voir visuellement
 * aussi, qu'on ait des lots plus grands et plus petits à côté de chez soi ».
 *
 * Ce fichier tient les règles pures — le catalogue, le tirage, le prix. Le
 * parcellaire posé en base est dans `api.test.ts`, et sa traduction en mètres
 * dans le paysage dans `countryside-plan.test.ts`.
 */

import {
  CASES_STANDARD,
  COTE_MAX,
  COTE_MIN,
  DEFAULT_GRID,
  ECART_COTE_MAX,
  GRILLE_STANDARD,
  HECTARES_STANDARD,
  LAND_FACTOR_BOUNDS,
  LAND_PARCEL_HA,
  LAND_SURFACE_EXPONENT,
  PARCEL_HECTARES,
  TAILLES_PARCELLE,
  askPrice,
  cleDeCase,
  empreinteTexte,
  hectaresDeGrille,
  libelleDeTaille,
  marketValue,
  surfaceFactor,
  tailleDeParcelle,
} from "@farmsim/shared";

/** Un devis neutre : seule la surface change d'un appel à l'autre. */
const devis = (hectares?: number) =>
  askPrice({
    hectares,
    fertility: 0.7,
    koppen: "Cfb",
    accessIndex: 0.5,
    neighborDensity: 0.3,
    occupancy: 0.2,
    adjacentOwnedBorders: 0,
    ownershipRank: 1,
  });

describe("le catalogue de tailles", () => {
  it("ne diverge pas des constantes du baril", () => {
    /*
     * `parcelles.ts` recopie la grille standard et les quatorze hectares au
     * lieu de les importer : le baril réexporte ce module, l'import en retour
     * ferait un cycle. Le prix de cette recopie, c'est ce test — sans lui, une
     * grille standard changée d'un côté laisserait l'autre mentir en silence.
     */
    expect(GRILLE_STANDARD).toEqual({ w: DEFAULT_GRID.w, h: DEFAULT_GRID.h });
    expect(CASES_STANDARD).toBe(DEFAULT_GRID.w * DEFAULT_GRID.h);
    expect(HECTARES_STANDARD).toBe(PARCEL_HECTARES);
    expect(HECTARES_STANDARD).toBe(LAND_PARCEL_HA);
  });

  it("contient la taille standard, et de part et d’autre", () => {
    const cotes = TAILLES_PARCELLE.map((t) => t.cote);
    expect(cotes).toContain(GRILLE_STANDARD.w);
    expect(COTE_MIN).toBeLessThan(GRILLE_STANDARD.w);
    expect(COTE_MAX).toBeGreaterThan(GRILLE_STANDARD.w);
  });

  it("garde des tailles carrées — la trame du paysage en dépend", () => {
    // `parcelleSous()` retrouve la parcelle touchée par une division sur un pas
    // unique. Un rectangle demanderait une autre trame.
    for (const t of TAILLES_PARCELLE) {
      expect({ cote: t.cote, entier: Number.isInteger(t.cote) }).toEqual({
        cote: t.cote,
        entier: true,
      });
      expect({ cote: t.cote, poids: t.poids > 0 }).toEqual({ cote: t.cote, poids: true });
    }
  });

  it("écarte assez les extrêmes pour qu’on les distingue à l’œil", () => {
    /*
     * Le garde-fou de la demande « il faut le voir visuellement ». Deux tailles
     * séparées de dix pour cent de côté ne se distingueraient pas d'un champ à
     * l'autre ; un tiers, si.
     */
    expect(ECART_COTE_MAX).toBeCloseTo(COTE_MAX / GRILLE_STANDARD.w, 9);
    expect(COTE_MAX / COTE_MIN).toBeGreaterThanOrEqual(1.8);
  });
});

describe("le tirage d’une taille", () => {
  it("rend toujours la même chose pour la même case", () => {
    // C'est ce qui permet de ne rien stocker de plus, et de rattraper un monde
    // déjà né sans que les terres bougent.
    for (const [x, y] of [
      [0, 0],
      [3, 7],
      [11, 2],
    ]) {
      const a = tailleDeParcelle("FR-BEAUCE", x!, y!);
      const b = tailleDeParcelle("FR-BEAUCE", x!, y!);
      expect(a).toEqual(b);
    }
  });

  it("distingue deux cases voisines et deux régions", () => {
    expect(cleDeCase("A", 1, 2)).not.toBe(cleDeCase("A", 2, 1));
    expect(empreinteTexte("A:1:2")).not.toBe(empreinteTexte("A:2:1"));
    // Deux régions ne se recopient pas le même parcellaire.
    const fr = Array.from({ length: 24 }, (_, i) => tailleDeParcelle("FR", i % 6, (i / 6) | 0).w);
    const ar = Array.from({ length: 24 }, (_, i) => tailleDeParcelle("AR", i % 6, (i / 6) | 0).w);
    expect(fr).not.toEqual(ar);
  });

  it("ne rend jamais une taille hors catalogue", () => {
    const connus = new Set(TAILLES_PARCELLE.map((t) => t.cote));
    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        const t = tailleDeParcelle("FR-BEAUCE", x, y);
        expect({ x, y, connu: connus.has(t.w) && t.w === t.h }).toEqual({ x, y, connu: true });
      }
    }
  });

  it("pose des lots plus grands et plus petits dans ce qu’on voit de chez soi", () => {
    /*
     * Le cœur de la demande, et la raison du brassage final dans
     * `empreinteTexte` : un tirage juste en moyenne mais corrélé de proche en
     * proche poserait un parcellaire uniforme autour du joueur, ce qui ne
     * changerait rien à ce qu'il voit.
     *
     * Le paysage pose sept colonnes sur sept rangs (`planCampagne`, ±3). On
     * vérifie sur le 5×5, plus étroit que ce qui est réellement à l'écran :
     * la garantie tient donc a fortiori.
     */
    for (const zone of ["FR-BEAUCE", "AR-PAMPA", "US-IOWA", "AU-WIMMERA"]) {
      for (let x = 0; x < 12; x++) {
        for (let y = 0; y < 10; y++) {
          const autour: number[] = [];
          for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
              if (dx === 0 && dy === 0) continue;
              autour.push(tailleDeParcelle(zone, x + dx, y + dy).w);
            }
          }
          const ok =
            autour.some((c) => c < GRILLE_STANDARD.w) && autour.some((c) => c > GRILLE_STANDARD.w);
          expect({ zone, x, y, ok }).toEqual({ zone, x, y, ok: true });
        }
      }
    }
  });

  it("ne pose jamais huit fois la même taille autour d’une case", () => {
    // Le garde-fou rapproché : même l'anneau immédiat n'est jamais uniforme.
    for (let x = 0; x < 12; x++) {
      for (let y = 0; y < 10; y++) {
        const anneau: number[] = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            anneau.push(tailleDeParcelle("FR-BEAUCE", x + dx, y + dy).w);
          }
        }
        expect({ x, y, varie: new Set(anneau).size >= 2 }).toEqual({ x, y, varie: true });
      }
    }
  });

  it("garde les tailles moyennes majoritaires — un pays, pas une loterie", () => {
    const compte = new Map<number, number>();
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        const c = tailleDeParcelle("FR-BEAUCE", x, y).w;
        compte.set(c, (compte.get(c) ?? 0) + 1);
      }
    }
    const total = 1600;
    // Les trois tailles centrales font le gros du pays…
    const centre =
      (compte.get(10) ?? 0) + (compte.get(12) ?? 0) + (compte.get(14) ?? 0);
    expect(centre / total).toBeGreaterThan(0.6);
    // …sans que les extrêmes deviennent des curiosités qu'on ne croise jamais.
    for (const cote of [COTE_MIN, COTE_MAX]) {
      const part = (compte.get(cote) ?? 0) / total;
      expect({ cote, part: part > 0.05 }).toEqual({ cote, part: true });
    }
  });
});

describe("la surface en hectares", () => {
  it("rend quatorze hectares pour la grille standard", () => {
    expect(hectaresDeGrille(DEFAULT_GRID.w, DEFAULT_GRID.h)).toBe(PARCEL_HECTARES);
  });

  it("grandit avec la grille", () => {
    expect(hectaresDeGrille(8, 8)).toBeLessThan(hectaresDeGrille(12, 12));
    expect(hectaresDeGrille(16, 16)).toBeGreaterThan(hectaresDeGrille(12, 12));
    expect(hectaresDeGrille(0, 0)).toBe(0);
  });

  it("nomme la taille par rapport au lot standard", () => {
    expect(libelleDeTaille(12, 12)).toBe("lot standard");
    expect(libelleDeTaille(8, 8)).toBe("petit lot");
    expect(libelleDeTaille(16, 16)).toBe("très grand lot");
  });
});

describe("le prix à la surface", () => {
  /**
   * Le défaut économique que le déplafonnement des tailles aurait ouvert.
   *
   * `askPrice()` chiffrait sept facteurs et pas la surface. Tant que toutes
   * les parcelles faisaient quatorze hectares, personne ne pouvait s'en rendre
   * compte ; à la première parcelle de vingt-cinq hectares vendue au prix
   * d'une de six, l'oubli devenait la meilleure affaire du jeu.
   */
  it("ne change rien pour une parcelle standard — l’ancien prix tient", () => {
    // La surface est facultative : les appels qui ne la connaissent pas
    // (taxe, enchères, rachat PNJ) doivent rendre exactement ce qu'avant.
    expect(surfaceFactor(LAND_PARCEL_HA)).toBe(1);
    expect(devis(undefined).total).toBe(devis(LAND_PARCEL_HA).total);
    expect(devis(undefined).breakdown.surface).toEqual({ value: 1, contribution: 0 });
  });

  it("fait payer plus cher une grande parcelle, et moins cher une petite", () => {
    const petit = devis(hectaresDeGrille(8, 8)).total;
    const standard = devis(hectaresDeGrille(12, 12)).total;
    const grand = devis(hectaresDeGrille(16, 16)).total;
    expect(petit).toBeLessThan(standard);
    expect(grand).toBeGreaterThan(standard);
    // Et l'écart se voit : ce n'est pas un arrondi.
    expect(grand / petit).toBeGreaterThan(3);
  });

  it("récompense le volume — le grand lot coûte moins cher à l’hectare", () => {
    /*
     * C'est ce que l'exposant sous-linéaire achète : deux petits lots ne sont
     * pas l'équivalent exact d'un grand, donc la taille est une décision et
     * non une unité de compte.
     */
    expect(LAND_SURFACE_EXPONENT).toBeLessThan(1);
    const auHa = (ha: number) => devis(ha).total / ha;
    expect(auHa(hectaresDeGrille(16, 16))).toBeLessThan(auHa(hectaresDeGrille(12, 12)));
    expect(auHa(hectaresDeGrille(12, 12))).toBeLessThan(auHa(hectaresDeGrille(8, 8)));
  });

  it("garde le devis exact — la somme des lignes fait toujours le total", () => {
    /*
     * L'invariant de transparence : un facteur ajouté à la cascade sans être
     * ajouté à la décomposition rendrait le devis affiché faux de son montant.
     */
    for (const ha of [hectaresDeGrille(8, 8), hectaresDeGrille(12, 12), hectaresDeGrille(16, 16)]) {
      const { total, breakdown: b } = devis(ha);
      const somme =
        b.base +
        b.surface.contribution +
        b.fertility.contribution +
        b.climate.contribution +
        b.access.contribution +
        b.density.contribution +
        b.scarcity.contribution +
        b.adjacency.contribution +
        b.ownership.contribution +
        b.clampAdjustment +
        b.roundingAdjustment;
      expect({ ha, ecart: Math.abs(somme - total) < 1e-6 }).toEqual({ ha, ecart: true });
    }
  });

  it("laisse le plancher et le plafond suivre la surface", () => {
    /*
     * Sans cela, le bornage aurait mangé la remise : une petite parcelle
     * médiocre serait retombée sur le plancher d'une parcelle standard, et
     * aurait coûté plus cher que sa surface ne le justifie.
     */
    const mediocre = (hectares: number) =>
      marketValue({
        hectares,
        fertility: 0,
        koppen: "ET",
        accessIndex: 0,
        neighborDensity: 0,
        occupancy: 0,
      });
    expect(mediocre(hectaresDeGrille(8, 8))).toBeLessThan(mediocre(hectaresDeGrille(12, 12)));
  });

  it("borne le facteur, au cas où le catalogue s’élargirait sans qu’on y pense", () => {
    expect(surfaceFactor(10_000)).toBe(LAND_FACTOR_BOUNDS.surface.max);
    expect(surfaceFactor(0)).toBe(LAND_FACTOR_BOUNDS.surface.min);
    expect(surfaceFactor(-5)).toBe(LAND_FACTOR_BOUNDS.surface.min);
    // Le catalogue entier tient à l'intérieur des bornes, sans être écrêté.
    for (const t of TAILLES_PARCELLE) {
      const f = surfaceFactor(hectaresDeGrille(t.cote, t.cote));
      expect({ cote: t.cote, dedans: f > LAND_FACTOR_BOUNDS.surface.min && f < LAND_FACTOR_BOUNDS.surface.max }).toEqual(
        { cote: t.cote, dedans: true },
      );
    }
  });
});
