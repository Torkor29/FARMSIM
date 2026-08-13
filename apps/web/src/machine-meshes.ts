/**
 * Engins low-poly pour la carte.
 *
 * Les webp isométriques restent au garage : ce sont des dessins, pas des
 * volumes. Sur le champ, un panneau billboard ne peut pas tourner ses roues
 * ni son rabatteur — il glisse comme une carte. Ici chaque machine est un
 * assemblage de primitives (facettes assumées, 8 segments max), orientable,
 * avec des pièces nommées que la boucle d'animation fait tourner.
 *
 * Palette reprise des illustrations : tracteur vert, moissonneuse rouge-or,
 * épandeur gris-ambre, déchaumeur terre et acier.
 */

import * as THREE from "three";
import type { MachineType } from "@farmsim/shared";

type SpinPart = THREE.Object3D & { userData: { spinAxis?: "x" | "y" | "z"; spinSpeed?: number } };

function paint(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function addBox(
  parent: THREE.Object3D,
  mat: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCyl(
  parent: THREE.Object3D,
  mat: THREE.Material,
  rTop: number,
  rBot: number,
  h: number,
  segs: 5 | 6 | 8,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addWheel(
  parent: THREE.Object3D,
  wheels: THREE.Object3D[],
  radius: number,
  width: number,
  x: number,
  z: number,
  tire: THREE.Material,
  rim: THREE.Material,
): THREE.Group {
  const hub = new THREE.Group();
  hub.position.set(x, radius, z);
  hub.userData.radius = radius;

  const rubber = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 8), tire);
  rubber.rotation.z = Math.PI / 2;
  rubber.castShadow = true;
  hub.add(rubber);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, width + 0.02, 6),
    rim,
  );
  cap.rotation.z = Math.PI / 2;
  hub.add(cap);

  // Un rayon : quand ça tourne, on lit le mouvement, pas un cylindre flou.
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, radius * 1.5, 0.03), rim);
  spoke.rotation.z = Math.PI / 2;
  hub.add(spoke);

  parent.add(hub);
  wheels.push(hub);
  return hub;
}

function addShadow(parent: THREE.Object3D, w: number, d: number): void {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 12),
    new THREE.MeshBasicMaterial({
      color: 0x1a2418,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(w, d, 1);
  shadow.position.y = 0.006;
  shadow.renderOrder = 1;
  parent.add(shadow);
}

function makeTractor(): THREE.Group {
  const g = new THREE.Group();
  const body = paint(0x3d8f3a);
  const dark = paint(0x2a6a28);
  const light = paint(0x4aa84a);
  const tire = paint(0x2a3230);
  const rim = paint(0xc5cdd4);
  const steel = paint(0x8a93a0);
  const glass = paint(0x7ec8e8);
  const wheels: THREE.Object3D[] = [];

  addShadow(g, 0.5, 0.62);
  addWheel(g, wheels, 0.16, 0.1, -0.22, -0.18, tire, rim);
  addWheel(g, wheels, 0.16, 0.1, 0.22, -0.18, tire, rim);
  addWheel(g, wheels, 0.1, 0.07, -0.18, 0.28, tire, rim);
  addWheel(g, wheels, 0.1, 0.07, 0.18, 0.28, tire, rim);

  addBox(g, body, 0.36, 0.16, 0.42, 0, 0.26, -0.06);
  addBox(g, light, 0.32, 0.14, 0.3, 0, 0.27, 0.22);
  addBox(g, dark, 0.3, 0.22, 0.26, 0, 0.42, -0.08);
  addBox(g, glass, 0.26, 0.12, 0.04, 0, 0.46, 0.06);
  addBox(g, steel, 0.34, 0.04, 0.04, 0, 0.22, 0.38);
  const stack = addCyl(g, steel, 0.025, 0.03, 0.2, 6, -0.12, 0.42, 0.18);
  stack.castShadow = true;
  addBox(g, steel, 0.12, 0.05, 0.08, 0, 0.18, -0.32);

  g.userData.wheels = wheels;
  return g;
}

function makeHarvester(): THREE.Group {
  const g = new THREE.Group();
  const red = paint(0xc44a2f);
  const dark = paint(0x9a321c);
  const gold = paint(0xd4a84b);
  const cream = paint(0xf0e2c0);
  const tire = paint(0x2a3230);
  const rim = paint(0xc5cdd4);
  const steel = paint(0x8a93a0);
  const glass = paint(0x7ec8e8);
  const wheels: THREE.Object3D[] = [];
  const spin: SpinPart[] = [];

  addShadow(g, 0.7, 0.85);
  addWheel(g, wheels, 0.14, 0.1, -0.28, -0.22, tire, rim);
  addWheel(g, wheels, 0.14, 0.1, 0.28, -0.22, tire, rim);
  addWheel(g, wheels, 0.12, 0.09, -0.28, 0.22, tire, rim);
  addWheel(g, wheels, 0.12, 0.09, 0.28, 0.22, tire, rim);

  addBox(g, red, 0.52, 0.28, 0.7, 0, 0.34, -0.04);
  addBox(g, dark, 0.48, 0.2, 0.36, 0, 0.56, -0.12);
  addBox(g, gold, 0.28, 0.22, 0.28, -0.08, 0.52, 0.18);
  addBox(g, glass, 0.22, 0.12, 0.04, -0.08, 0.56, 0.32);

  const pipe = addCyl(g, steel, 0.04, 0.04, 0.55, 6, 0.28, 0.58, -0.02);
  pipe.rotation.z = Math.PI / 2.6;

  addBox(g, gold, 0.92, 0.1, 0.22, 0, 0.2, 0.48);

  const reel = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.035, 0.04), cream);
    const a = (i / 4) * Math.PI * 2;
    slat.position.set(0, Math.sin(a) * 0.1, Math.cos(a) * 0.1);
    slat.rotation.x = a;
    reel.add(slat);
  }
  reel.position.set(0, 0.28, 0.52);
  reel.userData.spinAxis = "x";
  reel.userData.spinSpeed = 10;
  reel.name = "reel";
  g.add(reel);
  spin.push(reel);

  g.userData.wheels = wheels;
  g.userData.spin = spin;
  return g;
}

function makeSpreader(): THREE.Group {
  const g = new THREE.Group();
  const grey = paint(0x6a7380);
  const dark = paint(0x4d5560);
  const gold = paint(0xc9a227);
  const tire = paint(0x2a3230);
  const rim = paint(0xc5cdd4);
  const steel = paint(0x8a93a0);
  const wheels: THREE.Object3D[] = [];
  const spin: SpinPart[] = [];

  addShadow(g, 0.48, 0.58);
  addWheel(g, wheels, 0.13, 0.09, -0.22, -0.12, tire, rim);
  addWheel(g, wheels, 0.13, 0.09, 0.22, -0.12, tire, rim);
  addWheel(g, wheels, 0.1, 0.07, -0.18, 0.26, tire, rim);
  addWheel(g, wheels, 0.1, 0.07, 0.18, 0.26, tire, rim);

  addBox(g, dark, 0.34, 0.12, 0.55, 0, 0.22, 0.02);
  addCyl(g, gold, 0.18, 0.22, 0.32, 6, 0, 0.42, -0.06);
  addBox(g, grey, 0.22, 0.16, 0.2, 0, 0.36, 0.22);
  addBox(g, steel, 0.08, 0.05, 0.08, 0, 0.18, 0.34);

  const spinner = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 8), steel);
  spinner.add(disc);
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const vane = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.03), grey);
    vane.position.set(Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08);
    vane.rotation.y = a;
    spinner.add(vane);
  }
  spinner.position.set(0, 0.12, -0.32);
  spinner.userData.spinAxis = "y";
  spinner.userData.spinSpeed = 14;
  spinner.name = "spinner";
  g.add(spinner);
  spin.push(spinner);

  g.userData.wheels = wheels;
  g.userData.spin = spin;
  return g;
}

function makeHarrow(): THREE.Group {
  const g = new THREE.Group();
  const earth = paint(0x8a6a4a);
  const steel = paint(0xb8bec4);
  const dark = paint(0x5a4a3a);
  const green = paint(0x3d8f3a);
  const tire = paint(0x2a3230);
  const rim = paint(0xc5cdd4);
  const wheels: THREE.Object3D[] = [];
  const spin: SpinPart[] = [];

  addShadow(g, 0.62, 0.55);
  addWheel(g, wheels, 0.11, 0.08, -0.2, 0.18, tire, rim);
  addWheel(g, wheels, 0.11, 0.08, 0.2, 0.18, tire, rim);

  addBox(g, green, 0.3, 0.14, 0.28, 0, 0.24, 0.16);
  addBox(g, dark, 0.22, 0.12, 0.16, 0, 0.34, 0.12);
  addBox(g, earth, 0.78, 0.06, 0.16, 0, 0.2, -0.16);

  for (const z of [-0.1, -0.22]) {
    for (const x of [-0.3, -0.1, 0.1, 0.3]) {
      const hub = new THREE.Group();
      hub.position.set(x, 0.11, z);
      hub.rotation.y = 0.35;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 8), steel);
      disc.rotation.z = Math.PI / 2;
      disc.castShadow = true;
      hub.add(disc);
      hub.userData.spinAxis = "x";
      hub.userData.spinSpeed = 9;
      g.add(hub);
      spin.push(hub);
    }
  }

  g.userData.wheels = wheels;
  g.userData.spin = spin;
  return g;
}

function makeBaler(): THREE.Group {
  const g = new THREE.Group();
  const body = paint(0xc9a24a);
  const dark = paint(0x8a6a28);
  const straw = paint(0xd4b56a);
  const tire = paint(0x2a3230);
  const rim = paint(0xc5cdd4);
  const steel = paint(0x8a93a0);
  const wheels: THREE.Object3D[] = [];
  const spin: SpinPart[] = [];

  addShadow(g, 0.55, 0.5);
  addWheel(g, wheels, 0.12, 0.08, -0.18, 0.12, tire, rim);
  addWheel(g, wheels, 0.12, 0.08, 0.18, 0.12, tire, rim);

  addBox(g, body, 0.42, 0.22, 0.5, 0, 0.28, 0);
  addBox(g, dark, 0.28, 0.12, 0.18, 0, 0.4, 0.12);
  const bale = addCyl(g, straw, 0.16, 0.16, 0.28, 8, 0, 0.26, -0.28);
  bale.rotation.z = Math.PI / 2;
  bale.userData.spinAxis = "x";
  bale.userData.spinSpeed = 6;
  spin.push(bale);
  addBox(g, steel, 0.36, 0.06, 0.12, 0, 0.16, 0.28);

  g.userData.wheels = wheels;
  g.userData.spin = spin;
  return g;
}

function makeForageHarvester(): THREE.Group {
  const g = makeHarvester();
  const spout = paint(0xc9a24a);
  addBox(g, spout, 0.08, 0.08, 0.55, 0.22, 0.62, -0.05);
  addBox(g, spout, 0.1, 0.08, 0.12, 0.22, 0.7, -0.34);
  return g;
}

/** Machine posée sur le sol, origin au contact des pneus. */
export function makeMachineMesh(type: MachineType): THREE.Group {
  const g =
    type === "HARVESTER"
      ? makeHarvester()
      : type === "FORAGE_HARVESTER"
        ? makeForageHarvester()
        : type === "SPREADER"
          ? makeSpreader()
          : type === "DISC_HARROW"
            ? makeHarrow()
            : type === "BALER"
              ? makeBaler()
              : makeTractor();
  g.userData.machineType = type;
  g.name = "machine";
  return g;
}

/** Fait tourner roues et outils selon la distance parcourue. */
export function tickMachine(
  g: THREE.Group,
  opts: { distance: number; working: boolean; dt: number },
): void {
  const wheels = g.userData.wheels as THREE.Object3D[] | undefined;
  if (wheels && opts.distance > 0) {
    for (const w of wheels) {
      const r = (w.userData.radius as number) || 0.12;
      w.rotation.x += opts.distance / r;
    }
  }
  const spins = g.userData.spin as SpinPart[] | undefined;
  if (spins && opts.working && opts.dt > 0) {
    for (const s of spins) {
      const axis = s.userData.spinAxis ?? "x";
      const speed = s.userData.spinSpeed ?? 8;
      s.rotation[axis] += speed * opts.dt;
    }
  }
}
