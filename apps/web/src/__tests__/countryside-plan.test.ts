import type { Season } from "@farmsim/shared";
import {
  CYCLE_VOISIN,
  DEMI_ROUTE,
  LARGEUR_PLAGE,
  RAYON_TERRE,
  SECTEUR_COUR,
  azimutCour,
  couleurChamp,
  creux,
  distanceALaRoute,
  ecartAngle,
  empriseParcelle,
  etatChamp,
  grainerDe,
  melanger,
  planCampagne,
  seChevauchent,
  suite,
  tracerDesserte,
  tracerRoute,
  type OptionsPlan,
  type ParcelleVoisine,
} from "../countryside-plan";

/**
 * La campagne autour de la ferme, mesurée.
 *
 * La parcelle du joueur flottait dans le ciel : une dalle de terre, quatre
 * arbres, et le vide. Ce qui l'entoure maintenant est calculé — donc
 * vérifiable. Une parcelle posée sur la cour, une route qui coupe le parking
 * ou un décor qui change à chaque rechargement se voient ici, pas à l'écran.
 */

const OPTIONS: OptionsPlan = {
  graine: "clos-d-orme",
  ileDemiLargeur: 7,
  ileDemiProfondeur: 7,
  portail: { x: -10.5, z: 3 },
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

  it("tire des nombres bien répartis entre zéro et un", () => {
    const r = suite(grainerDe("essai"));
    const tirages = Array.from({ length: 400 }, r);
    expect(Math.min(...tirages)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...tirages)).toBeLessThan(1);
    const moyenne = tirages.reduce((s, x) => s + x, 0) / tirages.length;
    expect(Math.abs(moyenne - 0.5)).toBeLessThan(0.06);
  });
});

describe("le placement des voisins", () => {
  const plan = planCampagne(OPTIONS);

  it("pose assez de parcelles pour peupler la couronne", () => {
    expect(plan.parcelles.length).toBeGreaterThanOrEqual(8);
  });

  it("n’en pose aucune sur la ferme ni sur la cour", () => {
    const ile = { x: 0, z: 0, w: OPTIONS.ileDemiLargeur * 2, d: OPTIONS.ileDemiProfondeur * 2 };
    for (const p of plan.parcelles) {
      expect(seChevauchent(empriseParcelle(p), ile)).toBe(false);
      expect(seChevauchent(empriseParcelle(p), OPTIONS.cour)).toBe(false);
    }
  });

  it("laisse le devant de la cour dégagé", () => {
    /*
     * « Il en faut tout autour sauf côté parking. » Une parcelle plantée
     * derrière la cour se retrouverait à moitié cachée par elle, et l'entrée
     * de la ferme perdrait son dégagement.
     */
    const vers = azimutCour(OPTIONS);
    for (const p of plan.parcelles) {
      const angle = Math.atan2(p.z, p.x);
      expect(Math.abs(ecartAngle(angle, vers))).toBeGreaterThanOrEqual(SECTEUR_COUR);
    }
  });

  it("en met tout de même de tous les autres côtés", () => {
    // Le reproche inverse serait aussi vrai : une campagne massée d'un seul
    // côté n'entoure rien du tout.
    const quadrants = new Set(
      plan.parcelles.map((p) => `${p.x > 0 ? "e" : "o"}${p.z > 0 ? "s" : "n"}`),
    );
    expect(quadrants.size).toBeGreaterThanOrEqual(3);
  });

  it("n’en pose aucune en travers de la route ni de la desserte", () => {
    for (const p of plan.parcelles) {
      const e = empriseParcelle(p);
      const marge = Math.max(e.w, e.d) / 2;
      expect(distanceALaRoute(p.x, p.z, plan.route)).toBeGreaterThan(marge);
      expect(distanceALaRoute(p.x, p.z, plan.desserte)).toBeGreaterThan(marge);
    }
  });

  it("ne laisse jamais deux parcelles se marcher dessus", () => {
    for (let i = 0; i < plan.parcelles.length; i++) {
      for (let k = i + 1; k < plan.parcelles.length; k++) {
        expect(
          seChevauchent(empriseParcelle(plan.parcelles[i]!), empriseParcelle(plan.parcelles[k]!)),
        ).toBe(false);
      }
    }
  });

  it("garde tout le monde sur la terre ferme", () => {
    // Une parcelle qui pend au-dessus de la mer, ou un arbre les pieds dans
    // l'eau, se verraient au premier coup d'œil.
    for (const p of plan.parcelles) {
      const e = empriseParcelle(p);
      expect(Math.hypot(p.x, p.z) + Math.max(e.w, e.d) / 2).toBeLessThan(
        plan.rayonTerre - LARGEUR_PLAGE,
      );
    }
    for (const a of plan.arbres) {
      expect(Math.hypot(a.x, a.z)).toBeLessThan(plan.rayonTerre - LARGEUR_PLAGE);
    }
  });

  it("varie les tailles plutôt que de répéter un carré", () => {
    const aires = plan.parcelles.map((p) => p.gw * p.gh);
    expect(Math.max(...aires) / Math.min(...aires)).toBeGreaterThan(1.5);
    expect(new Set(plan.parcelles.map((p) => p.cap)).size).toBe(2);
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
    expect(actifs.length).toBeGreaterThanOrEqual(2);
    expect(actifs.length).toBeLessThanOrEqual(3);
    for (const p of actifs) {
      // Un tracteur à quarante unités est un pixel qui tremble, pas un voisin.
      expect(Math.hypot(p.x, p.z)).toBeLessThan(34);
      // Et être proche ne suffit pas : derrière la ferme, la moitié de ce qui
      // est proche tombe hors cadre, ou sous le rail de gauche.
      expect(p.x + p.z).toBeGreaterThan(0);
    }
  });
});

describe("la route", () => {
  const plan = planCampagne(OPTIONS);

  it("ne coupe pas le parking", () => {
    /*
     * Le reproche exact : « la route coupe le parking, c'est pas beau ». Elle
     * se calait sur le bord de l'île, sans regarder la cour, et la traversait
     * de part en part. Le couloir se règle maintenant sur le bord extérieur de
     * la cour, plus la demi-chaussée.
     */
    const c = OPTIONS.cour;
    for (let i = 0; i + 1 < plan.route.length; i++) {
      for (let t = 0; t <= 1; t += 0.02) {
        const p = plan.route[i]!;
        const q = plan.route[i + 1]!;
        const x = p.x + (q.x - p.x) * t;
        const z = p.z + (q.z - p.z) * t;
        const dedans =
          Math.abs(x - c.x) < c.w / 2 + DEMI_ROUTE && Math.abs(z - c.z) < c.d / 2 + DEMI_ROUTE;
        expect(dedans).toBe(false);
      }
    }
  });

  it("ne traverse jamais l’île du joueur", () => {
    for (let i = 0; i + 1 < plan.route.length; i++) {
      for (let t = 0; t <= 1; t += 0.02) {
        const p = plan.route[i]!;
        const q = plan.route[i + 1]!;
        const x = p.x + (q.x - p.x) * t;
        const z = p.z + (q.z - p.z) * t;
        const dedans =
          Math.abs(x) < OPTIONS.ileDemiLargeur + DEMI_ROUTE &&
          Math.abs(z) < OPTIONS.ileDemiProfondeur + DEMI_ROUTE;
        expect(dedans).toBe(false);
      }
    }
  });

  it("descend vers le monde plutôt que de filer de biais", () => {
    // Les deux axes croissent ensemble : c'est ce qui fait « descendre » à
    // l'écran. Un seul axe et la route sortirait par le côté.
    const debut = plan.route[0]!;
    const fin = plan.route[plan.route.length - 1]!;
    expect(fin.x).toBeGreaterThan(debut.x);
    expect(fin.z).toBeGreaterThan(debut.z);
  });

  it("va d’un bord de l’île à l’autre, jusqu’à la côte", () => {
    const loin = Math.max(...plan.route.map((p) => Math.hypot(p.x, p.z)));
    expect(loin).toBeGreaterThan(plan.rayonTerre * 0.7);
  });

  it("est reliée à la cour par une desserte", () => {
    /*
     * Sans elle, la ferme donnait sur une départementale qu'elle ne touchait
     * pas — une route qui passe devant chez vous sans que rien n'y mène.
     */
    expect(plan.desserte.length).toBe(2);
    const [portail, jonction] = plan.desserte;
    expect(Math.abs(portail!.x - (OPTIONS.cour.x - OPTIONS.cour.w / 2))).toBeLessThan(0.01);
    expect(distanceALaRoute(jonction!.x, jonction!.z, plan.route)).toBeLessThan(0.01);
    // Courte : c'est une amorce, pas une seconde route.
    expect(Math.hypot(portail!.x - jonction!.x, portail!.z - jonction!.z)).toBeLessThan(8);
  });

  it("existe même quand le portail est ailleurs", () => {
    for (const portail of [{ x: 8, z: -4 }, { x: 0, z: 9 }, { x: -12, z: 0 }]) {
      const o = { ...OPTIONS, portail };
      const r = tracerRoute(o);
      expect(r.length).toBeGreaterThanOrEqual(4);
      expect(tracerDesserte(o, r).length).toBe(2);
    }
  });
});

describe("le monde bombé", () => {
  it("s’enfonce à mesure qu’on s’éloigne", () => {
    // C'est cette courbure qui rend un horizon, donc du ciel au-dessus. À
    // plat, le sol remplit l'écran et le ciel disparaît — le reproche.
    // `toBeCloseTo` et non `toBe` : `-0.0085 * 0 * 0` vaut moins zéro, que
    // `Object.is` distingue de zéro.
    expect(creux(0)).toBeCloseTo(0, 10);
    expect(creux(10)).toBeLessThan(creux(0));
    expect(creux(RAYON_TERRE)).toBeLessThan(creux(10));
  });

  it("reste imperceptible sous la ferme", () => {
    // Une ferme posée sur un dôme visible aurait l'air de glisser. À dix
    // unités du centre, le creux doit rester sous le décimètre de jeu.
    expect(Math.abs(creux(10))).toBeLessThan(1);
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

describe("l’emprise d’une parcelle", () => {
  it("tourne avec le damier", () => {
    const base: ParcelleVoisine = {
      id: "t", x: 0, z: 0, gw: 8, gh: 4, cap: 0,
      culture: "BLE", decalage: 0, travaille: false, batiment: false,
    };
    const droite = empriseParcelle(base);
    const tournee = empriseParcelle({ ...base, cap: Math.PI / 2 });
    expect(droite.w).toBeGreaterThan(droite.d);
    expect(tournee.d).toBeGreaterThan(tournee.w);
    expect(droite.w).toBeCloseTo(tournee.d, 6);
  });
});
