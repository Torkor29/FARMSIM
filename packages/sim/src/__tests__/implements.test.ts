/**
 * Porteur, outil, paliers.
 *
 * C'est la structure qui définit le genre, et elle manquait : un seul
 * « Tracteur T1 » semait, labourait, fertilisait, fauchait et ramassait les
 * bottes. Acheter un tracteur débloquait cinq travaux d'un coup, et il ne
 * restait plus rien à convoiter — les six engins portaient tous `tier: 1`, et
 * la colonne existait sans jamais servir.
 *
 * Un tracteur n'est plus que de la puissance. L'outil fait le travail, et il
 * faut assez de chevaux pour le tirer. Les assertions ci-dessous tiennent les
 * trois règles qui font tenir l'ensemble : personne ne travaille seul, la
 * largeur décide de la vitesse, et un palier plus haut se mérite.
 */

import {
  FIELD_EFFICIENCY,
  MACHINE_DEFS,
  MACHINE_TIERS,
  PARCEL_HECTARES,
  canPull,
  hoursPerHectare,
  jobHours,
  machineCost,
  machineHoursPerHectare,
  machinePower,
  machineRequiredHp,
  machineResaleValue,
  machineWidth,
  type MachineType,
  type Tier,
} from "@farmsim/shared";

const TOUS = Object.keys(MACHINE_DEFS) as MachineType[];
const OUTILS = TOUS.filter((t) => MACHINE_DEFS[t].kind === "IMPLEMENT");
const PORTEURS = TOUS.filter((t) => MACHINE_DEFS[t].kind === "TRACTOR");
const TRAVAUX = ["PLANT", "FERTILIZE", "HARVEST", "PLOW", "STUBBLE", "MOW", "BALE", "COLLECT", "SILAGE"];

describe("le tracteur ne travaille plus seul", () => {
  it("n'a aucun travail à son nom", () => {
    for (const t of PORTEURS) expect(MACHINE_DEFS[t].works).toHaveLength(0);
  });

  it("laisse chaque travail à exactement un outil", () => {
    // Deux outils pour un même travail ferait de l'un des deux un achat mort.
    for (const travail of TRAVAUX) {
      const capables = TOUS.filter((t) => MACHINE_DEFS[t].works.includes(travail as never));
      expect(capables).toHaveLength(1);
    }
  });

  it("donne des chevaux aux porteurs et aux automoteurs, à eux seuls", () => {
    for (const t of TOUS) {
      const def = MACHINE_DEFS[t];
      if (def.kind === "IMPLEMENT") {
        expect(def.requiredHp).toBeGreaterThan(0);
        expect(def.powerHp).toBeUndefined();
      } else {
        expect(def.powerHp).toBeGreaterThan(0);
        expect(def.requiredHp).toBeUndefined();
      }
    }
  });

  it("laisse le tracteur de départ tirer tout l'outillage de base", () => {
    // Sans cela, une ferme neuve posséderait un outil inutilisable — le pire
    // des accueils.
    for (const outil of OUTILS) {
      const tractable = PORTEURS.some((p) =>
        canPull({ type: p, tier: 1 }, { type: outil, tier: 1 }),
      );
      expect(tractable).toBe(true);
    }
  });
});

describe("la largeur fait la vitesse", () => {
  it("déduit les heures par hectare de la largeur et de l'allure", () => {
    // La formule du machinisme, pas une invention : `l × v / 10` hectares à
    // l'heure, dont on ne garde que le rendement de chantier.
    // La fonction arrondit au millième pour l'affichage : on compare à cette
    // précision-là, pas à celle du flottant brut.
    const attendu = 1 / ((4 * 10 * FIELD_EFFICIENCY) / 10);
    expect(hoursPerHectare(4, 10)).toBeCloseTo(attendu, 2);
  });

  it("chiffre un champ entier en heures agricoles plausibles", () => {
    /*
     * Une demi-heure de plancher, pas une heure : une rampe de dix-huit mètres
     * traverse quatorze hectares en moins d'une heure, et c'est exactement ce
     * qui fait d'un passage de pulvérisateur un geste qu'on peut se permettre
     * en cours de campagne.
     */
    for (const t of TOUS.filter((x) => MACHINE_DEFS[x].kind !== "TRACTOR")) {
      const h = jobHours(machineHoursPerHectare(t), 144);
      expect(h).toBeGreaterThan(0.5);
      expect(h).toBeLessThan(15);
    }
  });

  it("fait de la charrue le goulot du parc — c'est vrai au champ", () => {
    const charrue = jobHours(machineHoursPerHectare("PLOUGH"), 144);
    for (const t of OUTILS.filter((x) => x !== "PLOUGH")) {
      expect(jobHours(machineHoursPerHectare(t), 144)).toBeLessThan(charrue);
    }
  });

  it("garde le chantier proportionnel à la surface", () => {
    const plein = jobHours(machineHoursPerHectare("SEEDER"), 144);
    const moitie = jobHours(machineHoursPerHectare("SEEDER"), 72);
    expect(moitie).toBeCloseTo(plein / 2, 2);
    expect(plein).toBeCloseTo(machineHoursPerHectare("SEEDER") * PARCEL_HECTARES, 1);
  });
});

describe("un palier se paie et se mérite", () => {
  it("va plus vite sans jamais rendre davantage", () => {
    /**
     * Le principe qui évite l'inflation : un T3 ne récolte pas *mieux*, il
     * récolte plus **vite**. Le temps gagné est ce qui permet de rattraper la
     * fenêtre de récolte — c'est la seule récompense, et elle suffit.
     */
    for (const t of OUTILS) {
      let precedent = Infinity;
      for (const tier of MACHINE_TIERS) {
        const h = jobHours(machineHoursPerHectare(t, tier), 144);
        expect(h).toBeLessThan(precedent);
        precedent = h;
      }
    }
  });

  it("exige un tracteur qui suive — c'est la boucle de progression", () => {
    // Une charrue plus large ne se tire pas avec le tracteur d'hier.
    for (const outil of OUTILS) {
      for (const tier of [2, 3] as Tier[]) {
        expect(machineRequiredHp(outil, tier)).toBeGreaterThan(machineRequiredHp(outil, 1));
      }
    }
    expect(canPull({ type: "TRACTOR", tier: 1 }, { type: "PLOUGH", tier: 2 })).toBe(false);
    expect(canPull({ type: "TRACTOR", tier: 2 }, { type: "PLOUGH", tier: 2 })).toBe(true);
  });

  it("coûte plus cher que le gain de largeur", () => {
    // Sinon le palier 1 n'aurait aucune raison d'exister : on achèterait le
    // plus gros d'emblée.
    for (const t of TOUS) {
      for (const tier of [2, 3] as Tier[]) {
        const prixRelatif = machineCost(t, tier) / machineCost(t, 1);
        const largeurRelative =
          MACHINE_DEFS[t].kind === "TRACTOR"
            ? machinePower(t, tier) / machinePower(t, 1)
            : machineWidth(t, tier) / machineWidth(t, 1);
        expect(prixRelatif).toBeGreaterThan(largeurRelative);
      }
    }
  });

  it("se revend au prorata de son palier", () => {
    for (const t of TOUS) {
      const t1 = machineResaleValue(t, { condition: 100, hours: 0, tier: 1 });
      const t3 = machineResaleValue(t, { condition: 100, hours: 0, tier: 3 });
      expect(t3).toBeGreaterThan(t1);
      // Et jamais au-dessus du neuf, sinon on fabrique de l'argent.
      expect(t3).toBeLessThan(machineCost(t, 3));
    }
  });
});
