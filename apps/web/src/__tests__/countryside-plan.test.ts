import type { Season } from "@farmsim/shared";
import {
  CYCLE_VOISIN,
  cultureDe,
  etatDepuisStade,
  orientationTrame,
  parcelleSous,
  tourner,
  DEMI_ROUTE,
  ENGINS_MAX,
  LARGEUR_CHEMIN,
  couleurChamp,
  couloirRoute,
  empriseParcelle,
  etatChamp,
  grainerDe,
  horizonPour,
  melanger,
  planCampagne,
  seChevauchent,
  suite,
  surLeSol,
  versEcranBas,
  versEcranDroite,
  type OptionsPlan,
  type VoisinReel,
} from "../countryside-plan";

/**
 * La campagne autour de la ferme, mesurée.
 *
 * La parcelle du joueur flottait dans le ciel : une dalle de terre, quatre
 * arbres, et le vide. Ce qui l'entoure maintenant est calculé — donc
 * vérifiable. Une parcelle posée sur la cour, une route qui coupe le parking
 * ou un décor qui change à chaque rechargement se voient ici, pas à l'écran.
 *
 * Deux exigences nouvelles portent la plupart des assertions :
 *
 * - les voisins sont **jointifs et de la taille du joueur** — ce sont les
 *   parcelles qu'il pourra racheter ;
 * - le sol s'arrête sur une **horizontale à l'écran**, pour qu'il reste du
 *   ciel en haut du cadre.
 */

/** L'emprise réelle d'une parcelle de douze cases, talus compris. */
const EMPRISE = 12 * 1.06 + 1.4;

const OPTIONS: OptionsPlan = {
  graine: "clos-d-orme",
  emprise: EMPRISE,
  cour: { x: -11.5, z: 2.5, w: 6, d: 9 },
};

const SAISONS: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
const ETATS = ["LABOUR", "SEMIS", "POUSSE", "MUR", "CHAUME", "JACHERE"];

describe("la graine", () => {
  it("rend deux fois la même campagne", () => {
    // Un décor qui change à chaque visite ne serait pas un lieu.
    expect(JSON.stringify(planCampagne(OPTIONS))).toBe(JSON.stringify(planCampagne(OPTIONS)));
  });

  it("rend deux campagnes différentes à deux fermes différentes", () => {
    const a = planCampagne(OPTIONS);
    const b = planCampagne({ ...OPTIONS, graine: "terre-d-orme" });
    expect(JSON.stringify(a.parcelles)).not.toBe(JSON.stringify(b.parcelles));
  });

  it("garde la trame, et ne tire au sort que ce qui pousse dessus", () => {
    /*
     * C'est tout le changement. Les emplacements étaient tirés au sort et le
     * résultat se lisait en jeu : « les champs sont complètement dispersés ici
     * ou là ». Seules les cultures bougent d'une ferme à l'autre.
     */
    const a = planCampagne(OPTIONS);
    const b = planCampagne({ ...OPTIONS, graine: "terre-d-orme" });
    expect(a.parcelles.map((p) => `${p.col},${p.rang}`)).toEqual(
      b.parcelles.map((p) => `${p.col},${p.rang}`),
    );
  });

  it("tire des nombres bien répartis entre zéro et un", () => {
    const r = suite(grainerDe("essai"));
    const tirages = Array.from({ length: 400 }, r);
    expect(Math.min(...tirages)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...tirages)).toBeLessThan(1);
    const moyenne = tirages.reduce((s, x) => s + x, 0) / tirages.length;
    expect(Math.abs(moyenne - 0.5)).toBeLessThan(0.06);
  });
});

describe("la trame des voisins", () => {
  const plan = planCampagne(OPTIONS);

  it("pose assez de parcelles pour peupler le tour de la ferme", () => {
    expect(plan.parcelles.length).toBeGreaterThanOrEqual(8);
  });

  it("les fait toutes de la taille de celle du joueur", () => {
    /*
     * « Les parcelles des PNJ doivent être sous la même forme que nous et
     * collées, de la même taille, juste ils les gèrent indépendamment, et ça
     * sera les parcelles qu'on pourra racheter. » Une parcelle rachetée ne
     * doit rien avoir à changer de forme pour venir se coller à la sienne.
     */
    expect(plan.emprise).toBe(EMPRISE);
    expect(plan.pas).toBe(EMPRISE + LARGEUR_CHEMIN);
    for (const p of plan.parcelles) {
      const e = empriseParcelle(p, plan.emprise);
      expect(e.w).toBe(EMPRISE);
      expect(e.d).toBe(EMPRISE);
    }
  });

  it("les pose sur la trame, sans jamais s’en écarter", () => {
    for (const p of plan.parcelles) {
      expect(p.x).toBeCloseTo(p.col * plan.pas, 9);
      expect(p.z).toBeCloseTo(p.rang * plan.pas, 9);
      expect(Number.isInteger(p.col)).toBe(true);
      expect(Number.isInteger(p.rang)).toBe(true);
    }
  });

  it("les colle : un chemin les sépare, pas un pré", () => {
    // Jointives à la largeur du chemin près — c'est ce qui fait un damier de
    // campagne et non un semis d'îlots.
    const proches = plan.parcelles.filter((p) => Math.abs(p.col) + Math.abs(p.rang) === 1);
    expect(proches.length).toBeGreaterThanOrEqual(2);
    for (const p of proches) {
      const ecart = Math.max(Math.abs(p.x), Math.abs(p.z)) - EMPRISE;
      expect(ecart).toBeCloseTo(LARGEUR_CHEMIN, 9);
    }
  });

  it("n’en pose aucune sur la ferme ni sur la cour", () => {
    const ile = { x: 0, z: 0, w: EMPRISE, d: EMPRISE };
    for (const p of plan.parcelles) {
      expect(seChevauchent(empriseParcelle(p, plan.emprise), ile)).toBe(false);
      expect(seChevauchent(empriseParcelle(p, plan.emprise), OPTIONS.cour)).toBe(false);
    }
  });

  it("ne laisse jamais deux parcelles se marcher dessus", () => {
    for (let i = 0; i < plan.parcelles.length; i++) {
      for (let k = i + 1; k < plan.parcelles.length; k++) {
        expect(
          seChevauchent(
            empriseParcelle(plan.parcelles[i]!, plan.emprise),
            empriseParcelle(plan.parcelles[k]!, plan.emprise),
          ),
        ).toBe(false);
      }
    }
  });

  it("en met de tous les côtés visibles", () => {
    // Une campagne massée d'un seul côté n'entoure rien du tout.
    const cotes = new Set(
      plan.parcelles.map((p) => `${p.col > 0 ? "e" : p.col < 0 ? "o" : "-"}${p.rang > 0 ? "s" : p.rang < 0 ? "n" : "-"}`),
    );
    expect(cotes.size).toBeGreaterThanOrEqual(5);
  });

  it("laisse l’amont au pré : c’est là qu’est le ciel", () => {
    /*
     * Mesuré en jeu, et c'est le compromis du cadrage : un rang de voisins
     * derrière la ferme repousse la lisière — et surtout la cime de ses
     * arbres — hors du haut du cadre. Le reproche revenait aussitôt : « on
     * voit plus le ciel ». En amont il y a donc un pré, puis le bois.
     */
    expect(plan.sol.uMin).toBe(-horizonPour(EMPRISE));
    for (const p of plan.parcelles) {
      expect(versEcranBas(p.x, p.z) - plan.emprise).toBeGreaterThanOrEqual(plan.sol.uMin);
    }
  });

  it("tient chaque parcelle entièrement sur la terre ferme", () => {
    for (const p of plan.parcelles) {
      for (const dx of [-1, 1]) {
        for (const dz of [-1, 1]) {
          const x = p.x + (dx * EMPRISE) / 2;
          const z = p.z + (dz * EMPRISE) / 2;
          expect(surLeSol(plan.sol, x, z)).toBe(true);
        }
      }
    }
  });

  it("n’en pose aucune en travers de la route", () => {
    for (const p of plan.parcelles) {
      expect(Math.abs(p.z - plan.routeZ)).toBeGreaterThanOrEqual(EMPRISE / 2 + DEMI_ROUTE);
    }
  });

  it("donne un bâtiment à certaines et pas à toutes", () => {
    // C'est le bâtiment qui fait la ferme du voisin plutôt qu'un champ nu ;
    // en donner à toutes ferait un lotissement.
    const avec = plan.parcelles.filter((p) => p.batiment).length;
    expect(avec).toBeGreaterThanOrEqual(1);
    expect(avec).toBeLessThan(plan.parcelles.length);
  });

  it("met des voisins au travail, mais pas tout le village", () => {
    const actifs = plan.parcelles.filter((p) => p.travaille);
    expect(actifs.length).toBe(ENGINS_MAX);
    for (const p of actifs) {
      // Un tracteur à quarante unités est un pixel qui tremble, pas un voisin.
      expect(Math.hypot(p.x, p.z)).toBeLessThan(34);
      // Et jamais dans une prairie : on ne laboure pas la jachère.
      expect(p.culture).not.toBe("HERBE");
    }
  });

  it("se resserre en réglage sobre", () => {
    const sobre = planCampagne({ ...OPTIONS, colonnes: 2, rangs: 2 });
    expect(sobre.parcelles.length).toBeLessThan(plan.parcelles.length);
    expect(sobre.parcelles.length).toBeGreaterThanOrEqual(6);
  });
});

describe("le repère de l’écran", () => {
  it("fait descendre `u` et aller `v` à droite", () => {
    // En vue isométrique la caméra regarde depuis (+x, +y, +z) : les deux axes
    // du monde descendent ensemble à l'écran, et leur différence file de côté.
    expect(versEcranBas(1, 1)).toBeGreaterThan(versEcranBas(0, 0));
    expect(versEcranDroite(1, -1)).toBeGreaterThan(versEcranDroite(0, 0));
    expect(versEcranDroite(1, 1)).toBe(0);
  });

  it("borne le sol de trois côtés hors cadre, et d’un seul dedans", () => {
    const plan = planCampagne(OPTIONS);
    // Le zoom le plus large montre une cinquantaine d'unités : les trois
    // autres bords doivent rester bien au-delà.
    expect(plan.sol.uMax).toBeGreaterThan(120);
    expect(plan.sol.vMax).toBeGreaterThan(100);
    expect(-plan.sol.uMin).toBeLessThan(40);
  });

  it("dit ce qui est sur la terre ferme", () => {
    const plan = planCampagne(OPTIONS);
    expect(surLeSol(plan.sol, 0, 0)).toBe(true);
    // Loin en amont : au-delà de la lisière, il n'y a plus rien.
    expect(surLeSol(plan.sol, -40, -40)).toBe(false);
    expect(surLeSol(plan.sol, 200, -200)).toBe(false);
  });
});

describe("la route", () => {
  const plan = planCampagne(OPTIONS);

  it("ne coupe pas le parking", () => {
    /*
     * Le reproche exact, deux fois de suite : « la route coupe le parking ».
     * Elle se calait sur le bord de l'île sans regarder la cour, qui déborde
     * à l'ouest. Elle suit maintenant un couloir de la trame, choisi au sud de
     * la cour — et un couloir de trame est vide par construction.
     */
    const c = OPTIONS.cour;
    for (let t = 0; t <= 1; t += 0.01) {
      const p = plan.route[0]!;
      const q = plan.route[1]!;
      const x = p.x + (q.x - p.x) * t;
      const z = p.z + (q.z - p.z) * t;
      const dedans =
        Math.abs(x - c.x) < c.w / 2 + DEMI_ROUTE && Math.abs(z - c.z) < c.d / 2 + DEMI_ROUTE;
      expect(dedans).toBe(false);
    }
  });

  it("ne traverse jamais l’île du joueur", () => {
    expect(Math.abs(plan.routeZ)).toBeGreaterThan(EMPRISE / 2 + DEMI_ROUTE);
  });

  it("passe au ras de la sortie de la cour, pas un rang plus loin", () => {
    /*
     * Deux dixièmes de marge de sécurité suffisaient à faire sauter le chemin
     * d'un rang entier : il partait alors se perdre dans le coin bas de
     * l'écran, à seize unités de la sortie qu'il dessert. Le couloir laisse
     * exactement la place, et c'est voulu.
     */
    const cour = OPTIONS.cour;
    const jeu = plan.routeZ - DEMI_ROUTE - (cour.z + cour.d / 2);
    expect(jeu).toBeGreaterThan(0);
    expect(jeu).toBeLessThan(LARGEUR_CHEMIN);
  });

  it("choisit son couloir où que soit la cour", () => {
    for (const cour of [
      { x: -11.5, z: 2.5, w: 6, d: 9 },
      { x: 0, z: -9, w: 5, d: 4 },
      { x: 9, z: 0, w: 4, d: 12 },
      { x: -20, z: 20, w: 7, d: 7 },
    ]) {
      const o = { ...OPTIONS, cour };
      const z = couloirRoute(o);
      expect(z - DEMI_ROUTE).toBeGreaterThanOrEqual(cour.z + cour.d / 2);
      // Toujours dans un couloir, jamais sur une parcelle.
      const p = planCampagne(o);
      for (const q of p.parcelles) {
        expect(Math.abs(q.z - z)).toBeGreaterThanOrEqual(EMPRISE / 2 + DEMI_ROUTE);
      }
    }
  });

  it("va d’un bord du sol à l’autre", () => {
    // Un ruban qui s'arrête en plein pré se voit. Ses deux extrémités doivent
    // être hors de l'emprise, donc hors cadre.
    for (const p of plan.route) {
      expect(surLeSol(plan.sol, p.x + Math.sign(p.x) * 0.01, p.z)).toBe(false);
    }
    expect(Math.hypot(plan.route[1]!.x - plan.route[0]!.x, 0)).toBeGreaterThan(100);
  });

  it("est reliée à la cour par une desserte courte et droite", () => {
    /*
     * Sans elle, la ferme donnait sur une départementale qu'elle ne touchait
     * pas — une route qui passe devant chez vous sans que rien n'y mène.
     */
    expect(plan.desserte).toHaveLength(2);
    const [sortie, jonction] = plan.desserte;
    expect(sortie!.x).toBeCloseTo(OPTIONS.cour.x, 9);
    expect(jonction!.x).toBeCloseTo(OPTIONS.cour.x, 9);
    expect(jonction!.z).toBeCloseTo(plan.routeZ, 9);
    expect(Math.abs(jonction!.z - sortie!.z)).toBeLessThan(LARGEUR_CHEMIN + 1);
  });
});

describe("les bosquets", () => {
  const plan = planCampagne(OPTIONS);

  it("terminent le monde : une lisière au bord amont", () => {
    /*
     * La lisière n'est pas décorative — c'est elle qui cache l'arête du sol.
     * Sans elle, le monde s'arrêtait sur une ligne franche en plein cadre.
     */
    const lisiere = plan.arbres.filter((a) => versEcranBas(a.x, a.z) < plan.sol.uMin + 5.2);
    expect(lisiere.length).toBeGreaterThan(30);
    // Et elle est large : elle doit couvrir tout le haut du cadre.
    const v = lisiere.map((a) => versEcranDroite(a.x, a.z));
    expect(Math.max(...v)).toBeGreaterThan(50);
    expect(Math.min(...v)).toBeLessThan(-50);
  });

  it("restent bas à l’horizon, hauts près de la ferme", () => {
    /*
     * Un arbre posé à l'horizon monte à l'écran de presque toute sa hauteur.
     * Une futaie s'y faisait couper net par le haut du cadre, et la bande de
     * ciel disparaissait avec elle.
     */
    const loin = plan.arbres.filter((a) => versEcranBas(a.x, a.z) < plan.sol.uMin + 5.2);
    const pres = plan.arbres.filter((a) => versEcranBas(a.x, a.z) > plan.sol.uMin + 8);
    const moyenne = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(pres.length).toBeGreaterThan(5);
    expect(moyenne(loin.map((a) => a.taille))).toBeLessThan(moyenne(pres.map((a) => a.taille)));
  });

  it("meublent le pré d’amont plutôt que de le laisser nu", () => {
    // Vide, la bande d'herbe entre la dernière haie et le bois se lit comme un
    // trou dans le décor : un grand vert uni juste au-dessus de la ferme.
    const pre = plan.arbres.filter((a) => {
      const u = versEcranBas(a.x, a.z);
      return u > plan.sol.uMin + 5.2 && u < -EMPRISE;
    });
    expect(pre.length).toBeGreaterThan(8);
  });

  it("n’en plante ni sur la route, ni sur la ferme, ni dans un champ", () => {
    for (const a of plan.arbres) {
      expect(Math.abs(a.z - plan.routeZ)).toBeGreaterThan(DEMI_ROUTE);
      expect(seChevauchent({ x: a.x, z: a.z, w: 1, d: 1 }, { x: 0, z: 0, w: EMPRISE, d: EMPRISE })).toBe(false);
      for (const p of plan.parcelles) {
        expect(seChevauchent({ x: a.x, z: a.z, w: 1, d: 1 }, empriseParcelle(p, plan.emprise))).toBe(false);
      }
    }
  });

  it("les garde tous sur la terre ferme", () => {
    for (const a of plan.arbres) expect(surLeSol(plan.sol, a.x, a.z)).toBe(true);
  });
});

describe("le cycle du voisin", () => {
  const champ = { culture: "BLE" as const, decalage: 0 };

  it("passe par les cinq états en un cycle", () => {
    const vus = new Set(
      Array.from({ length: CYCLE_VOISIN }, (_, j) => etatChamp(champ, j, "SUMMER")),
    );
    expect(vus).toEqual(new Set(["LABOUR", "SEMIS", "POUSSE", "MUR", "CHAUME"]));
  });

  it("se répète d’un cycle à l’autre", () => {
    for (let j = 0; j < CYCLE_VOISIN; j++) {
      expect(etatChamp(champ, j, "SUMMER")).toBe(etatChamp(champ, j + CYCLE_VOISIN, "SUMMER"));
    }
  });

  it("tient les jours négatifs", () => {
    // Le jour de jeu descend d'une horloge : rien ne garantit qu'il soit
    // positif dans un test, ni au premier chargement d'une horloge décalée.
    for (let j = -40; j < 0; j++) expect(ETATS).toContain(etatChamp(champ, j, "SUMMER"));
  });

  it("ne mûrit rien en hiver, chez le voisin comme chez nous", () => {
    for (let j = 0; j < CYCLE_VOISIN * 3; j++) {
      expect(["LABOUR", "CHAUME"]).toContain(etatChamp({ ...champ, decalage: j % 7 }, j, "WINTER"));
    }
  });

  it("décale les voisins les uns par rapport aux autres", () => {
    const etats = new Set(
      Array.from({ length: 8 }, (_, i) => etatChamp({ ...champ, decalage: i * 3 }, 0, "SUMMER")),
    );
    expect(etats.size).toBeGreaterThan(2);
  });

  it("laisse la prairie en herbe toute l’année", () => {
    for (const s of SAISONS) {
      for (let j = 0; j < CYCLE_VOISIN; j++) {
        expect(etatChamp({ culture: "HERBE", decalage: 0 }, j, s)).toBe("JACHERE");
      }
    }
  });
});

describe("les couleurs", () => {
  it("donne une teinte à chaque état de chaque culture", () => {
    for (const c of ["BLE", "ORGE", "COLZA", "MAIS", "TOURNESOL", "HERBE"] as const) {
      for (const e of ETATS) {
        const t = couleurChamp(c, e as never);
        expect(Number.isInteger(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it("distingue la terre retournée du chaume et de la pousse", () => {
    expect(couleurChamp("BLE", "LABOUR")).not.toBe(couleurChamp("BLE", "CHAUME"));
    expect(couleurChamp("BLE", "POUSSE")).not.toBe(couleurChamp("BLE", "MUR"));
  });

  it("laisse la terre dominer un semis", () => {
    // Un champ tout juste semé est brun, pas vert : on voit les rangs.
    const vert = (c: number) => (c >> 8) & 0xff;
    expect(vert(couleurChamp("BLE", "SEMIS"))).toBeGreaterThan(vert(couleurChamp("BLE", "LABOUR")));
    expect(vert(couleurChamp("BLE", "SEMIS"))).toBeLessThan(vert(couleurChamp("BLE", "POUSSE")));
  });

  it("mélange sans déborder de l’octet", () => {
    expect(melanger(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(melanger(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(melanger(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    // Hors bornes : on borne plutôt que de produire une couleur impossible.
    expect(melanger(0x102030, 0x405060, -3)).toBe(0x102030);
    expect(melanger(0x102030, 0x405060, 9)).toBe(0x405060);
  });
});

describe("la commune, quand la carte a répondu", () => {
  /*
   * Le cœur du changement. Les voisins étaient tirés d'une graine : des
   * cultures inventées sur des parcelles sans identifiant, qu'on ne pouvait ni
   * regarder vraiment ni acheter. Ils viennent maintenant du cadastre.
   */
  function voisin(col: number, rang: number, p: Partial<VoisinReel> = {}): VoisinReel {
    return {
      id: `p-${col}-${rang}`,
      label: `Champ ${col}·${rang}`,
      col,
      rang,
      statut: "PNJ",
      proprietaire: "Ferme Duval",
      exploitation: "Duval",
      culture: "WHEAT",
      stade: "GROWING",
      partCultivee: 1,
      fertility: 0.7,
      batiments: [],
      cheptel: [],
      prix: null,
      achetable: false,
      refus: null,
      ...p,
    };
  }

  const commune: VoisinReel[] = [
    voisin(0, 0, { statut: "MOI", culture: null, stade: null, partCultivee: 0 }),
    voisin(1, 0, { culture: "BARLEY", stade: "READY" }),
    voisin(0, 1, { statut: "LIBRE", culture: null, stade: null, partCultivee: 0, prix: 40_000, achetable: true }),
    voisin(1, 1, { culture: "MAIZE", stade: "PLANTED", batiments: [{ type: "SILO", level: 1, x: 2, y: 2, rotation: 0 }] }),
    voisin(-1, 1, { culture: "RAPE", stade: "HARVESTED" }),
  ];

  it("pose exactement les parcelles du cadastre, et pas d’autres", () => {
    const plan = planCampagne({ ...OPTIONS, voisins: commune });
    const posees = new Set(plan.parcelles.map((p) => p.id));
    // La sienne n'est pas un voisin : elle est déjà dessinée.
    expect(posees.has("p-0-0")).toBe(false);
    for (const v of commune.filter((v) => v.col !== 0 || v.rang !== 0)) {
      expect(posees.has(v.id)).toBe(true);
    }
    expect(plan.parcelles.length).toBe(commune.length - 1);
  });

  it("garde l’identifiant : c’est lui qui permettra de l’acheter", () => {
    const plan = planCampagne({ ...OPTIONS, voisins: commune });
    for (const p of plan.parcelles) {
      expect(p.reel).toBeDefined();
      expect(p.id).toBe(p.reel!.id);
      expect(p.reel!.prix === null || p.reel!.prix > 0).toBe(true);
    }
  });

  it("les pose sur la trame, à leur case", () => {
    const plan = planCampagne({ ...OPTIONS, voisins: commune });
    for (const p of plan.parcelles) {
      expect(p.x).toBeCloseTo(p.col * plan.pas, 9);
      expect(p.z).toBeCloseTo(p.rang * plan.pas, 9);
    }
  });

  it("peint ce que le voisin cultive, et non un tirage", () => {
    const plan = planCampagne({ ...OPTIONS, voisins: commune });
    const parId = new Map(plan.parcelles.map((p) => [p.id, p]));
    expect(parId.get("p-1-0")!.culture).toBe("ORGE");
    expect(parId.get("p-1-0")!.etat).toBe("MUR");
    expect(parId.get("p-1-1")!.culture).toBe("MAIS");
    expect(parId.get("p-1-1")!.etat).toBe("SEMIS");
    expect(parId.get("p--1-1")!.etat).toBe("CHAUME");
  });

  it("n’invente pas de grange là où il n’y a pas de bâtiment", () => {
    // Le décor en posait une sur trois parcelles au hasard. Ici la grange dit
    // quelque chose de vrai : il y a un ouvrage sur cette parcelle-là.
    const plan = planCampagne({ ...OPTIONS, voisins: commune });
    const parId = new Map(plan.parcelles.map((p) => [p.id, p]));
    expect(parId.get("p-1-1")!.batiment).toBe(true);
    expect(parId.get("p-1-0")!.batiment).toBe(false);
  });

  it("ne fait travailler ni ma terre ni celle d’un autre joueur", () => {
    /*
     * Un tracteur PNJ sur la parcelle du joueur laisserait croire que
     * quelqu'un d'autre y travaille ; sur celle d'un autre joueur, il
     * raconterait une activité qui n'a pas lieu.
     */
    const mixte = [
      ...commune,
      voisin(2, 0, { statut: "JOUEUR", proprietaire: "Camille" }),
      voisin(0, 2, { statut: "MOI" }),
    ];
    const plan = planCampagne({ ...OPTIONS, voisins: mixte });
    for (const p of plan.parcelles.filter((x) => x.travaille)) {
      expect(["PNJ", "LIBRE"]).toContain(p.reel!.statut);
    }
  });

  it("s’arrête où la commune s’arrête", () => {
    /*
     * Une zone fait quatre à six parcelles de large : le damier de décor, qui
     * en posait sept sur sept, débordait largement. Au-delà de la frontière il
     * n'y a pas de parcelle, et c'est ce qui donne au pays un bord crédible.
     */
    const petite = planCampagne({ ...OPTIONS, voisins: [voisin(1, 0), voisin(0, 1)] });
    expect(petite.parcelles.length).toBe(2);
    const decor = planCampagne(OPTIONS);
    expect(decor.parcelles.length).toBeGreaterThan(petite.parcelles.length);
  });

  it("retombe sur le décor tant que la carte n’a rien dit", () => {
    // La vue doit se monter sans réseau : une liste vide n'est pas une commune
    // vide, c'est une commune qu'on ne connaît pas encore.
    expect(planCampagne({ ...OPTIONS, voisins: [] }).parcelles.length).toBe(0);
    expect(planCampagne(OPTIONS).parcelles.length).toBeGreaterThan(6);
  });

  it("ne pose rien par-dessus la cour ni en travers du chemin", () => {
    // Les règles géométriques valent aussi pour les parcelles réelles : une
    // case du cadastre tombée sur la cour se dessinerait à travers le parking.
    const partout: VoisinReel[] = [];
    for (let col = -3; col <= 3; col++) {
      for (let rang = -3; rang <= 3; rang++) partout.push(voisin(col, rang));
    }
    const plan = planCampagne({ ...OPTIONS, voisins: partout });
    for (const p of plan.parcelles) {
      expect(seChevauchent(empriseParcelle(p, plan.emprise), OPTIONS.cour)).toBe(false);
      expect(Math.abs(p.z - plan.routeZ)).toBeGreaterThanOrEqual(EMPRISE / 2 + DEMI_ROUTE);
      expect(versEcranBas(p.x, p.z) - plan.emprise).toBeGreaterThanOrEqual(plan.sol.uMin);
    }
  });
});

describe("l’orientation de la commune", () => {
  /*
   * En isométrique, tout ce qui est en amont de la ferme sort par le haut du
   * cadre : seul le quartier aval se dessine. Or la ferme du joueur n'est pas
   * au milieu de sa commune — elle peut être dans n'importe quel coin.
   *
   * Mesuré en jeu avant ce correctif : seize parcelles autour de la ferme,
   * deux dessinées, parce qu'elles s'étendaient toutes en amont.
   */
  function communeVers(dx: number, dz: number, n = 4) {
    const cases: { col: number; rang: number }[] = [{ col: 0, rang: 0 }];
    for (let k = 1; k <= n; k++) cases.push({ col: dx * k, rang: dz * k });
    return cases;
  }

  it("tourne la carte pour amener les voisins dans le cadre", () => {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [-1, -1]] as const) {
      const cases = communeVers(dx, dz);
      const quart = orientationTrame(cases);
      const avals = cases
        .map((c) => tourner(c, quart))
        .filter((c) => (c.col !== 0 || c.rang !== 0) && c.col + c.rang >= 0);
      expect(avals.length).toBe(cases.length - 1);
    }
  });

  it("choisit toujours le même quart pour la même commune", () => {
    // Le pays ne doit pas pivoter sous les pieds du joueur d'un
    // rafraîchissement à l'autre.
    const cases = communeVers(-1, -1);
    expect(orientationTrame(cases)).toBe(orientationTrame([...cases].reverse()));
  });

  it("tourne, et ne retourne jamais", () => {
    /*
     * Une symétrie amènerait autant de parcelles dans le cadre, et ferait du
     * paysage le miroir du plan du Bureau : la parcelle qu'on croit acheter à
     * droite arriverait à gauche.
     *
     * Une rotation conserve l'orientation, donc le produit vectoriel de deux
     * vecteurs de la trame. C'est ce qu'on vérifie.
     */
    for (const quart of [0, 1, 2, 3] as const) {
      const a = tourner({ col: 1, rang: 0 }, quart);
      const b = tourner({ col: 0, rang: 1 }, quart);
      expect(a.col * b.rang - a.rang * b.col).toBe(1);
    }
  });

  it("conserve la mitoyenneté", () => {
    // Deux parcelles voisines sur la carte doivent le rester dans le paysage,
    // sans quoi le damier se disloquerait.
    for (const quart of [0, 1, 2, 3] as const) {
      const a = tourner({ col: 2, rang: 3 }, quart);
      const b = tourner({ col: 3, rang: 3 }, quart);
      expect(Math.abs(a.col - b.col) + Math.abs(a.rang - b.rang)).toBe(1);
    }
  });

  it("place la ferme au centre, quel que soit le quart", () => {
    for (const quart of [0, 1, 2, 3] as const) {
      expect(tourner({ col: 0, rang: 0 }, quart)).toEqual({ col: 0, rang: 0 });
    }
  });
});

describe("de la carte au décor", () => {
  it("traduit chaque culture du jeu", () => {
    expect(cultureDe("WHEAT")).toBe("BLE");
    expect(cultureDe("BARLEY")).toBe("ORGE");
    expect(cultureDe("RAPE")).toBe("COLZA");
    expect(cultureDe("MAIZE")).toBe("MAIS");
    expect(cultureDe("PEA")).toBe("POIS");
    expect(cultureDe("GRASS")).toBe("HERBE");
  });

  it("met une culture inconnue en herbe plutôt que de perdre le champ", () => {
    // Une culture ajoutée au jeu ne doit pas faire disparaître une parcelle du
    // paysage en attendant qu'on lui trouve une teinte.
    expect(cultureDe("QUINOA")).toBe("HERBE");
    expect(cultureDe(null)).toBe("HERBE");
    expect(cultureDe(undefined)).toBe("HERBE");
  });

  it("traduit chaque stade en ce qu’on en voit", () => {
    expect(etatDepuisStade("PREPARED", 1)).toBe("LABOUR");
    expect(etatDepuisStade("PLANTED", 1)).toBe("SEMIS");
    expect(etatDepuisStade("GROWING", 1)).toBe("POUSSE");
    expect(etatDepuisStade("READY", 1)).toBe("MUR");
    expect(etatDepuisStade("HARVESTED", 1)).toBe("CHAUME");
    // Gâtée sur pied : même chaume. Ce qui l'en distingue est une affaire de
    // comptabilité, pas de couleur.
    expect(etatDepuisStade("SPOILED", 1)).toBe("CHAUME");
  });

  it("laisse en herbe ce qui n’est pas semé", () => {
    expect(etatDepuisStade("GROWING", 0)).toBe("JACHERE");
    expect(etatDepuisStade(null, 0)).toBe("JACHERE");
    expect(etatDepuisStade("EMPTY", 1)).toBe("JACHERE");
  });

  it("donne une teinte à chaque culture, pois compris", () => {
    for (const c of ["BLE", "ORGE", "COLZA", "MAIS", "POIS", "TOURNESOL", "HERBE"] as const) {
      for (const e of ETATS) {
        const t = couleurChamp(c, e as never);
        expect(Number.isInteger(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(0xffffff);
      }
    }
  });
});

describe("viser un champ de voisin", () => {
  /*
   * C'est ce qui rend l'achat possible dans le paysage plutôt que dans un plan
   * du Bureau : on clique sur le champ, on lit sa fiche, on l'achète. Les
   * trente champs tiennent dans un seul maillage, donc la case se déduit du
   * point touché — et c'est là qu'un arrondi de travers coûterait cher.
   */
  const plan = planCampagne(OPTIONS);

  it("trouve la parcelle dont on a touché le centre", () => {
    for (const p of plan.parcelles) {
      expect(parcelleSous(plan, p.x, p.z)?.id).toBe(p.id);
    }
  });

  it("la trouve encore près de ses bords", () => {
    for (const p of plan.parcelles) {
      const d = plan.emprise / 2 - 0.05;
      for (const [dx, dz] of [[-d, -d], [d, -d], [d, d], [-d, d]] as const) {
        expect(parcelleSous(plan, p.x + dx, p.z + dz)?.id).toBe(p.id);
      }
    }
  });

  it("ne rend rien pour un clic dans le chemin", () => {
    /*
     * Le `round` seul suffirait à trouver la case, mais l'herbe entre deux
     * champs appartient à la case la plus proche : sans vérifier qu'on est
     * bien **dans** la parcelle, un clic sur le chemin ouvrirait la fiche du
     * champ d'à côté.
     */
    const p = plan.parcelles[0]!;
    const juste = plan.emprise / 2 + LARGEUR_CHEMIN / 2;
    expect(parcelleSous(plan, p.x + juste, p.z)).toBeNull();
    expect(parcelleSous(plan, p.x, p.z + juste)).toBeNull();
  });

  it("ne rend rien sur la ferme du joueur ni au loin", () => {
    expect(parcelleSous(plan, 0, 0)).toBeNull();
    expect(parcelleSous(plan, 900, -900)).toBeNull();
  });
});
