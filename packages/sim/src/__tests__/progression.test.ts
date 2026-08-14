import {
  BUILDING_LEVELS,
  MAX_BUILDING_LEVEL,
  MAX_LEVEL,
  PARCEL_LEVEL_GATES,
  levelForXp,
  levelProgress,
  levelUnlocks,
  nextUnlock,
  shortfall,
  xpFor,
  xpForLevel,
} from "@farmsim/shared";

/**
 * La progression, mesurée.
 *
 * Deux reproches du joueur avaient la même cause : « on gagne de l'XP avec
 * rien » et « niveau trop bas pour une parcelle ». Aucune fonction ne
 * traduisait l'expérience en niveau, si bien que le niveau ne montait jamais,
 * pendant que trois gestes seulement rapportaient des points forfaitaires.
 *
 * Ces tests tiennent les deux bouts : la courbe doit être cohérente et
 * atteignable, et le barème doit payer le **travail**, pas le clic.
 */

describe("la courbe", () => {
  it("un niveau se traduit en expérience, et réciproquement", () => {
    for (let n = 1; n <= MAX_LEVEL; n++) {
      expect(`Nv.${n} → ${levelForXp(xpForLevel(n))}`).toBe(`Nv.${n} → ${n}`);
    }
  });

  it("un point de moins, et le palier n'est pas atteint", () => {
    // Le cas qui casse en silence : arriver à l'XP exacte du palier sans
    // monter, ou monter un point trop tôt.
    for (let n = 2; n <= 30; n++) {
      expect(levelForXp(xpForLevel(n) - 1)).toBe(n - 1);
    }
  });

  it("l'expérience nécessaire ne fait que croître", () => {
    for (let n = 2; n <= MAX_LEVEL; n++) {
      expect(xpForLevel(n)).toBeGreaterThan(xpForLevel(n - 1));
    }
  });

  it("la jauge du palier reste dans ses bornes", () => {
    for (const xp of [0, 1, 279, 280, 3500, 50_000, 10_000_000]) {
      const p = levelProgress(xp);
      expect(p.into).toBeGreaterThanOrEqual(0);
      expect(p.into).toBeLessThanOrEqual(p.span);
      expect(p.span).toBeGreaterThan(0);
    }
  });

  it("le dernier palier de parcelle est atteignable", () => {
    // Une courbe qui plafonne sous le dernier palier rendrait la seizième
    // parcelle inaccessible — exactement le défaut qu'on corrige.
    expect(MAX_LEVEL).toBeGreaterThanOrEqual(
      PARCEL_LEVEL_GATES[PARCEL_LEVEL_GATES.length - 1],
    );
  });
});

/**
 * Une heure de jeu actif : un cycle complet sur une parcelle de douze par
 * douze — semer, fertiliser, moissonner, nettoyer — et une vente.
 */
function hourOfPlay(): number {
  const CELLS = 144;
  const TONS = CELLS * 0.35;
  return (
    xpFor("PLANT", { cells: CELLS }) +
    xpFor("FERTILIZE", { cells: CELLS }) +
    xpFor("HARVEST", { cells: CELLS, tons: TONS }) +
    xpFor("STUBBLE", { cells: CELLS }) +
    xpFor("SELL", { tons: TONS })
  );
}

describe("le rythme", () => {
  it("le deuxième champ demande une bonne soirée, pas dix minutes", () => {
    const perHour = hourOfPlay();
    const hours = xpForLevel(PARCEL_LEVEL_GATES[1]) / perHour;
    // Rythme voulu : lent. Le deuxième champ vers la troisième heure — ni au
    // bout de vingt minutes, ni au bout d'une semaine.
    expect(`${hours.toFixed(1)} h ${hours > 2 && hours < 5}`).toBe(
      `${hours.toFixed(1)} h true`,
    );
  });

  it("le troisième champ se mérite davantage que le deuxième", () => {
    const perHour = hourOfPlay();
    const second = xpForLevel(PARCEL_LEVEL_GATES[1]) / perHour;
    const third = xpForLevel(PARCEL_LEVEL_GATES[2]) / perHour;
    expect(third).toBeGreaterThan(second * 1.8);
  });
});

describe("le barème paie le travail", () => {
  it("moissonner dix tonnes rapporte dix fois plus qu'une", () => {
    const une = xpFor("HARVEST", { cells: 1, tons: 1 });
    const dix = xpFor("HARVEST", { cells: 10, tons: 10 });
    expect(dix).toBeGreaterThanOrEqual(une * 9);
  });

  it("vendre une remorque rapporte plus qu'un sac", () => {
    // Le forfait de dix points payait pareil les deux : c'est précisément ce
    // qui donnait l'impression de gagner de l'XP sans rien faire.
    expect(xpFor("SELL", { tons: 40 })).toBeGreaterThan(xpFor("SELL", { tons: 1 }) * 20);
  });

  it("labourer coûte plus cher que déchaumer", () => {
    expect(xpFor("PLOW", { cells: 20 })).toBeGreaterThan(xpFor("STUBBLE", { cells: 20 }));
  });

  it("un lot plus gros donne plus à la traite", () => {
    expect(xpFor("COLLECT", { animals: 12 })).toBeGreaterThan(xpFor("COLLECT", { animals: 2 }));
  });

  it("aucun geste ne rapporte de points négatifs", () => {
    const events = [
      "PLANT", "FERTILIZE", "PLOW", "STUBBLE", "HARVEST", "MOW", "GRAZE", "FEED",
      "COLLECT", "SLAUGHTER", "BUILD", "UPGRADE", "MACHINE_CARE", "MACHINE_BUY",
      "SELL", "DELIVER", "CONTRACT", "LABOR", "QUEST",
    ] as const;
    for (const e of events) {
      expect(`${e} ${xpFor(e, {}) >= 0}`).toBe(`${e} true`);
      expect(`${e} ${xpFor(e, { cells: -5, tons: -3, animals: -2, cost: -9 }) >= 0}`).toBe(
        `${e} true`,
      );
    }
  });
});

describe("ce que chaque niveau ouvre", () => {
  it("aucun palier ne donne de bonus chiffré", () => {
    // Garde-fou de la charte §1 : les niveaux restent faibles, et les
    // déblocages sont non-statistiques. Un « +2 % » qui se glisserait ici
    // ouvrirait la porte au reste.
    for (const u of levelUnlocks()) {
      const text = `${u.label} ${u.detail}`;
      expect(`Nv.${u.level} ${!/%|\+\d/.test(text)}`).toBe(`Nv.${u.level} true`);
    }
  });

  it("chaque palier de parcelle figure dans la table", () => {
    const levels = new Set(levelUnlocks().map((u) => u.level));
    for (const gate of PARCEL_LEVEL_GATES.slice(1)) {
      expect(`palier ${gate} listé : ${levels.has(gate)}`).toBe(`palier ${gate} listé : true`);
    }
  });

  it("chaque palier de bâtiment figure dans la table", () => {
    const levels = new Set(levelUnlocks().map((u) => u.level));
    for (let l = 2; l <= MAX_BUILDING_LEVEL; l++) {
      const need = BUILDING_LEVELS[l - 1].requiredLevel;
      if (need <= 1) continue;
      expect(`bâtiment Nv.${l} → joueur ${need} : ${levels.has(need)}`).toBe(
        `bâtiment Nv.${l} → joueur ${need} : true`,
      );
    }
  });

  it("la table est ordonnée et porte son coût en expérience", () => {
    const list = levelUnlocks();
    expect(list.length).toBeGreaterThan(5);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].level).toBeGreaterThan(list[i - 1].level);
      expect(list[i].xp).toBe(xpForLevel(list[i].level));
    }
  });

  it("le palier suivant se trouve, et s'épuise au sommet", () => {
    expect(nextUnlock(1)?.level).toBe(PARCEL_LEVEL_GATES[1] > 3 ? 3 : PARCEL_LEVEL_GATES[1]);
    expect(nextUnlock(MAX_LEVEL)).toBeNull();
  });
});

describe("le refus", () => {
  it("dit le niveau requis et ce qui manque", () => {
    // « Votre niveau est trop bas » n'apprenait rien : ni combien il faut, ni
    // combien il reste.
    const msg = shortfall(xpForLevel(4), 6);
    expect(msg).toContain("Niveau 6");
    expect(msg).toContain("Nv.4");
    expect(msg).toMatch(/\d+ XP/);
  });
});
