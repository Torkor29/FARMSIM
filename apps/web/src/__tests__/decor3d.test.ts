import * as THREE from "three";
import {
  ajouterArbre,
  ajouterGrange,
  eclaircir,
  maillageFacette,
  makeArbre,
  makeVoiture,
} from "../decor3d";

/**
 * Les volumes du décor, mesurés.
 *
 * Trois reproches à l'origine : « les arbres aux coins de la parcelle sont
 * ignobles », les voitures aussi, et les bâtiments des voisins ressemblaient à
 * des dalles posées en équilibre. Ce qui suit tient la forme — un tronc sous
 * le feuillage, quatre roues sous une caisse, un toit en pente au-dessus des
 * murs — parce que c'est justement là que les premières versions se sont
 * trompées.
 */

function nappe(remplir: (pos: number[], col: number[]) => void): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  remplir(pos, col);
  return maillageFacette(pos, col);
}

function boite(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

describe("les arbres", () => {
  it("posent leur tronc au sol et portent leur feuillage au-dessus", () => {
    const m = makeArbre(2, 42);
    const b = boite(m);
    expect(b.min.y).toBeCloseTo(0, 1);
    expect(b.max.y).toBeGreaterThan(1.4);
    // Plus haut que large : un arbre, pas un buisson.
    expect(b.max.y - b.min.y).toBeGreaterThan(b.max.x - b.min.x);
  });

  it("grandissent avec leur taille", () => {
    const petit = boite(makeArbre(1.4, 7)).max.y;
    const grand = boite(makeArbre(2.6, 7)).max.y;
    expect(grand).toBeGreaterThan(petit * 1.5);
  });

  it("ne se ressemblent pas deux à deux", () => {
    // Une allée d'arbres clonés se voit immédiatement.
    const hauteurs = [1, 2, 3, 4, 5].map((g) => boite(makeArbre(2, g)).max.y);
    expect(new Set(hauteurs.map((h) => h.toFixed(3))).size).toBeGreaterThan(2);
  });

  it("tiennent dans un seul maillage quand on en sème trente", () => {
    // Trente arbres en trente objets, ce sont trente appels de dessin par
    // image sur un téléphone qui peine déjà.
    const m = nappe((pos, col) => {
      for (let i = 0; i < 30; i++) ajouterArbre(pos, col, i * 3, 0, 0, 2, i);
    });
    expect(m.geometry.getAttribute("position").count).toBeGreaterThan(1000);
  });
});

describe("les granges", () => {
  it("coiffent leurs murs d’un toit, et non d’une planche", () => {
    /*
     * Le défaut exact : le pan était incliné autour de Z alors que son faîte
     * court le long de X. Il sortait du bâtiment en biais. Le sommet doit se
     * trouver au milieu de la profondeur — c'est la définition d'un faîte.
     */
    const m = nappe((pos, col) => ajouterGrange(pos, col, 0, 0, 0, 0, 3));
    const p = m.geometry.getAttribute("position");
    let hautMax = -Infinity;
    for (let i = 0; i < p.count; i++) hautMax = Math.max(hautMax, p.getY(i));
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > hautMax - 0.05) {
        zMin = Math.min(zMin, p.getZ(i));
        zMax = Math.max(zMax, p.getZ(i));
      }
    }
    // Le faîte est étroit en profondeur : les points hauts sont groupés au
    // milieu, pas étalés d'un bord à l'autre du toit.
    expect(Math.abs(zMin + zMax) / 2).toBeLessThan(0.25);
    expect(zMax - zMin).toBeLessThan(0.6);
  });

  it("restent compactes : le toit ne dépasse pas le bâtiment", () => {
    const b = boite(nappe((pos, col) => ajouterGrange(pos, col, 0, 0, 0, 0, 9)));
    expect(b.max.x - b.min.x).toBeLessThan(3);
    expect(b.max.z - b.min.z).toBeLessThan(2.6);
    expect(b.max.y).toBeLessThan(1.7);
    expect(b.min.y).toBeGreaterThanOrEqual(-0.01);
  });

  it("tournent d’un bloc", () => {
    const droite = boite(nappe((pos, col) => ajouterGrange(pos, col, 0, 0, 0, 0, 5)));
    const tournee = boite(nappe((pos, col) => ajouterGrange(pos, col, 0, 0, 0, Math.PI / 2, 5)));
    expect(tournee.max.z - tournee.min.z).toBeCloseTo(droite.max.x - droite.min.x, 5);
    expect(tournee.max.y).toBeCloseTo(droite.max.y, 5);
  });
});

describe("les voitures", () => {
  it("ont quatre roues sous une caisse", () => {
    const b = boite(makeVoiture(0xc9503a));
    expect(b.min.y).toBeCloseTo(0.01, 1);
    expect(b.max.y).toBeLessThan(0.65);
    // Plus longue que large : une voiture, pas une brique.
    expect(b.max.z - b.min.z).toBeGreaterThan((b.max.x - b.min.x) * 1.8);
  });

  it("tiennent dans un seul appel de dessin", () => {
    const g = makeVoiture(0x3f6fb5);
    expect(g.children.filter((c) => c instanceof THREE.Mesh).length).toBe(1);
  });
});

describe("l’éclaircissement", () => {
  it("va vers le blanc sans le dépasser", () => {
    expect(eclaircir(0x000000, 1)).toBe(0xffffff);
    expect(eclaircir(0xffffff, 1)).toBe(0xffffff);
    expect(eclaircir(0x808080, 0)).toBe(0x808080);
  });

  it("va vers le noir sans passer dessous", () => {
    expect(eclaircir(0xffffff, -1)).toBe(0x000000);
    expect(eclaircir(0x000000, -1)).toBe(0x000000);
    expect(eclaircir(0x102030, -3)).toBe(0x000000);
  });
});
