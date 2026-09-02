import {
  BUILDING_DEFS,
  BUILDING_LEVELS,
  BUILDING_MOVE_MAX,
  BUILDING_MOVE_MIN,
  BUILDING_MOVE_RATE,
  BUILDING_REGRET_MS,
  buildingMoveCost,
  buildingResaleValue,
  MAX_BUILDING_LEVEL,
  type BuildingType,
} from "@farmsim/shared";

/**
 * Le prix d'un déménagement.
 *
 * ## D'où ça vient
 *
 * Demandé en jouant : « ça serait bien de pouvoir déplacer les bâtiments qu'on
 * a posé, il faudrait que ce soit payant mais pas punitif, il faut que tu
 * trouves le prix équilibré qui permet quand même de se dire "bon ça coûte un
 * peu de me réorganiser" sans que ce soit impossible ni trop punitif ».
 *
 * La demande contient sa propre mesure, et c'est elle que ces tests tiennent :
 * **sensible, jamais dissuasif**. Deux bornes, donc, et pas une seule.
 *
 * ## L'étalon
 *
 * Une parcelle de blé rapporte environ 260 € nets par jour de jeu. C'est en
 * jours de blé qu'on lit les prix ici — un chiffre en euros ne dit rien tout
 * seul.
 */

const TOUS = Object.keys(BUILDING_DEFS) as BuildingType[];

/** Ce qu'un bâtiment de ce niveau a coûté, agrandissements compris. */
function investi(type: BuildingType, level: number): number {
  const base = BUILDING_DEFS[type].cost;
  let total = base;
  for (let l = 2; l <= level; l++) total += base * BUILDING_LEVELS[l - 1]!.upgradeCostMult;
  return total;
}

/** Un jour de jeu d'une parcelle de blé, net. C'est l'unité du jeu. */
const JOUR_DE_BLE = 260;

describe("déplacer coûte moins cher que démolir et rebâtir", () => {
  it("toujours, pour chaque bâtiment et chaque niveau", () => {
    /*
     * C'est l'invariant qui donne son sens à la fonctionnalité. La voie
     * d'avant — démolir (40 % rendus) puis rebâtir (100 % payés) — laissait
     * 60 % de l'investi sur la table. Si déplacer coûtait autant, personne ne
     * déplacerait, et on aurait ajouté un bouton sans ajouter un choix.
     */
    for (const type of TOUS) {
      for (let lvl = 1; lvl <= MAX_BUILDING_LEVEL; lvl++) {
        const perteEnDemolissant = investi(type, lvl) - buildingResaleValue(type, lvl);
        const demenagement = buildingMoveCost(type, lvl);
        expect(`${type} n${lvl} : ${demenagement < perteEnDemolissant}`).toBe(
          `${type} n${lvl} : true`,
        );
      }
    }
  });

  it("et beaucoup moins cher : au plus le huitième de cette perte", () => {
    /*
     * « Un peu moins cher » ne suffirait pas à changer la décision du joueur.
     * Le premier barème tenait le quart ; celui-ci, moitié moindre, tient le
     * huitième. La borne suit le barème, sinon elle cesse de mesurer quoi que
     * ce soit le jour où l'on baisse les prix.
     */
    for (const type of TOUS) {
      const perte = investi(type, 1) - buildingResaleValue(type, 1);
      expect(`${type} : ${buildingMoveCost(type, 1) <= perte / 8}`).toBe(`${type} : true`);
    }
  });
});

describe("sensible, mais jamais dissuasif", () => {
  it("aucun déménagement ne dépasse cinq jours de blé", () => {
    /*
     * La borne haute de « pas punitif ».
     *
     * Elle était à dix jours, ce qui restait « un peu dur pour replacer les
     * bâtiments » une fois manette en main. Cinq : la réorganisation devient
     * une contrariété plutôt qu'un arbitrage. C'est un réglage de confort, et
     * il se lit dans le seul chiffre qui compte — ce que la ferme gagne
     * pendant qu'on déplace.
     */
    for (const type of TOUS) {
      for (let lvl = 1; lvl <= MAX_BUILDING_LEVEL; lvl++) {
        const jours = buildingMoveCost(type, lvl) / JOUR_DE_BLE;
        expect(`${type} n${lvl} : ${jours <= 5}`).toBe(`${type} n${lvl} : true`);
      }
    }
  });

  it("le plus petit se déplace pour moins d’un demi-jour de blé", () => {
    // L'autre bout de l'échelle : déplacer un râtelier d'une case ne doit pas
    // se réfléchir. Sans cette borne, seul le plafond serait tenu.
    const petit = TOUS.reduce((a, b) => (BUILDING_DEFS[a].cost < BUILDING_DEFS[b].cost ? a : b));
    expect(buildingMoveCost(petit, 1) / JOUR_DE_BLE).toBeLessThan(0.5);
  });

  it("aucun déménagement n’est gratuit hors fenêtre de regret", () => {
    // La borne basse de « payant ». Sans elle, le plan de la ferme cesserait
    // d'être une décision : on poserait au hasard, quitte à ranger ensuite.
    for (const type of TOUS) {
      expect(`${type} : ${buildingMoveCost(type, 1) >= BUILDING_MOVE_MIN}`).toBe(`${type} : true`);
    }
  });

  it("le plus gros bâtiment coûte plus cher à bouger que le plus petit", () => {
    // Un prix forfaitaire rendrait le déplacement d'un râtelier aussi lourd
    // que celui d'une laiterie. L'échelle doit se sentir.
    const prix = TOUS.map((t) => buildingMoveCost(t, 1));
    expect(Math.max(...prix)).toBeGreaterThan(Math.min(...prix));
  });

  it("le plafond protège celui qui a le plus investi", () => {
    /*
     * Sans plafond, une laiterie poussée au niveau 5 coûterait près de dix-sept
     * mille € à déplacer : le joueur qui a le plus construit serait celui qui
     * aurait le moins le droit de réorganiser sa cour. C'est l'inverse du bon
     * sens.
     */
    const gros = TOUS.reduce((a, b) => (BUILDING_DEFS[a].cost > BUILDING_DEFS[b].cost ? a : b));
    expect(buildingMoveCost(gros, MAX_BUILDING_LEVEL)).toBe(BUILDING_MOVE_MAX);
    expect(investi(gros, MAX_BUILDING_LEVEL) * BUILDING_MOVE_RATE).toBeGreaterThan(
      BUILDING_MOVE_MAX,
    );
  });
});

describe("la fenêtre de regret", () => {
  it("rend le déplacement gratuit dans les trois minutes", () => {
    // Une place mal choisie à la pose est la même erreur que la démolition
    // intégralement remboursée rattrape déjà. On la rattrape pareil.
    for (const type of TOUS) {
      expect(buildingMoveCost(type, 1, BUILDING_REGRET_MS - 1_000)).toBe(0);
    }
  });

  it("le fait payer après", () => {
    for (const type of TOUS) {
      expect(buildingMoveCost(type, 1, BUILDING_REGRET_MS + 1_000)).toBeGreaterThan(0);
    }
  });

  it("un âge inconnu se paie plein tarif", () => {
    // Le doute ne doit jamais tomber du côté gratuit : un âge absent vient
    // d'une donnée manquante, pas d'un bâtiment tout neuf.
    for (const type of TOUS) {
      expect(buildingMoveCost(type, 1, undefined)).toBe(buildingMoveCost(type, 1));
    }
  });
});

describe("ce que le déménagement ne change pas", () => {
  it("le niveau ne se perd pas — il pèse même sur le prix", () => {
    /*
     * Un bâtiment déplacé garde sa ligne en base : même niveau, mêmes engins
     * rangés, même troupeau. C'est ce qui distingue un déménagement d'une
     * démolition suivie d'une reconstruction — et ce qui justifie qu'il ne
     * coûte pas la même chose.
     */
    const type = TOUS.find((t) => BUILDING_DEFS[t].cost < 5000)!;
    expect(buildingMoveCost(type, 4)).toBeGreaterThanOrEqual(buildingMoveCost(type, 1));
  });
});
