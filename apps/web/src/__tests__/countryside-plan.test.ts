import type { Season } from "@farmsim/shared";
import {
  CYCLE_VOISIN,
  couleurChamp,
  distanceALaRoute,
  etatChamp,
  grainerDe,
  melanger,
  planCampagne,
  seChevauchent,
  suite,
  tracerRoute,
  type ChampVoisin,
  type OptionsPlan,
} from "../countryside-plan";

/**
 * La campagne autour de la ferme, mesurée.
 *
 * La parcelle du joueur flottait dans le ciel : une dalle de terre, quatre
 * arbres, et le vide. Ce qui l'entoure maintenant est calculé — donc
 * vérifiable. Un champ posé sur la cour, une route qui traverse le blé ou un
 * décor qui change à chaque rechargement se voient ici, pas à l'écran.
 */

const OPTIONS: OptionsPlan = {
  graine: "clos-d-orme",
  ileDemiLargeur: 7,
  ileDemiProfondeur: 7,
  portail: { x: -8.5, z: 3 },
  cour: { x: -11, z: 2, w: 7, d: 9 },
};

const SAISONS: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

describe("la graine", () => {
  it("rend deux fois la même campagne", () => {
    // Un décor qui change à chaque visite ne serait pas un lieu.
    expect(JSON.stringify(planCampagne(OPTIONS))).toBe(JSON.stringify(planCampagne(OPTIONS)));
  });

  it("rend deux campagnes différentes à deux fermes différentes", () => {
    const a = planCampagne(OPTIONS);
    const b = planCampagne({ ...OPTIONS, graine: "terre-d-orme" });
    expect(JSON.stringify(a.champs)).not.toBe(JSON.stringify(b.champs));
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

describe("le placement", () => {
  const plan = planCampagne(OPTIONS);

  it("pose assez de champs pour peupler l’horizon", () => {
    expect(plan.champs.length).toBeGreaterThanOrEqual(10);
  });

  it("n’en pose aucun sur la ferme ni sur la cour", () => {
    const ile = { x: 0, z: 0, w: OPTIONS.ileDemiLargeur * 2, d: OPTIONS.ileDemiProfondeur * 2 };
    for (const c of plan.champs) {
      expect(seChevauchent(c, ile)).toBe(false);
      expect(seChevauchent(c, OPTIONS.cour)).toBe(false);
    }
  });

  it("n’en pose aucun en travers de la route", () => {
    for (const c of plan.champs) {
      expect(distanceALaRoute(c.x, c.z, plan.route)).toBeGreaterThan(Math.max(c.w, c.d) / 2);
    }
  });

  it("ne laisse jamais deux champs se marcher dessus", () => {
    for (let i = 0; i < plan.champs.length; i++) {
      for (let k = i + 1; k < plan.champs.length; k++) {
        expect(seChevauchent(plan.champs[i]!, plan.champs[k]!)).toBe(false);
      }
    }
  });

  it("garde tout le monde dans l’étendue du sol", () => {
    for (const c of plan.champs) {
      expect(Math.abs(c.x) + c.w / 2).toBeLessThan(plan.etendue);
      expect(Math.abs(c.z) + c.d / 2).toBeLessThan(plan.etendue);
    }
    for (const a of plan.arbres) expect(Math.hypot(a.x, a.z)).toBeLessThan(plan.etendue);
  });

  it("varie les formes plutôt que de répéter un carré", () => {
    const aires = plan.champs.map((c) => c.w * c.d);
    expect(Math.max(...aires) / Math.min(...aires)).toBeGreaterThan(1.6);
    const orientations = new Set(plan.champs.map((c) => c.sillons));
    expect(orientations.size).toBe(2);
  });

  it("penche vers le bas de l’écran, là où il y a de la place à l’image", () => {
    // En vue isométrique, « vers le bas » veut dire x + z croissants : la
    // caméra regarde l'origine depuis (+x, +y, +z).
    const bas = plan.champs.filter((c) => c.x + c.z > 0).length;
    expect(bas).toBeGreaterThan(plan.champs.length / 2);
  });

  it("met des voisins au travail, mais pas tout le village", () => {
    const actifs = plan.champs.filter((c) => c.travaille);
    expect(actifs.length).toBeGreaterThanOrEqual(1);
    expect(actifs.length).toBeLessThanOrEqual(2);
    for (const c of actifs) {
      // Un tracteur à quarante unités est un pixel qui tremble, pas un voisin.
      expect(Math.hypot(c.x, c.z)).toBeLessThan(34);
      // Et être proche ne suffit pas : derrière la ferme, la moitié de ce qui
      // est proche tombe hors cadre, ou sous le rail de gauche.
      expect(c.x + c.z).toBeGreaterThan(0);
    }
  });
});

describe("la route", () => {
  const plan = planCampagne(OPTIONS);

  it("part de la cour et sort du cadre", () => {
    const route = plan.route;
    const pres = Math.min(...route.map((p) => Math.hypot(p.x - OPTIONS.portail.x, p.z - OPTIONS.portail.z)));
    expect(pres).toBeLessThan(6);
    const loin = Math.max(...route.map((p) => Math.hypot(p.x, p.z)));
    expect(loin).toBeGreaterThan(plan.etendue);
  });

  it("descend vers le monde plutôt que de filer de biais", () => {
    const route = plan.route;
    const debut = route[0]!;
    const fin = route[route.length - 1]!;
    // Les deux axes croissent ensemble : c'est ce qui fait « descendre » à
    // l'écran. Un seul axe et la route sortirait par le côté.
    expect(fin.x).toBeGreaterThan(debut.x);
    expect(fin.z).toBeGreaterThan(debut.z);
  });

  it("ne traverse jamais l’île du joueur", () => {
    for (let i = 0; i + 1 < plan.route.length; i++) {
      for (let t = 0; t <= 1; t += 0.05) {
        const p = plan.route[i]!;
        const q = plan.route[i + 1]!;
        const x = p.x + (q.x - p.x) * t;
        const z = p.z + (q.z - p.z) * t;
        const dedans =
          Math.abs(x) < OPTIONS.ileDemiLargeur && Math.abs(z) < OPTIONS.ileDemiProfondeur;
        expect(dedans).toBe(false);
      }
    }
  });

  it("existe même quand le portail est ailleurs", () => {
    for (const portail of [{ x: 8, z: -4 }, { x: 0, z: 9 }, { x: -12, z: 0 }]) {
      const r = tracerRoute({ ...OPTIONS, portail });
      expect(r.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("le cycle du voisin", () => {
  const champ: ChampVoisin = {
    id: "t", x: 20, z: 20, w: 8, d: 7, sillons: 0,
    culture: "BLE", decalage: 0, travaille: false,
  };

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
    for (let j = -40; j < 0; j++) {
      expect(ORDRE_VALIDE).toContain(etatChamp(champ, j, "SUMMER"));
    }
  });

  it("ne mûrit rien en hiver, chez le voisin comme chez nous", () => {
    // Un champ d'or à côté d'une parcelle gelée dirait que les saisons ne
    // s'appliquent qu'au joueur.
    for (let j = 0; j < CYCLE_VOISIN * 3; j++) {
      const e = etatChamp({ ...champ, decalage: j % 7 }, j, "WINTER");
      expect(["LABOUR", "CHAUME"]).toContain(e);
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
        expect(etatChamp({ ...champ, culture: "HERBE" }, j, s)).toBe("JACHERE");
      }
    }
  });
});

const ORDRE_VALIDE = ["LABOUR", "SEMIS", "POUSSE", "MUR", "CHAUME", "JACHERE"];

describe("les couleurs", () => {
  it("donne une teinte à chaque état de chaque culture", () => {
    for (const c of ["BLE", "ORGE", "COLZA", "MAIS", "TOURNESOL", "HERBE"] as const) {
      for (const e of ORDRE_VALIDE) {
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
    const semis = couleurChamp("BLE", "SEMIS");
    const labour = couleurChamp("BLE", "LABOUR");
    const pousse = couleurChamp("BLE", "POUSSE");
    const vert = (c: number) => (c >> 8) & 0xff;
    expect(vert(semis)).toBeGreaterThan(vert(labour));
    expect(vert(semis)).toBeLessThan(vert(pousse));
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
