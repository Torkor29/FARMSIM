import { readFileSync } from "node:fs";
import {
  BUILDING_DEFS,
  installationBonus,
  installationLabel,
  installationLevel,
  productionFactor,
} from "@farmsim/shared";
import { herdAlerts, type BarnSnapshot } from "../ui/herd-alerts";

/**
 * Ce que l'écran d'élevage doit dire, et ce qu'il ne doit plus dire.
 *
 * Strea a envoyé la capture qui a déclenché la refonte : « je sais plus quoi
 * faire ». Dix-neuf bêtes pour cinquante-cinq places, ration servie avec un
 * jour et sept heures d'avance, litière à 79,72 t, lait à 93 % — et par-dessus
 * tout cela, en rouge : « le troupeau dépérit, des bêtes vont mourir ·
 * enfermées depuis trop longtemps : sortez-les au pré ». Le pré affichait
 * 0,0 / 2,88 t d'herbe et il faisait 10 °C dehors.
 *
 * Trois défauts dans une seule ligne : l'alerte était fausse, le geste proposé
 * n'aidait pas, et ne pas le faire tuait. Ces tests les tiennent fermés.
 */
const PANNEAU = readFileSync("src/LivestockPanel.tsx", "utf8");

/** L'étable de la capture : cinquante-cinq places, dix-neuf bêtes dedans. */
const etable = (over: Partial<BarnSnapshot["herd"]> = {}): BarnSnapshot => ({
  buildingId: "b1",
  name: "Étable bovins",
  paddockCapacity: 0,
  herd: {
    id: "h1",
    kind: "COW",
    size: 19,
    atRisk: false,
    hungry: false,
    feedStock: 400,
    feedNeed: 266,
    water: 1,
    health: 1,
    cascade: "OK",
    beddingCover: 1,
    housing: "INSIDE",
    ...over,
  },
});

describe("l'écran ne réclame plus un geste qui n'aide pas", () => {
  it("ne dit rien du tout sur un troupeau nourri, abreuvé et au large", () => {
    // Le cas exact de la capture. Pas une alerte, pas une ligne rouge.
    expect(herdAlerts([etable()])).toEqual([]);
  });

  it("ne propose plus jamais « sortez-les au pré » comme remède", () => {
    // C'était la cause la plus coûteuse de l'ancien barème — jusqu'à 0,60
    // point — et elle s'affichait sur des troupeaux qu'aucune sortie n'aurait
    // sauvés. La cause `SORTIE` n'existe plus côté domaine ; on vérifie ici
    // qu'aucun texte de l'écran ne la ressuscite.
    expect(PANNEAU).not.toMatch(/sortez-les au pré/i);
    expect(PANNEAU).not.toMatch(/enfermées depuis trop longtemps/i);
  });

  it("annonce la mort seulement quand elle est imminente", () => {
    const paliers = (etape: "PRODUCTION" | "SANTE" | "CRITIQUE" | "MORTEL") =>
      herdAlerts([etable({ cascade: etape, hungry: true, feedStock: 0 })], { hasFeed: true });

    // Trois avertissements avant, et chacun dit ce qui se passe.
    expect(paliers("PRODUCTION")[0].text).toMatch(/ration/i);
    expect(paliers("PRODUCTION")[0].level).toBe("warn");
    expect(paliers("SANTE")[0].text).toMatch(/santé/i);
    expect(paliers("CRITIQUE")[0].text).toMatch(/critique/i);
    expect(paliers("MORTEL")[0].text).toMatch(/peuvent mourir/i);

    // Et aucun des trois premiers ne parle de bêtes qui meurent.
    for (const etape of ["PRODUCTION", "SANTE", "CRITIQUE"] as const) {
      expect(paliers(etape)[0].text).not.toMatch(/mourir/i);
    }
  });

  it("propose un geste faisable à chaque étage de la cascade", () => {
    for (const etape of ["PRODUCTION", "SANTE", "CRITIQUE", "MORTEL"] as const) {
      const [alerte] = herdAlerts([etable({ cascade: etape, hungry: true, feedStock: 0 })], {
        hasFeed: false,
      });
      // Sans un kilo en réserve, « Nourrir » distribuerait du vide : l'alerte
      // mène alors à l'hôtel des ventes.
      expect(alerte.action).toEqual({ kind: "BUY_FEED" });
      expect(alerte.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it("signale la soif, qui n'existait pas", () => {
    const [alerte] = herdAlerts([etable({ water: 0 })]);
    expect(alerte.text).toMatch(/boire/i);
    expect(alerte.level).toBe("danger");
    // Et rien tant que l'abreuvoir suit.
    expect(herdAlerts([etable({ water: 1 })])).toEqual([]);
  });
});

describe("l'écran montre les places qui restent, et ce que l'installation rapporte", () => {
  it("dit « places disponibles » là où il disait « encombrée »", () => {
    expect(PANNEAU).toMatch(/place\$\{/);
    expect(PANNEAU).toMatch(/disponible/);
    expect(PANNEAU).toMatch(/de trop/);
  });

  it("affiche la production, et non plus le seul bien-être", () => {
    expect(PANNEAU).toMatch(/productionFactor\(/);
    expect(PANNEAU).toMatch(/Production · \{herd\.label\}/);
  });

  it("liste les quatre pièces de l'installation et les trois bonus", () => {
    for (const morceau of ["Enclos attenant", "Abreuvoir automatique", "Râtelier à fourrage"]) {
      expect(PANNEAU).toContain(morceau);
    }
    expect(PANNEAU).toMatch(/installationLabel\(/);
    expect(PANNEAU).toMatch(/bonusInstall\.production/);
    expect(PANNEAU).toMatch(/bonusInstall\.reproduction/);
    expect(PANNEAU).toMatch(/bonusInstall\.feed/);
  });

  it("montre les deux jauges nouvelles, eau et santé", () => {
    expect(PANNEAU).toMatch(/nom="Eau"/);
    expect(PANNEAU).toMatch(/nom="Santé"/);
  });
});

describe("les chiffres affichés sont ceux de la simulation", () => {
  it("lit 100 % sur un troupeau aux besoins remplis, sans rien bâti", () => {
    const nu = installationLevel({ barnLevel: 1 });
    expect(Math.round(productionFactor({ happiness: 1, installationLevel: nu }).total * 100)).toBe(
      100,
    );
    expect(installationLabel(nu)).toBe("Basique");
  });

  it("lit 130 % sur une installation complète", () => {
    const complet = installationLevel({
      barnLevel: 5,
      hasPaddock: true,
      hasTrough: true,
      hasRack: true,
    });
    expect(
      Math.round(productionFactor({ happiness: 1, installationLevel: complet }).total * 100),
    ).toBe(130);
    expect(installationBonus(complet).reproduction).toBeCloseTo(0.15, 6);
  });

  it("propose les deux annexes au catalogue, avec leur illustration", () => {
    for (const type of ["WATER_TROUGH", "HAY_RACK"] as const) {
      const def = BUILDING_DEFS[type];
      expect(def.w * def.h).toBe(1);
      expect(def.description.length).toBeGreaterThan(20);
      // Elles se collent à un bâtiment d'élevage : la fiche doit le dire, sinon
      // le joueur pose la sienne à l'autre bout de la ferme et paie pour rien.
      expect(def.description).toMatch(/collé/i);
    }
  });
});
