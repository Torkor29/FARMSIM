import type { VoisinReel } from "../countryside-plan";
import { COTE_DECOR, coteLieu, ECART_COUR, planCampagne, type OptionsPlan } from "../countryside-plan";
import { placerHabillage } from "../buildings3d";
import { ECART_VERGER } from "../village3d";
import {
  arbresDeCoin,
  chevauchent,
  conflits,
  decrire,
  empreinteArbre,
  marge,
  Occupation,
  type Occupant,
} from "../placement";

/**
 * Les erreurs de placement, codées.
 *
 * « L'arbre qui rentre dans le bitume », « des buissons qui se rentrent
 * dedans » : ce sont des fautes qu'une image fixe montre mal et qu'aucun test
 * ne voyait. Chaque décor déclare maintenant sa place au sol ; ce fichier
 * exige qu'il n'y ait **aucun** chevauchement interdit, sur plusieurs
 * campagnes, avec et sans village.
 */

const EMPRISE = 12 * 1.06 + 1.4;
const COUR = { x: -11.5, z: 2.5, w: 6, d: 9 };
const BASE: OptionsPlan = { graine: "clos-d-orme", emprise: EMPRISE, cour: COUR };

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
  } as VoisinReel;
}

const COMMUNE: VoisinReel[] = [
  voisin(0, 0, { statut: "MOI", culture: null, stade: null, partCultivee: 0 }),
  voisin(1, 0, { culture: "BARLEY", stade: "READY" }),
  voisin(0, 1, { statut: "LIBRE", culture: null, stade: null, partCultivee: 0, achetable: true }),
  voisin(1, 1, { culture: "MAIZE", stade: "PLANTED" }),
  voisin(-1, 1, { culture: "RAPE", stade: "HARVESTED" }),
  voisin(-1, 0, { culture: "WHEAT", stade: "GROWING" }),
];

const CAMPAGNES: [string, OptionsPlan][] = [
  ["sans village", BASE],
  ["autre graine", { ...BASE, graine: "terre-d-orme" }],
  ["avec le village", { ...BASE, voisins: COMMUNE, maison: "p-0-0", quart: 0 }],
  ["village, autre graine", { ...BASE, graine: "val-de-lys", voisins: COMMUNE, maison: "p-0-0", quart: 0 }],
];

describe("les règles", () => {
  it("un tronc ne pousse pas dans la route, une couronne ne déborde pas sur la cour", () => {
    expect(marge("tronc", "route")).not.toBeNull();
    expect(marge("couronne", "cour")).not.toBeNull();
    expect(marge("couronne", "route")).not.toBeNull();
  });

  it("deux buissons ne se fondent pas, une touffe peut frôler un buisson", () => {
    expect(marge("buisson", "buisson")).not.toBeNull();
    expect(marge("herbe", "buisson")).toBeNull();
  });

  it("mesure un cercle contre une boîte au plus près", () => {
    const route = { type: "boite" as const, x: 0, z: 0, w: 10, d: 2 };
    expect(chevauchent({ type: "cercle", x: 0, z: 1.4, r: 0.5 }, route)).toBe(true);
    expect(chevauchent({ type: "cercle", x: 0, z: 1.6, r: 0.5 }, route)).toBe(false);
    // Le coin : la distance au coin, pas à la boîte englobante du cercle.
    expect(chevauchent({ type: "cercle", x: 5.4, z: 1.4, r: 0.5 }, route)).toBe(false);
  });

  it("refuse un arbre dont la couronne mord le bitume, même si le tronc est dehors", () => {
    const occ = new Occupation();
    occ.ajouter({ id: "cour", genre: "cour", forme: { type: "boite", x: 0, z: 0, w: 4, d: 4 } });
    // Tronc à 0,6 du bord, couronne de 0,97 : elle déborde sur la cour.
    expect(occ.poser("a", empreinteArbre(2.6, 0, 2.1))).toBe(false);
    expect(occ.poser("b", empreinteArbre(3.3, 0, 2.1))).toBe(true);
  });
});

describe("le verger", () => {
  it("garde ses pommiers dans son emprise", () => {
    // Couronne d'un pommier de taille 2,3, au pommier le plus excentré.
    const r = (empreinteArbre(ECART_VERGER, 0, 2.3)[1]!.forme as { r: number }).r;
    expect(ECART_VERGER + r).toBeLessThanOrEqual(COTE_DECOR / 2);
  });
});

describe.each(CAMPAGNES)("la campagne %s", (_nom, options) => {
  const plan = planCampagne(options);

  it("n'a aucun chevauchement interdit", () => {
    const fautes = conflits(plan.occupants).map(decrire);
    expect(fautes).toEqual([]);
  });

  it("déclare tout ce qu'elle pose", () => {
    const arbres = plan.occupants.filter((o) => o.genre === "tronc").length;
    expect(arbres).toBe(plan.arbres.length);
    expect(plan.occupants.filter((o) => o.id.startsWith("buisson")).length).toBeGreaterThan(0);
  });

  it("garde un pré habité : les règles n'ont pas vidé le décor", () => {
    expect(plan.arbres.length).toBeGreaterThan(100);
    expect(plan.herbes.length).toBeGreaterThan(150);
  });

  it("plante les arbres des coins de la ferme hors de la haie et du parking", () => {
    const hw = 8 * 1.06 + 0.9;
    const coins = arbresDeCoin(hw, hw, 2.1, [
      ...plan.occupants,
      { id: "cour", genre: "cour", forme: { type: "boite", ...COUR } },
    ]);
    // Un coin peut manquer de place (un chemin, un lieu du village) : on
    // préfère ne pas planter que planter dans le bitume.
    expect(coins.length).toBeGreaterThanOrEqual(1);
    const tous: Occupant[] = [
      ...plan.occupants,
      { id: "cour", genre: "cour", forme: { type: "boite", ...COUR } },
      { id: "ile", genre: "ile", forme: { type: "boite", x: 0, z: 0, w: hw, d: hw } },
      ...coins.flatMap((c, i) =>
        empreinteArbre(c.x, c.z, 2.1).map((p) => ({ id: `coin-${i}`, genre: p.genre, forme: p.forme })),
      ),
    ];
    expect(conflits(tous).map(decrire)).toEqual([]);
  });
});

describe("l'habillage des cours", () => {
  // Une grange de 2 × 3 cases, et un abreuvoir contre le mur.
  const bati = [
    { x: 0, z: -0.2, w: 1.5, d: 2.2 },
    { x: 0.95, z: 0.6, w: 0.3, d: 0.6 },
  ];
  it.each([1, 2, 3, 5, 7, 11, 13, 17, 23, 29])("graine %i : ni dans le bâti, ni l'un dans l'autre, ni hors de la case", (graine) => {
    const posees = placerHabillage(2, 3, graine, bati);
    expect(posees.length).toBeGreaterThan(0);
    const occupants: Occupant[] = [
      ...bati.map((b, i) => ({ id: `bati-${i}`, genre: "batiment" as const, forme: { type: "boite" as const, ...b } })),
      ...posees.map((p, i) => ({
        id: `${p.genre}-${i}`,
        genre: p.genre,
        forme: { type: "cercle" as const, x: p.x, z: p.z, r: p.genre === "buisson" ? p.r * 1.45 : p.r },
      })),
    ];
    expect(conflits(occupants).map(decrire)).toEqual([]);
    for (const p of posees) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(1.5);
    }
  });
});

describe("le village", () => {
  it("se tient à distance de la cour et de l'île : ses arbres ne recouvrent pas le parking", () => {
    const plan = planCampagne({ ...BASE, voisins: COMMUNE, maison: "p-0-0", quart: 0 });
    expect(plan.lieux.length).toBeGreaterThan(0);
    for (const l of plan.lieux) {
      const c = coteLieu(l.genre);
      const dx = Math.abs(l.x - COUR.x) - (c + COUR.w) / 2;
      const dz = Math.abs(l.z - COUR.z) - (c + COUR.d) / 2;
      expect(Math.max(dx, dz)).toBeGreaterThanOrEqual(ECART_COUR - 1e-6);
    }
  });
});
