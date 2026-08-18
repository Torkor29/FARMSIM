import {
  CROP_DEFS,
  CROP_CODES,
  GRASS_MAX_CUTS,
  cropGrowMs,
  emptyGrainStock,
  grassCutsDone,
  grassWillRegrow,
  harvestItemCode,
  isGrainGood,
  isLegume,
  isMowCrop,
  rotationFactor,
  BREAK_CROP_BONUS,
  NITROGEN_BONUS,
} from "@farmsim/shared";
import { simulateCell } from "../index.js";

describe("orge, colza, herbe", () => {
  it("déclare les six cultures", () => {
    expect(CROP_CODES).toEqual(["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"]);
    expect(CROP_DEFS.BARLEY.name).toBe("Orge");
    expect(CROP_DEFS.RAPE.name).toBe("Colza");
    expect(CROP_DEFS.GRASS.name).toBe("Herbe");
  });

  it("fait pousser l'herbe plus vite après une fauche", () => {
    expect(cropGrowMs("GRASS", 0)).toBe(CROP_DEFS.GRASS.growMs);
    expect(cropGrowMs("GRASS", 1)).toBe(CROP_DEFS.GRASS.regrowMs);
    expect(cropGrowMs("BARLEY", 2)).toBe(CROP_DEFS.BARLEY.growMs);
  });

  it("transforme l'herbe en foin, pas en grain", () => {
    expect(harvestItemCode("GRASS")).toBe("HAY");
    expect(harvestItemCode("BARLEY")).toBe("BARLEY");
    expect(isMowCrop("GRASS")).toBe(true);
    expect(isMowCrop("WHEAT")).toBe(false);
    expect(isGrainGood("BARLEY")).toBe(true);
    expect(isGrainGood("RAPE")).toBe(true);
    expect(isGrainGood("HAY")).toBe(false);
  });

  it("laisse l'herbe reprendre deux fois, puis il faut resemer", () => {
    expect(grassWillRegrow(1)).toBe(true);
    expect(grassWillRegrow(2)).toBe(true);
    expect(grassWillRegrow(GRASS_MAX_CUTS)).toBe(false);
  });

  it("ne compte les coupes d'herbe que sur un stand déjà fauché", () => {
    expect(grassCutsDone({ crop: "GRASS", lastCrop: "WHEAT", harvestsSincePlow: 2 })).toBe(0);
    expect(grassCutsDone({ crop: "GRASS", lastCrop: "GRASS", harvestsSincePlow: 2 })).toBe(2);
    expect(grassCutsDone({ crop: "BARLEY", lastCrop: "GRASS", harvestsSincePlow: 1 })).toBe(0);
  });

  it("fait du colza une rupture, pas une légumineuse", () => {
    expect(isLegume("RAPE")).toBe(false);
    expect(isLegume("PEA")).toBe(true);
    const apresColza = rotationFactor({ lastCrop: "RAPE", cropStreak: 1 }, "WHEAT");
    const apresPois = rotationFactor({ lastCrop: "PEA", cropStreak: 1 }, "WHEAT");
    expect(apresColza).toBeCloseTo(1 + BREAK_CROP_BONUS);
    expect(apresPois).toBeCloseTo(1 + NITROGEN_BONUS);
    expect(apresPois).toBeGreaterThan(apresColza);
  });

  it("range orge et colza dans le silo à grain", () => {
    const empty = emptyGrainStock();
    expect(empty.BARLEY).toBe(0);
    expect(empty.RAPE).toBe(0);
    expect("GRASS" in empty).toBe(false);
  });

  it("rend l'herbe prête plus tôt au second cycle", () => {
    /**
     * L'instant d'observation était écrit en dur — 90 000 ms — parce qu'il
     * tombait alors entre les deux durées de l'herbe (80 s et 120 s). Ces
     * durées se comptent maintenant en jours de jeu, et l'instant figé ne
     * tombait plus entre rien du tout. On le dérive des constantes : c'est
     * l'écart entre première pousse et repousse qu'on veut éprouver, pas une
     * valeur de mise au point.
     */
    const entreLesDeux = (cropGrowMs("GRASS", 1) + cropGrowMs("GRASS", 0)) / 2;
    const commun = {
      crop: "GRASS" as const,
      plantedAt: 0,
      now: entreLesDeux,
      fertility: 0.7,
      weedsControlled: true,
      fertilizedPasses: 1 as const,
    };
    expect(simulateCell({ ...commun, cutsDone: 0 }).ready).toBe(false);
    expect(simulateCell({ ...commun, cutsDone: 1 }).ready).toBe(true);
  });
});
