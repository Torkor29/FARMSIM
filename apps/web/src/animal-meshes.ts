/**
 * Bêtes low-poly pour la carte.
 *
 * Même principe que les engins : pas un cube, un assemblage de primitives
 * (facettes assumées, 5 / 6 / 8 segments). Les webp / svg isométriques
 * restent dans l’UI ; ici il faut deux poses et une marche, donc des
 * volumes avec un rig nommé.
 *
 * Recette vache (direction artistique) : ~8 primitives, corps crème +
 * taches sombres, pattes cylindre 5 segs, cornes cône. Tête ~1/3 de la
 * hauteur, corps 1.35× plus large que le réalisme.
 *
 * Avant local = +Z, comme les machines.
 */

import * as THREE from "three";

export type AnimalRig = {
  body: THREE.Object3D;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
};

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

function addCone(
  parent: THREE.Object3D,
  mat: THREE.Material,
  r: number,
  h: number,
  segs: 4 | 5,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addShadow(parent: THREE.Object3D, w: number, d: number): void {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 8),
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

/** Pattes pivotées à la hanche, pour la marche. */
function addLeg(
  parent: THREE.Object3D,
  color: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
): THREE.Group {
  const hip = new THREE.Group();
  hip.position.set(x, y, z);
  const mat = paint(color);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, height, 5), mat);
  shaft.position.y = -height / 2;
  shaft.castShadow = true;
  hip.add(shaft);
  const hoof = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 1.7, radius * 0.55, radius * 1.9),
    paint(0x2a2218),
  );
  hoof.position.set(0, -height + radius * 0.15, 0.01);
  hip.add(hoof);
  parent.add(hip);
  return hip;
}

function makeCowMesh(): THREE.Group {
  const g = new THREE.Group();
  const hide = paint(0xfdf3e2);
  const spot = paint(0x2b3a33);
  const snout = paint(0xe3b3a8);
  const horn = paint(0xead9ba);
  const udder = paint(0xe8b4c4);
  const dark = paint(0x2b3a33);

  addShadow(g, 0.42, 0.55);

  const body = new THREE.Group();
  addBox(body, hide, 0.27, 0.22, 0.42, 0, 0.24, 0);
  addBox(body, spot, 0.12, 0.1, 0.16, 0.09, 0.28, 0.04);
  addBox(body, spot, 0.1, 0.08, 0.12, -0.08, 0.26, -0.1);
  addBox(body, udder, 0.1, 0.07, 0.12, 0, 0.12, -0.1);
  const tail = addBox(body, dark, 0.025, 0.14, 0.025, 0, 0.28, -0.24);
  tail.rotation.x = 0.35;
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.3, 0.2);
  addBox(head, hide, 0.16, 0.15, 0.16, 0, 0.02, 0.08);
  addBox(head, snout, 0.1, 0.08, 0.09, 0, -0.02, 0.18);
  addBox(head, hide, 0.04, 0.06, 0.02, 0.08, 0.08, 0.06);
  addBox(head, hide, 0.04, 0.06, 0.02, -0.08, 0.08, 0.06);
  const hornL = addCone(head, horn, 0.02, 0.055, 4, 0.05, 0.12, 0.04);
  hornL.rotation.z = -0.35;
  const hornR = addCone(head, horn, 0.02, 0.055, 4, -0.05, 0.12, 0.04);
  hornR.rotation.z = 0.35;
  g.add(head);

  const legs = [
    addLeg(g, 0x2b3a33, 0.08, 0.16, 0.12, 0.032, 0.16),
    addLeg(g, 0x2b3a33, -0.08, 0.16, 0.12, 0.032, 0.16),
    addLeg(g, 0x2b3a33, 0.08, 0.16, -0.14, 0.034, 0.16),
    addLeg(g, 0x2b3a33, -0.08, 0.16, -0.14, 0.034, 0.16),
  ];

  g.userData.rig = { body, head, legs } satisfies AnimalRig;
  g.name = "cow";
  return g;
}

function makeHenMesh(): THREE.Group {
  const g = new THREE.Group();
  const cream = paint(0xf4efe4);
  const brown = paint(0x8a5a32);
  const comb = paint(0xc23b22);
  const beak = paint(0xe8a317);
  const wattle = paint(0xb83228);

  addShadow(g, 0.22, 0.24);

  const body = new THREE.Group();
  addCyl(body, cream, 0.07, 0.08, 0.14, 6, 0, 0.13, 0).rotation.x = Math.PI / 2;
  addBox(body, brown, 0.1, 0.06, 0.08, 0, 0.14, -0.01);
  addBox(body, cream, 0.05, 0.04, 0.07, 0, 0.14, -0.1);
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.18, 0.08);
  addBox(head, cream, 0.07, 0.07, 0.07, 0, 0.03, 0.04);
  addBox(head, comb, 0.03, 0.045, 0.05, 0, 0.08, 0.03);
  addBox(head, beak, 0.03, 0.025, 0.05, 0, 0.02, 0.1);
  addBox(head, wattle, 0.02, 0.03, 0.02, 0, -0.01, 0.07);
  g.add(head);

  const legs = [
    addLeg(g, 0xe8a317, 0.025, 0.08, 0.01, 0.012, 0.075),
    addLeg(g, 0xe8a317, -0.025, 0.08, 0.01, 0.012, 0.075),
  ];

  g.userData.rig = { body, head, legs } satisfies AnimalRig;
  g.name = "hen";
  return g;
}

function makeSheepMesh(sheared = false): THREE.Group {
  const g = new THREE.Group();
  const wool = paint(sheared ? 0xe8d4c4 : 0xf7f4ee);
  const lump = paint(sheared ? 0xddc8b6 : 0xfffaf3);
  const face = paint(0x3d342c);

  addShadow(g, 0.34, 0.4);

  const body = new THREE.Group();
  const h = sheared ? 0.12 : 0.18;
  addBox(body, wool, 0.24, h, 0.32, 0, 0.16, 0);
  if (!sheared) {
    addBox(body, lump, 0.14, 0.1, 0.14, 0.02, 0.24, 0.04);
    addBox(body, lump, 0.12, 0.09, 0.12, -0.04, 0.22, -0.08);
  }
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.18, 0.16);
  addBox(head, face, 0.1, 0.1, 0.12, 0, 0.02, 0.08);
  addBox(head, face, 0.035, 0.05, 0.02, 0.055, 0.06, 0.04);
  addBox(head, face, 0.035, 0.05, 0.02, -0.055, 0.06, 0.04);
  g.add(head);

  const legs = [
    addLeg(g, 0x3d342c, 0.07, 0.1, 0.1, 0.022, 0.1),
    addLeg(g, 0x3d342c, -0.07, 0.1, 0.1, 0.022, 0.1),
    addLeg(g, 0x3d342c, 0.07, 0.1, -0.1, 0.022, 0.1),
    addLeg(g, 0x3d342c, -0.07, 0.1, -0.1, 0.022, 0.1),
  ];

  g.userData.rig = { body, head, legs } satisfies AnimalRig;
  g.name = "sheep";
  return g;
}

function makePigMesh(): THREE.Group {
  const g = new THREE.Group();
  const pink = paint(0xf0b8a8);
  const dark = paint(0xd49282);
  const snout = paint(0xe8a090);

  addShadow(g, 0.32, 0.42);

  const body = new THREE.Group();
  addCyl(body, pink, 0.1, 0.11, 0.28, 6, 0, 0.16, 0).rotation.x = Math.PI / 2;
  addBox(body, dark, 0.08, 0.06, 0.1, 0, 0.2, -0.02);
  const tail = addBox(body, pink, 0.02, 0.06, 0.02, 0, 0.2, -0.16);
  tail.rotation.x = -0.6;
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0, 0.18, 0.14);
  addBox(head, pink, 0.14, 0.12, 0.12, 0, 0.02, 0.06);
  addCyl(head, snout, 0.035, 0.04, 0.04, 6, 0, 0, 0.14).rotation.x = Math.PI / 2;
  addBox(head, dark, 0.05, 0.05, 0.02, 0.06, 0.08, 0.02);
  addBox(head, dark, 0.05, 0.05, 0.02, -0.06, 0.08, 0.02);
  g.add(head);

  const legs = [
    addLeg(g, 0xd49282, 0.07, 0.1, 0.08, 0.028, 0.1),
    addLeg(g, 0xd49282, -0.07, 0.1, 0.08, 0.028, 0.1),
    addLeg(g, 0xd49282, 0.07, 0.1, -0.1, 0.028, 0.1),
    addLeg(g, 0xd49282, -0.07, 0.1, -0.1, 0.028, 0.1),
  ];

  g.userData.rig = { body, head, legs } satisfies AnimalRig;
  g.name = "pig";
  return g;
}

export function meshForHerd(kind?: string, sheared = false): THREE.Group {
  if (kind === "HEN") return makeHenMesh();
  if (kind === "SHEEP") return makeSheepMesh(sheared);
  if (kind === "PIG") return makePigMesh();
  return makeCowMesh();
}

/** graze 0 = debout, 1 = tête au sol. walk = pattes qui se croisent. */
export function applyHerdPose(
  mesh: THREE.Group,
  kind: string,
  graze: number,
  walking: boolean,
  t: number,
  wander: number,
): void {
  const rig = mesh.userData.rig as AnimalRig | undefined;
  if (!rig) return;
  const g = Math.max(0, Math.min(1, graze));
  if (kind === "HEN") {
    rig.head.rotation.x = g * 1.15;
    rig.head.position.y = 0.18 - g * 0.05;
    rig.body.rotation.x = g * 0.22;
  } else if (kind === "SHEEP") {
    rig.head.rotation.x = g * 0.9;
    rig.head.position.y = 0.18 - g * 0.04;
    rig.body.rotation.x = g * 0.12;
  } else if (kind === "PIG") {
    rig.head.rotation.x = g * 0.7;
    rig.head.position.y = 0.18 - g * 0.03;
    rig.body.rotation.x = g * 0.1;
  } else {
    rig.head.rotation.x = g * 1.05;
    rig.head.position.y = 0.3 - g * 0.06;
    rig.body.rotation.x = g * 0.18;
  }
  const swing = walking ? Math.sin(t * 9 + wander) * 0.55 : 0;
  rig.legs.forEach((leg, i) => {
    leg.rotation.x = swing * (i % 2 === 0 ? 1 : -1);
  });
}
