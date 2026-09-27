import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DECO_CATALOGUE, articleDeco, cerclesDeco, type Decoration } from "@farmsim/shared";
import { gene, occupantsDeco, versScene, versSiege, type RepereFerme } from "../decor-joueur";
import { planCampagne } from "../countryside-plan";
import { conflits, decrire, type Occupant } from "../placement";

/**
 * La décoration libre, côté vue : le repère du siège, l'emprise au sol, la
 * validation d'une pose, et la place que le décor tiré au sort lui cède.
 */

const REPERES: RepereFerme[] = [
  { quart: 0, mx: 0, mz: 0 },
  { quart: 1, mx: 18.4, mz: 0 },
  { quart: 2, mx: -18.4, mz: 36.8 },
  { quart: 3, mx: 0, mz: -18.4 },
];

describe("le repère du siège", () => {
  it.each(REPERES)("aller-retour exact (quart %#)", (r) => {
    const d = { x: 7.25, z: -3.5, rot: 0.6 };
    const s = versScene(d, r);
    const retour = versSiege(s, r);
    expect(retour.x).toBeCloseTo(d.x, 9);
    expect(retour.z).toBeCloseTo(d.z, 9);
    expect(retour.rot).toBeCloseTo(d.rot, 9);
  });

  it("tourne le cap avec la carte : l'avant de l'objet suit sa position", () => {
    // Un objet posé à l'est du siège, tourné vers l'est (cap 0 → axe +x).
    const r: RepereFerme = { quart: 1, mx: 0, mz: 0 };
    const s = versScene({ x: 1, z: 0, rot: 0 }, r);
    // L'axe +x local, tourné du cap, en coordonnées de scène
    // (`Object3D.rotation.y` : x' = cos·x, z' = −sin·x).
    const avant = { x: Math.cos(s.rot), z: -Math.sin(s.rot) };
    expect(avant.x).toBeCloseTo(s.x, 9);
    expect(avant.z).toBeCloseTo(s.z, 9);
  });
});

describe("l'emprise au sol", () => {
  it("allonge un banc en file de cercles qui tourne avec lui", () => {
    const banc = articleDeco("BANC")!;
    const droit = cerclesDeco(banc, 0, 0, 0);
    expect(droit.length).toBeGreaterThan(1);
    expect(Math.max(...droit.map((c) => Math.abs(c.z)))).toBeLessThan(1e-9);
    const tourne = cerclesDeco(banc, 0, 0, Math.PI / 2);
    expect(Math.max(...tourne.map((c) => Math.abs(c.x)))).toBeLessThan(1e-9);
  });

  it("garde les dimensions du manifeste de la forge", () => {
    const manifeste = JSON.parse(
      readFileSync(join(process.cwd(), "public/assets/decor3d/manifest.json"), "utf8"),
    ) as { assets: Record<string, { pieces: Record<string, { taille: number[] }> }> };
    for (const a of DECO_CATALOGUE) {
      const piece = manifeste.assets[a.asset]?.pieces[a.piece];
      expect(piece).toBeDefined();
      for (let i = 0; i < 3; i++) expect(a.taille[i]).toBeCloseTo(piece!.taille[i]!, 2);
    }
  });
});

describe("la validation d'une pose", () => {
  const route: Occupant = { id: "route", genre: "route", forme: { type: "boite", x: 0, z: 0, w: 40, d: 1.9 } };
  const champ: Occupant = { id: "p", genre: "parcelle", forme: { type: "boite", x: 0, z: 10, w: 8, d: 8 } };
  const durs = [route, champ];
  const banc = articleDeco("BANC")!;

  it("refuse la route et le champ, accepte l'herbe", () => {
    expect(gene(banc, 3, 0.4, 0, durs, [])?.genre).toBe("route");
    expect(gene(banc, 0, 10, 0, durs, [])?.genre).toBe("parcelle");
    expect(gene(banc, 3, -3, 0, durs, [])).toBeNull();
  });

  it("refuse deux bancs l'un dans l'autre, accepte deux bancs dos à dos", () => {
    const pose: Decoration[] = [{ id: "a", code: "BANC", x: 3, z: -3, rot: 0 }];
    const autres = occupantsDeco(pose, REPERES[0]!);
    expect(gene(banc, 3.2, -3, 0, durs, autres)).not.toBeNull();
    expect(gene(banc, 3, -3 - 0.3, 0, durs, autres)).toBeNull();
  });

  it("laisse poser une lanterne sur un dallage, pas un dallage sur un autre", () => {
    const pose: Decoration[] = [{ id: "d", code: "DALLAGE", x: 5, z: -6, rot: 0 }];
    const autres = occupantsDeco(pose, REPERES[0]!);
    expect(gene(articleDeco("LANTERNE")!, 5, -6, 0, durs, autres)).toBeNull();
    expect(gene(articleDeco("DALLAGE_PETIT")!, 5.3, -6, 0, durs, autres)).not.toBeNull();
    expect(gene(articleDeco("LANTERNE")!, 5, -6, 0, durs, occupantsDeco([{ ...pose[0]!, code: "MARE" }], REPERES[0]!))).not.toBeNull();
  });

  it("refuse un arbre dont la ramure cache la route", () => {
    // Côté caméra de la route, dans l'herbe : le masque recouvre la chaussée.
    expect(gene(articleDeco("ARBRE_ROND")!, 0, 3.4, 0, durs, [])?.genre).toBe("route");
    expect(gene(articleDeco("ARBRE_ROND")!, 0, -4.2, 0, durs, [])).toBeNull();
  });
});

describe("le décor tiré au sort cède la place", () => {
  const COUR = { x: -11.5, z: 2.5, w: 6, d: 9 };
  const base = { graine: "clos-d-orme", emprise: 12 * 1.06 + 1.4, cour: COUR };

  it("aucun arbre ni buisson ne pousse dans une décoration, et rien ne se chevauche", () => {
    const sans = planCampagne(base);
    // On pose un puits et un dallage là où le hasard avait mis un arbre et un buisson.
    const arbre = sans.arbres[Math.floor(sans.arbres.length / 2)]!;
    const buisson = sans.herbes.find((h) => h.piece === "buisson-1")!;
    const decos: Decoration[] = [
      { id: "puits", code: "PUITS", x: arbre.x, z: arbre.z, rot: 0 },
      { id: "dalle", code: "DALLAGE", x: buisson.x, z: buisson.z, rot: 0.3 },
    ];
    const occ = occupantsDeco(decos, { quart: 0, mx: 0, mz: 0 });
    const avec = planCampagne({ ...base, decorations: occ });
    expect(conflits(avec.occupants).map(decrire)).toEqual([]);
    expect(avec.occupants.filter((o) => o.id.startsWith("deco-")).length).toBe(occ.length);
    // Les durs ne contiennent ni les décorations ni le décor tiré au sort.
    expect(avec.durs.some((o) => o.id.startsWith("deco-") || o.id.startsWith("arbre-"))).toBe(false);
  });
});
