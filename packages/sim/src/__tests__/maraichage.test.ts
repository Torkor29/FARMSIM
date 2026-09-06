/**
 * Le maraîchage : cinq boucles courtes, et la pente qui les tient.
 *
 * ## Ce qui manquait
 *
 * Demandé en jouant : « pour ajouter des boucles de jeu plus courtes, il va
 * falloir ajouter des récoltes avec une durée plus courte ». La plus rapide du
 * catalogue était l'herbe à douze heures réelles, et le pois à treize pour la
 * vente : on ne pouvait ni semer ni récolter dans une même soirée.
 *
 * ## La règle qu'il faut protéger
 *
 * **Plus la boucle est courte, moins elle paie à l'heure.** C'est le seul
 * garde-fou entre « une culture rapide de plus » et « plus personne ne sème de
 * blé ». Elle ne se voit pas en lisant les cinq fiches — elle se calcule — et
 * c'est exactement le genre de règle qu'une retouche de prix casse sans que
 * personne s'en aperçoive.
 */

import {
  CROP_CODES,
  CROP_DEFS,
  CROP_SEASONALITY,
  GOOD_DEFS,
  MARAICHAGE,
  MESCLUN_MAX_CUTS,
  PLANTING_WINDOW,
  SEASON_GROWTH,
  coupesMax,
  cropGrowMs,
  estMaraichage,
  repousseApresCoupe,
  type CropCode,
} from "@farmsim/shared";

const HEURE = 3_600_000;

/** Ce qu'une case rapporte par heure, semence déduite, au cours de base. */
function parHeure(crop: CropCode): number {
  const def = CROP_DEFS[crop];
  const prix = GOOD_DEFS[crop as keyof typeof GOOD_DEFS]?.basePrice ?? 0;
  return (def.yieldPerCell * prix - def.seedCostPerCell) / (def.growMs / HEURE);
}

describe("le maraîchage", () => {
  it("ajoute cinq cultures plus courtes que tout ce qui existait", () => {
    // L'herbe à douze heures était le plancher ; le maraîchage passe dessous.
    const plancherAvant = Math.min(
      ...["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"].map(
        (c) => CROP_DEFS[c as CropCode].growMs,
      ),
    );
    for (const c of MARAICHAGE) {
      expect(CROP_DEFS[c].growMs).toBeLessThan(plancherAvant);
    }
    expect(MARAICHAGE).toHaveLength(5);
  });

  it("met la plus courte à deux heures", () => {
    // C'est la promesse : on sème en arrivant, on récolte avant de partir.
    expect(CROP_DEFS.MESCLUN.growMs).toBe(2 * HEURE);
    expect(CROP_DEFS.RADISH.growMs).toBe(3 * HEURE);
    expect(CROP_DEFS.POTATO.growMs).toBe(10 * HEURE);
  });

  /**
   * Le cœur du fichier. Sans cette pente, la culture de deux heures serait
   * la seule qu'on sèmerait, et le jeu de ferme deviendrait un jeu de clics.
   */
  it("paie d'autant moins à l'heure que la boucle est courte", () => {
    const ordre = [...MARAICHAGE].sort(
      (a, b) => CROP_DEFS[a].growMs - CROP_DEFS[b].growMs,
    );
    const taux = ordre.map(parHeure);
    // Le mesclun (le plus court) doit être le moins rentable du lot.
    expect(taux[0]).toBe(Math.min(...taux));
    // Et la pomme de terre (la plus longue) la mieux payée.
    expect(taux[taux.length - 1]).toBe(Math.max(...taux));
  });

  it("ne laisse aucun légume battre le pois", () => {
    // Le pois est la culture de vente la plus rentable à l'heure du jeu
    // d'avant. Un légume au-dessus rendrait toute rotation absurde.
    const pois = parHeure("PEA");
    for (const c of MARAICHAGE) {
      expect(parHeure(c)).toBeLessThan(pois);
    }
  });

  it("reste au-dessus du blé : la corvée doit valoir quelque chose", () => {
    // L'autre bord. Un légume moins rentable que le blé *et* neuf fois plus
    // exigeant n'aurait aucune raison d'exister.
    const ble = parHeure("WHEAT");
    for (const c of MARAICHAGE) {
      expect(parHeure(c)).toBeGreaterThan(ble);
    }
  });

  it("rend les feuilles périssables et la pomme de terre non", () => {
    // C'est la texture du lot : on ne stocke pas une salade en attendant un
    // bon cours, on la vend. La patate se garde, et donne au silo une raison
    // d'être quand on fait du légume.
    for (const feuille of ["MESCLUN", "SPINACH", "LETTUCE"] as const) {
      expect(GOOD_DEFS[feuille].perishable).toBe(true);
    }
    expect(GOOD_DEFS.POTATO.perishable).toBe(false);
  });

  it("fait repousser le mesclun, et lui seul parmi les légumes", () => {
    expect(repousseApresCoupe("MESCLUN")).toBe(true);
    expect(repousseApresCoupe("GRASS")).toBe(true);
    for (const c of ["RADISH", "SPINACH", "LETTUCE", "POTATO"] as const) {
      expect(repousseApresCoupe(c)).toBe(false);
      expect(coupesMax(c)).toBe(0);
    }
    expect(coupesMax("MESCLUN")).toBe(MESCLUN_MAX_CUTS);
  });

  /**
   * La règle testait `GRASS` en dur. Le mesclun repousse lui aussi, et la
   * condition l'aurait ignoré en silence : un rang recoupé aurait remis deux
   * heures pleines au lieu d'une heure et demie.
   */
  it("raccourcit la repousse du mesclun après la première coupe", () => {
    expect(cropGrowMs("MESCLUN", 0)).toBe(2 * HEURE);
    expect(cropGrowMs("MESCLUN", 1)).toBe(1.5 * HEURE);
    expect(cropGrowMs("MESCLUN", 1)).toBeLessThan(cropGrowMs("MESCLUN", 0));
    // Une culture sans repousse ne change pas de durée, quoi qu'on ait coupé.
    expect(cropGrowMs("RADISH", 3)).toBe(cropGrowMs("RADISH", 0));
  });

  it("ouvre trois saisons au légume, jamais l'hiver", () => {
    // Un mesclun de deux heures derrière une attente de vingt n'est pas une
    // boucle courte : c'est une boucle longue déguisée.
    for (const c of MARAICHAGE) {
      expect(PLANTING_WINDOW[c]).toEqual(["SPRING", "SUMMER", "AUTUMN"]);
      expect(PLANTING_WINDOW[c]).not.toContain("WINTER");
      expect(CROP_SEASONALITY[c]).toBe("MARAICHAGE");
    }
    // Et rien ne sort de terre en janvier.
    expect(SEASON_GROWTH.MARAICHAGE.WINTER).toBeLessThan(0.1);
  });

  it("donne à chaque légume sa fiche de marchandise", () => {
    // Une culture sans marchandise se récolte dans le vide : le stock
    // n'existe pas, et la vente échoue sans rien dire.
    for (const c of MARAICHAGE) {
      const bien = GOOD_DEFS[c];
      expect(bien).toBeTruthy();
      expect(bien.sellable).toBe(true);
      expect(bien.basePrice).toBeGreaterThan(0);
      expect(bien.name).toBe(CROP_DEFS[c].name);
    }
  });

  it("range les cinq dans le catalogue des cultures", () => {
    for (const c of MARAICHAGE) {
      expect(CROP_CODES).toContain(c);
      expect(estMaraichage(c)).toBe(true);
    }
    for (const c of ["WHEAT", "GRASS"] as const) {
      expect(estMaraichage(c)).toBe(false);
    }
  });
});
