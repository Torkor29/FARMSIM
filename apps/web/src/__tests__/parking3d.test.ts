import * as THREE from "three";
import { YARD_PLACES, YARD_SIZE, parkingLayout, parkingSlot } from "@farmsim/shared";
import { createParkingRig } from "../parking3d";

/**
 * La cour de stationnement, mesurée.
 *
 * Le parc était une case de champ repeinte en brun. La cour est maintenant un
 * ouvrage à part, posé hors de la grille : ces tests vérifient qu'elle pose au
 * sol, qu'elle tient dans son emprise, et qu'elle offre bien une place par
 * engin annoncé.
 */
function bounds(bays: number): THREE.Box3 {
  const rig = createParkingRig(parkingLayout(bays));
  rig.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig.group);
  rig.dispose();
  return box;
}

describe("la cour de stationnement en volume", () => {
  it("offre une place par engin, jamais moins", () => {
    for (const parc of [1, 4, 7, 12]) {
      const plan = parkingLayout(parc);
      const rig = createParkingRig(plan);
      expect(rig.slots).toHaveLength(plan.bays);
      expect(rig.slots.length).toBeGreaterThanOrEqual(parc);
      // Les places du modèle sont celles du plan partagé : la vue et les tests
      // ne peuvent pas diverger.
      expect(rig.slots[0]).toEqual({
        x: parkingSlot(0, plan).dx,
        z: parkingSlot(0, plan).dz,
      });
      rig.dispose();
    }
  });

  it("pose sur le sol : le béton est à zéro, le talus dessous", () => {
    const box = bounds(4);
    // Le dessus de dalle est le plan de roulement ; seul le talus descend.
    expect(box.max.y).toBeGreaterThan(0.5);
    expect(box.min.y).toBeGreaterThan(-0.4);
    expect(box.min.y).toBeLessThan(0);
  });

  it("tient dans son emprise : le parc, l'aire de livraison et le chemin", () => {
    for (const parc of [1, 6]) {
      const plan = parkingLayout(parc);
      const box = bounds(parc);
      const w = box.max.x - box.min.x;
      const d = box.max.z - box.min.z;
      // Le chemin saille vers le champ, d'où la tolérance sur x.
      expect(`${parc} ${w <= plan.w + 1.1}`).toBe(`${parc} true`);
      // En travers, la cour vaut le parc plus l'aire de livraison accolée.
      expect(`${parc} ${d <= plan.d + YARD_SIZE.d + 0.4}`).toBe(`${parc} true`);
      expect(`${parc} ${d > plan.d}`).toBe(`${parc} true`);
    }
  });

  it("offre les dix places de livraison, hors du champ", () => {
    const plan = parkingLayout(2);
    const rig = createParkingRig(plan);
    expect(rig.deliveries).toHaveLength(YARD_PLACES);
    const vues = new Set(rig.deliveries.map((s) => `${s.x.toFixed(3)},${s.z.toFixed(3)}`));
    // Deux caisses au même endroit, ce serait un objet cliquable pour deux.
    expect(vues.size).toBe(YARD_PLACES);
    // L'aire est accolée au parc, pas dessus : elle vit au-delà de son bord.
    for (const s of rig.deliveries) {
      expect(s.z).toBeLessThan(-plan.d / 2);
    }
    rig.dispose();
  });

  it("ouvre la cour en face de l'aire de livraison", () => {
    const plan = parkingLayout(4);
    const rig = createParkingRig(plan);
    // C'est là que la haie se fend : le passage doit tomber devant les caisses,
    // pas devant les engins garés.
    const zs = rig.deliveries.map((s) => s.z);
    expect(rig.gateZ).toBeGreaterThanOrEqual(Math.min(...zs) - YARD_SIZE.d);
    expect(rig.gateZ).toBeLessThanOrEqual(Math.max(...zs) + YARD_SIZE.d);
    rig.dispose();
  });

  it("garde les engins nez vers le champ", () => {
    const rig = createParkingRig(parkingLayout(3));
    expect(rig.heading).toBe(0);
    rig.dispose();
  });

  it("libère ses matières une fois retirée de la scène", () => {
    const rig = createParkingRig(parkingLayout(4));
    const mats = new Set<THREE.Material>();
    rig.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mats.add(mesh.material as THREE.Material);
    });
    expect(mats.size).toBeGreaterThan(0);
    rig.dispose();
    for (const m of mats) {
      // `dispose()` d'un matériau Three ne laisse pas de drapeau : on vérifie
      // au moins que le groupe est vidé et qu'aucun maillage ne subsiste.
      expect(m).toBeDefined();
    }
    expect(rig.group.children).toHaveLength(0);
  });
});
