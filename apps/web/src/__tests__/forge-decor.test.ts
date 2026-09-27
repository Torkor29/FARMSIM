import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

import { animerDecor, teinterSaison, type ManifesteDecor } from "../modeles-decor";

/**
 * La forge d'assets : des recettes Blender versionnées, des `.glb` livrés, et
 * un manifeste qui les décrit.
 *
 * Ces tests ne relancent pas Blender (la CI n'a pas `bpy`). Ils vérifient ce
 * que le jeu consomme : que chaque asset du manifeste existe, compressé, sous
 * son budget, avec les pièces qu'il annonce et la recette qui le refait.
 */
const DECOR = "public/assets/decor3d";
const MANIFESTE = JSON.parse(fs.readFileSync(path.join(DECOR, "manifest.json"), "utf8")) as ManifesteDecor;

/** Le JSON d'un .glb : le premier bloc après l'en-tête de 12 octets. */
function jsonGlb(fichier: string): { nodes: { name?: string }[]; meshes: { primitives: { attributes: Record<string, number> }[] }[] } {
  const b = fs.readFileSync(fichier);
  const longueur = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + longueur).toString("utf8"));
}

describe("les décors de la forge", () => {
  const assets = Object.entries(MANIFESTE.assets);

  it("sont au manifeste", () => {
    expect(MANIFESTE.version).toBe(1);
    for (const id of ["nature", "moulin", "puits", "serre", "etal", "epouvantail", "fete", "sol"]) {
      expect(MANIFESTE.assets[id]).toBeDefined();
    }
  });

  it.each(assets)("%s : livré compressé, sous un demi-mégaoctet", (id, a) => {
    const fichier = path.join(DECOR, `${id}.glb`);
    const glb = fs.readFileSync(fichier);
    expect(glb.subarray(0, 4).toString("latin1")).toBe("glTF");
    expect(glb.toString("latin1")).toContain("EXT_meshopt_compression");
    expect(glb.length).toBeLessThan(512 * 1024);
    expect(a.url).toBe(`/assets/decor3d/${id}.glb`);
    expect(a.octets).toBe(glb.length);
  });

  it.each(assets)("%s : chaque pièce annoncée est un nœud nommé du fichier", (id, a) => {
    const json = jsonGlb(path.join(DECOR, `${id}.glb`));
    const noms = new Set(json.nodes.map((n) => n.name));
    for (const [piece, info] of Object.entries(a.pieces)) {
      expect(noms).toContain(piece);
      for (const n of info.noeuds) expect(noms).toContain(`${piece}:${n}`);
    }
  });

  it.each(assets)("%s : l'occlusion est cuite dans les sommets", (id) => {
    const json = jsonGlb(path.join(DECOR, `${id}.glb`));
    for (const m of json.meshes) expect(m.primitives[0].attributes.COLOR_0).toBeDefined();
  });

  it.each(assets)("%s : refait par une recette versionnée, sous son budget", (id, a) => {
    const recette = fs.readFileSync(path.join("../..", a.source), "utf8");
    expect(recette).toMatch(/^ASSET = \{/m);
    expect(recette).toMatch(/^def construire\(a\):/m);
    const budget = Number(/"budget_triangles": (\d+)/.exec(recette)?.[1]);
    const appels = Number(/"budget_appels": (\d+)/.exec(recette)?.[1]);
    for (const p of Object.values(a.pieces)) {
      expect(p.triangles).toBeLessThanOrEqual(budget);
      expect(p.appels).toBeLessThanOrEqual(appels);
    }
  });

  it("donnent au feuillage une couleur d'automne et d'hiver", () => {
    const nature = MANIFESTE.assets.nature;
    expect(nature.saisons.automne?.feuillage).toMatch(/^#[0-9a-f]{6}$/);
    expect(nature.saisons.hiver?.feuillage).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("teinterSaison", () => {
  function arbre() {
    const g = new THREE.Group();
    const feuillage = new THREE.MeshStandardMaterial({ color: 0x7cb446, name: "feuillage" });
    const ecorce = new THREE.MeshStandardMaterial({ color: 0x6e4631, name: "ecorce" });
    g.add(new THREE.Mesh(new THREE.BufferGeometry(), feuillage), new THREE.Mesh(new THREE.BufferGeometry(), ecorce));
    return { g, feuillage, ecorce };
  }

  it("repeint les matières nommées, et laisse les autres", () => {
    const { g, feuillage, ecorce } = arbre();
    teinterSaison(g, { feuillage: "#e0923a" });
    expect(feuillage.color.getHexString()).toBe("e0923a");
    expect(ecorce.color.getHexString()).toBe("6e4631");
  });

  it("ramène l'été, même après plusieurs saisons", () => {
    const { g, feuillage } = arbre();
    teinterSaison(g, { feuillage: "#e0923a" });
    teinterSaison(g, { feuillage: "#dfe8ec" });
    teinterSaison(g, undefined);
    expect(feuillage.color.getHexString()).toBe("7cb446");
  });
});

describe("animerDecor", () => {
  it("fait tourner les ailes du moulin et le treuil du puits", () => {
    const racine = new THREE.Group();
    const ailes = new THREE.Group();
    ailes.name = "moulin:ailes";
    const treuil = new THREE.Group();
    treuil.name = "puits:treuil";
    racine.add(ailes, treuil);
    animerDecor(racine, 2);
    expect(ailes.rotation.z).not.toBe(0);
    expect(treuil.rotation.x).not.toBe(0);
  });
});
