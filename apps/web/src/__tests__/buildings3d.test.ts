import * as THREE from "three";
import { BUILDING_DEFS, type BuildingType } from "@farmsim/shared";
import { createBuildingRig, nearestThreshold } from "../buildings3d";

/**
 * Les bâtiments, mesurés.
 *
 * Le reproche d'origine — « le hangar semble posé en l'air » — venait de ce
 * que l'altitude d'une construction se **devinait** : on scannait le canal
 * alpha d'une image pour trouver où elle touchait terre, avec un repli codé en
 * dur quand l'heuristique échouait. Ces tests remplacent la devinette par une
 * mesure : un modèle qui décolle ou qui s'enterre ne passe plus.
 */

const TYPES = Object.keys(BUILDING_DEFS) as BuildingType[];
const LEVELS = [1, 2, 3, 4, 5];

function bounds(type: BuildingType, level = 1): THREE.Box3 {
  const rig = createBuildingRig(type, { level });
  rig.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig.group);
  rig.dispose();
  return box;
}

describe("l'aplomb", () => {
  for (const type of TYPES) {
    it(`${type} touche le sol à tous ses niveaux`, () => {
      for (const level of LEVELS) {
        const y = bounds(type, level).min.y;
        // Rien ne flotte : le point bas est la terre, à l'épaisseur d'un trait
        // près. Rien ne s'enterre non plus — une dalle sous le terrain donne
        // le même effet de trou que celui qu'on vient de corriger.
        const posé = y > -0.005 && y < 0.02;
        expect(`${type} n${level} bas=${y.toFixed(3)} ${posé}`).toBe(
          `${type} n${level} bas=${y.toFixed(3)} true`,
        );
      }
    });
  }

  it("aucun bâtiment n'est plat", () => {
    for (const type of TYPES) {
      // Une cour clôturée est basse, une grange est haute — mais rien n'est
      // une décalcomanie posée sur l'herbe.
      expect(`${type} ${bounds(type).max.y > 0.2}`).toBe(`${type} true`);
    }
  });
});

describe("l'emprise", () => {
  for (const type of TYPES) {
    it(`${type} tient dans son empreinte`, () => {
      const def = BUILDING_DEFS[type];
      const box = bounds(type, 5);
      const w = box.max.x - box.min.x;
      const d = box.max.z - box.min.z;
      // Une case fait une unité. Un bâtiment qui déborde masque la parcelle
      // voisine et ment sur la place qu'il occupe vraiment.
      expect(`${type} ${w.toFixed(2)}×${d.toFixed(2)} dans ${def.w}×${def.h}`).toBe(
        `${type} ${Math.min(w, def.w).toFixed(2)}×${Math.min(d, def.h).toFixed(2)} dans ${def.w}×${def.h}`,
      );
    });
  }

  it("le modèle est centré sur son empreinte", () => {
    for (const type of TYPES) {
      const box = bounds(type);
      const cx = (box.max.x + box.min.x) / 2;
      const cz = (box.max.z + box.min.z) / 2;
      // Un modèle décentré se poserait à cheval sur les cases voisines une
      // fois tourné d'un quart de tour.
      expect(`${type} ${Math.abs(cx) < 0.2 && Math.abs(cz) < 0.2}`).toBe(`${type} true`);
    }
  });
});

describe("le budget", () => {
  it("un bâtiment reste sous le plafond de triangles", () => {
    // Une ferme en porte une vingtaine à l'écran, contre trois engins : le
    // plafond est plus serré que celui des machines.
    for (const type of TYPES) {
      const rig = createBuildingRig(type, { level: 5 });
      let tris = 0;
      rig.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const g = mesh.geometry;
        tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
      });
      rig.dispose();
      expect(`${type} ${tris} ${tris < 3500}`).toBe(`${type} ${tris} true`);
    }
  });
});

describe("les pièces mobiles", () => {
  const SHELTERS: BuildingType[] = ["CATTLE_BARN", "SHEEPFOLD", "PIGSTY", "HENHOUSE"];

  for (const type of SHELTERS) {
    it(`${type} a un vantail et un seuil`, () => {
      const rig = createBuildingRig(type);
      expect(rig.anchors("door").length).toBeGreaterThan(0);
      // Sans seuil, la vue n'a aucun point de passage : les bêtes sortent au
      // travers du mur.
      expect(rig.anchors("threshold").length).toBeGreaterThan(0);
      rig.dispose();
    });

    it(`${type} ouvre vraiment sa porte`, () => {
      const rig = createBuildingRig(type);
      const door = rig.anchors("door")[0];
      for (let i = 0; i < 200; i++) rig.update({ t: i * 0.016, doorOpen: 0 });
      const ferme = door.rotation.y + door.position.y;
      for (let i = 0; i < 200; i++) rig.update({ t: i * 0.016, doorOpen: 1 });
      expect(Math.abs(door.rotation.y + door.position.y - ferme)).toBeGreaterThan(0.3);
      rig.dispose();
    });
  }

  it("les deux vantaux d'une grange s'écartent l'un de l'autre", () => {
    const rig = createBuildingRig("CATTLE_BARN");
    const [gauche, droite] = rig.anchors("door");
    for (let i = 0; i < 200; i++) rig.update({ t: i * 0.016, doorOpen: 1 });
    // Dans le même sens, les deux battants se suivent au lieu de s'ouvrir.
    expect(Math.sign(gauche.rotation.y)).toBe(-Math.sign(droite.rotation.y));
    rig.dispose();
  });

  it("le seuil est devant la façade, pas dedans", () => {
    const rig = createBuildingRig("CATTLE_BARN");
    rig.group.updateMatrixWorld(true);
    const seuil = rig.anchors("threshold")[0].getWorldPosition(new THREE.Vector3());
    // Façade en +z : un seuil derrière le milieu enverrait le troupeau dans
    // le mur du fond.
    expect(seuil.z).toBeGreaterThan(0.4);
    expect(seuil.z).toBeLessThan(BUILDING_DEFS.CATTLE_BARN.h / 2 + 0.35);
    rig.dispose();
  });

  it("une étable ouvre aussi ses deux flancs", () => {
    // L'enclos peut toucher l'étable par n'importe quel côté. Avec la seule
    // porte de façade, les bêtes traversaient le bardage pour rejoindre un pré
    // latéral : il faut un seuil praticable sur chaque long pan.
    for (const type of ["CATTLE_BARN", "SHEEPFOLD"] as BuildingType[]) {
      const rig = createBuildingRig(type);
      rig.group.updateMatrixWorld(true);
      const def = BUILDING_DEFS[type];
      const seuils = rig
        .anchors("threshold")
        .map((a) => a.getWorldPosition(new THREE.Vector3()));
      expect(seuils.length).toBe(4);
      // Le premier reste la façade : c'est le repli quand il n'y a pas d'enclos.
      expect(seuils[0].z).toBeGreaterThan(0.4);
      for (const sens of [-1, 1]) {
        const flanc = seuils.find((s) => Math.sign(s.x) === sens && Math.abs(s.x) > 0.4);
        expect(`${type} flanc ${sens} ${Boolean(flanc)}`).toBe(`${type} flanc ${sens} true`);
        // Dehors, mais pas au-delà de la case voisine.
        expect(Math.abs(flanc!.x)).toBeGreaterThan(def.w / 2 - 0.1);
        expect(Math.abs(flanc!.x)).toBeLessThan(def.w / 2 + 0.35);
        // Et centré sur le pan, sinon la bête sort par le coin.
        expect(Math.abs(flanc!.z)).toBeLessThan(0.2);
      }
      rig.dispose();
    }
  });

  it("le bardage est vraiment percé au droit des portes de flanc", () => {
    // Un seuil devant un mur plein ne sert à rien : on vérifie qu'aucune
    // paroi ne barre le passage à mi-hauteur de l'ouverture.
    const rig = createBuildingRig("CATTLE_BARN");
    rig.group.updateMatrixWorld(true);
    // Tout le bardage d'un bâtiment est fondu en un seul maillage : c'est donc
    // sommet par sommet qu'on regarde, et non par boîte englobante.
    let barre = 0;
    const p = new THREE.Vector3();
    rig.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || mesh.name !== "wall") return;
      const pos = mesh.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        // Le milieu d'un long pan, à hauteur de bête.
        if (Math.abs(p.x) > 1.2 && Math.abs(p.z) < 0.2 && p.y > 0.05 && p.y < 0.4) barre++;
      }
    });
    expect(barre).toBe(0);
    rig.dispose();
  });

  it("le troupeau sort par le côté où se trouve l'enclos", () => {
    /**
     * Le vrai reproche : « elles sortent toujours alors qu'il n'y a pas de
     * porte sur le côté ». On rejoue ici ce que fait la vue — les seuils lus
     * en repère monde, l'enclos posé quelque part autour — pour les quatre
     * orientations du bâtiment et les quatre positions possibles de l'enclos.
     * Seize cas : dans chacun, le seuil retenu doit être du côté de l'enclos.
     */
    for (const type of SHELTERS) {
      const rig = createBuildingRig(type);
      for (let quart = 0; quart < 4; quart++) {
        rig.group.rotation.y = (quart * Math.PI) / 2;
        rig.group.updateMatrixWorld(true);
        const seuils = rig
          .anchors("threshold")
          .map((a) => a.getWorldPosition(new THREE.Vector3()));
        for (const [dx, dz] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ]) {
          // L'enclos, trois cases plus loin dans cette direction.
          const pre = new THREE.Vector3(dx * 3, 0, dz * 3);
          const gate = nearestThreshold(seuils, pre)!;
          // Le seuil retenu doit pointer dans la direction de l'enclos : son
          // produit scalaire avec elle doit être le plus grand de tous.
          const vers = gate.x * dx + gate.z * dz;
          const mieux = Math.max(...seuils.map((s) => s.x * dx + s.z * dz));
          expect(`${type} q${quart} (${dx},${dz}) ${vers.toFixed(2)}`).toBe(
            `${type} q${quart} (${dx},${dz}) ${mieux.toFixed(2)}`,
          );
          // Et il doit être franchement de ce côté-là, jamais à l'opposé.
          expect(`${type} q${quart} (${dx},${dz}) ${vers > 0.4}`).toBe(
            `${type} q${quart} (${dx},${dz}) true`,
          );
        }
      }
      rig.dispose();
    }
  });

  it("l'extracteur de faîtage tourne", () => {
    const rig = createBuildingRig("CATTLE_BARN");
    rig.update({ t: 0 });
    const a = rig.anchors("vane")[0].rotation.y;
    rig.update({ t: 2 });
    expect(rig.anchors("vane")[0].rotation.y).not.toBeCloseTo(a, 3);
    rig.dispose();
  });
});

describe("le niveau se voit", () => {
  it("un silo amélioré aligne plus de cellules", () => {
    const compte = (level: number) => {
      const rig = createBuildingRig("SILO", { level });
      let verts = 0;
      rig.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.name === "corrugate") {
          verts += mesh.geometry.getAttribute("position").count;
        }
      });
      rig.dispose();
      return verts;
    };
    // Une ferme qui grandit aligne des cellules ; elle ne les gonfle pas.
    expect(compte(5)).toBeGreaterThan(compte(1) * 1.3);
  });
});
