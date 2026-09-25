import fs from "node:fs";
import * as THREE from "three";

import { DETAILS_MAX } from "../countryside";
import { fusionnerStatique } from "../fusion-statique";

/**
 * « Le jeu est super lent. »
 *
 * Mesuré sur la vue d'ouverture, en qualité pleine : 1 167 maillages et
 * 930 000 triangles. Deux postes faisaient l'essentiel — trois champs voisins
 * semés aussi dru que la ferme (650 000 triangles), et 585 pièces de
 * bâtiments voisins, autant d'appels de rendu. Après : 485 maillages,
 * 413 000 triangles, et six maillages pour tous les bâtiments.
 */
const matiere = (color: number, roughness = 0.9) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });

describe("la cuisson des bâtiments immobiles", () => {
  it("fond les pièces d'une même matière en un seul maillage, couleurs gardées", () => {
    const repere = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matiere(0xff0000));
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matiere(0x00ff00));
    b.position.set(4, 0, 0);
    const bat = new THREE.Group();
    bat.add(a, b);
    repere.add(bat);
    const f = fusionnerStatique([bat], repere, () => false);
    expect(f.meshes).toHaveLength(1);
    expect(bat.children).toHaveLength(0);
    const geo = f.meshes[0]!.geometry;
    expect(geo.getAttribute("position").count).toBe(72);
    const couleurs = geo.getAttribute("color");
    expect(couleurs.getX(0)).toBeCloseTo(1);
    expect(couleurs.getY(71)).toBeCloseTo(1);
    // La seconde boîte reste à sa place, dans le repère.
    geo.computeBoundingBox();
    expect(geo.boundingBox!.max.x).toBeCloseTo(4.5);
    f.dispose();
  });

  it("sépare les matières qui ne brillent pas pareil", () => {
    const bat = new THREE.Group();
    bat.add(
      new THREE.Mesh(new THREE.BoxGeometry(), matiere(0xffffff, 0.9)),
      new THREE.Mesh(new THREE.BoxGeometry(), matiere(0xffffff, 0.3)),
    );
    expect(fusionnerStatique([bat], new THREE.Group(), () => false).meshes).toHaveLength(2);
  });

  it("laisse tourner girouettes et hélices", () => {
    const bat = new THREE.Group();
    const helice = new THREE.Group();
    helice.add(new THREE.Mesh(new THREE.BoxGeometry(), matiere(0xffffff)));
    bat.add(new THREE.Mesh(new THREE.BoxGeometry(), matiere(0xffffff)), helice);
    const f = fusionnerStatique([bat], new THREE.Group(), (o) => o === helice);
    expect(f.meshes).toHaveLength(1);
    expect(helice.children).toHaveLength(1);
    expect(bat.children).toEqual([helice]);
  });

  it("est branchée sur les bâtiments de la campagne", () => {
    const CAMPAGNE = fs.readFileSync("src/countryside.ts", "utf8");
    expect(CAMPAGNE).toMatch(/fusionnerStatique\(\s*rigsBatiments\.map/);
    expect(CAMPAGNE).toMatch(/r\.anchors\("vane"\), \.\.\.r\.anchors\("rotor"\)/);
    expect(CAMPAGNE).toMatch(/fusionBatiments\.dispose\(\)/);
  });
});

describe("les champs voisins", () => {
  it("sont semés moitié moins dru, et deux au plus en détail", () => {
    expect(DETAILS_MAX).toBe(2);
    const VOISIN = fs.readFileSync("src/voisin3d.ts", "utf8");
    expect(VOISIN).toMatch(/createCropField\(indices\.length, sobre \? 0\.25 : 0\.35\)/);
  });
});
