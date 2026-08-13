import * as THREE from "three";
import {
  ACCENT_COLORS,
  CLOTH_COLORS,
  CLOTHES,
  EARS,
  EYE_COLORS,
  EYE_SHAPES,
  HAT_COLORS,
  HATS,
  MOUTHS,
  NOSES,
  SKIN_TONES,
  type CharacterAppearance,
  type Specialization,
} from "@farmsim/shared";

const FLAT = (color: number | string) =>
  new THREE.MeshLambertMaterial({ color: new THREE.Color(color), flatShading: true });

function box(w: number, h: number, d: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

function addHat(g: THREE.Group, appearance: CharacterAppearance) {
  const kind = HATS[appearance.hat]?.id ?? "none";
  if (kind === "none") return;
  const mat = FLAT(HAT_COLORS[appearance.hatColor]?.hex ?? "#c9a227");
  if (kind === "straw") {
    const brim = cyl(0.38, 0.38, 0.035, 8, mat);
    brim.position.y = 1.55;
    const crown = cyl(0.19, 0.21, 0.2, 8, mat);
    crown.position.y = 1.65;
    g.add(brim, crown);
    return;
  }
  if (kind === "cap") {
    const crown = cyl(0.2, 0.22, 0.16, 8, mat);
    crown.position.y = 1.6;
    const visor = box(0.22, 0.03, 0.16, mat);
    visor.position.set(0, 1.54, 0.2);
    visor.rotation.x = 0.15;
    g.add(crown, visor);
    return;
  }
  if (kind === "beanie") {
    const hat = cyl(0.2, 0.22, 0.2, 8, mat);
    hat.position.y = 1.62;
    const pom = cyl(0.05, 0.05, 0.06, 6, mat);
    pom.position.y = 1.74;
    g.add(hat, pom);
    return;
  }
  if (kind === "cowboy") {
    const brim = cyl(0.4, 0.4, 0.04, 8, mat);
    brim.position.y = 1.54;
    brim.rotation.z = 0.08;
    const crown = cyl(0.16, 0.2, 0.26, 8, mat);
    crown.position.y = 1.68;
    g.add(brim, crown);
    return;
  }
  if (kind === "beret") {
    const disc = cyl(0.24, 0.24, 0.06, 8, mat);
    disc.position.set(0.04, 1.58, 0);
    disc.rotation.z = 0.18;
    g.add(disc);
    return;
  }
  const wrap = box(0.4, 0.08, 0.38, mat);
  wrap.position.y = 1.52;
  g.add(wrap);
}

function addEyes(g: THREE.Group, appearance: CharacterAppearance, skin: THREE.Material) {
  const shape = EYE_SHAPES[appearance.eyeShape]?.id ?? "round";
  const iris = FLAT(EYE_COLORS[appearance.eyeColor]?.hex ?? "#2b2018");
  const white = FLAT("#f4f1ea");
  let w = 0.05;
  let h = 0.06;
  let gap = 0.08;
  if (shape === "almond") {
    w = 0.07;
    h = 0.045;
  } else if (shape === "wide") {
    gap = 0.12;
  } else if (shape === "narrow") {
    gap = 0.05;
    w = 0.045;
  } else if (shape === "sleepy") {
    h = 0.03;
    w = 0.06;
  }
  const y = 1.4;
  const z = 0.18;
  for (const side of [-1, 1]) {
    const sclera = box(w + 0.02, h + 0.01, 0.02, white);
    sclera.position.set(side * gap, y, z);
    const pupil = box(w, h, 0.025, iris);
    pupil.position.set(side * gap, y, z + 0.012);
    g.add(sclera, pupil);
  }
  void skin;
}

function addMouth(g: THREE.Group, appearance: CharacterAppearance) {
  const kind = MOUTHS[appearance.mouth]?.id ?? "smile";
  const lip = FLAT("#a85a52");
  if (kind === "neutral") {
    const line = box(0.1, 0.02, 0.02, lip);
    line.position.set(0, 1.24, 0.18);
    g.add(line);
    return;
  }
  if (kind === "grin") {
    const line = box(0.16, 0.035, 0.025, lip);
    line.position.set(0, 1.23, 0.18);
    const tooth = box(0.1, 0.02, 0.02, FLAT("#f7f3ea"));
    tooth.position.set(0, 1.24, 0.19);
    g.add(line, tooth);
    return;
  }
  if (kind === "smirk") {
    const line = box(0.1, 0.025, 0.02, lip);
    line.position.set(0.03, 1.24, 0.18);
    line.rotation.z = -0.25;
    g.add(line);
    return;
  }
  if (kind === "open") {
    const hole = box(0.07, 0.05, 0.03, FLAT("#4a201c"));
    hole.position.set(0, 1.23, 0.18);
    g.add(hole);
    return;
  }
  const line = box(0.12, 0.025, 0.02, lip);
  line.position.set(0, 1.235, 0.18);
  const cornerL = box(0.03, 0.02, 0.02, lip);
  cornerL.position.set(-0.06, 1.245, 0.18);
  const cornerR = cornerL.clone();
  cornerR.position.x = 0.06;
  g.add(line, cornerL, cornerR);
}

function addNose(g: THREE.Group, appearance: CharacterAppearance, skin: THREE.Material) {
  const kind = NOSES[appearance.nose]?.id ?? "small";
  let mesh: THREE.Mesh;
  if (kind === "round") mesh = cyl(0.045, 0.05, 0.07, 6, skin);
  else if (kind === "long") mesh = box(0.05, 0.1, 0.08, skin);
  else if (kind === "button") mesh = cyl(0.035, 0.04, 0.05, 6, skin);
  else if (kind === "broad") mesh = box(0.1, 0.06, 0.07, skin);
  else mesh = box(0.05, 0.06, 0.05, skin);
  mesh.position.set(0, 1.32, 0.2);
  g.add(mesh);
}

function addEars(g: THREE.Group, appearance: CharacterAppearance, skin: THREE.Material) {
  const kind = EARS[appearance.ears]?.id ?? "small";
  let w = 0.05;
  let h = 0.08;
  let d = 0.04;
  if (kind === "round") {
    w = 0.07;
    h = 0.07;
  } else if (kind === "pointed") {
    w = 0.045;
    h = 0.11;
  } else if (kind === "wide") {
    w = 0.08;
    h = 0.09;
    d = 0.05;
  }
  const earL = box(w, h, d, skin);
  earL.position.set(-0.2, 1.37, 0);
  const earR = earL.clone();
  earR.position.x = 0.2;
  g.add(earL, earR);
}

function addClothes(
  g: THREE.Group,
  appearance: CharacterAppearance,
  cloth: THREE.Material,
  accent: THREE.Material,
  skin: THREE.Material,
) {
  const kind = CLOTHES[appearance.clothes]?.id ?? "overalls";
  const boot = FLAT("#3b2b1e");
  const pants = kind === "coverall" ? cloth : kind === "overalls" ? cloth : FLAT("#3a3f4a");

  const legL = box(0.22, 0.52, 0.24, pants);
  legL.position.set(-0.14, 0.26, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);

  const bootL = box(0.26, 0.14, 0.32, boot);
  bootL.position.set(-0.14, 0.07, 0.04);
  const bootR = bootL.clone();
  bootR.position.x = 0.14;
  g.add(bootL, bootR);

  const torsoW = kind === "jacket" || kind === "sweater" ? 0.58 : 0.52;
  const torsoD = kind === "sweater" ? 0.34 : 0.3;
  const shirt = kind === "vest" ? FLAT("#efe6d4") : cloth;
  const torso = box(torsoW, 0.58, torsoD, shirt);
  torso.position.y = 0.81;
  g.add(torso);

  if (kind === "overalls") {
    const bib = box(0.3, 0.34, 0.32, accent);
    bib.position.set(0, 0.86, 0.01);
    g.add(bib);
  } else if (kind === "jacket") {
    const lapel = box(0.5, 0.4, 0.34, cloth);
    lapel.position.y = 0.86;
    g.add(lapel);
    const collar = box(0.34, 0.08, 0.28, accent);
    collar.position.y = 1.08;
    g.add(collar);
  } else if (kind === "sweater") {
    const collar = cyl(0.12, 0.14, 0.08, 8, cloth);
    collar.position.y = 1.12;
    g.add(collar);
  } else if (kind === "vest") {
    const panelL = box(0.16, 0.42, 0.32, accent);
    panelL.position.set(-0.14, 0.84, 0.01);
    const panelR = panelL.clone();
    panelR.position.x = 0.14;
    g.add(panelL, panelR);
  } else if (kind === "shirt") {
    const collar = box(0.28, 0.06, 0.26, FLAT("#efe6d4"));
    collar.position.y = 1.08;
    g.add(collar);
  }

  const armMat = kind === "vest" ? skin : cloth;
  const armL = box(0.14, 0.46, 0.16, armMat);
  armL.position.set(-0.33, 0.82, 0);
  armL.rotation.z = 0.12;
  const armR = armL.clone();
  armR.position.x = 0.33;
  armR.rotation.z = -0.12;
  g.add(armL, armR);

  const handL = box(0.15, 0.14, 0.17, skin);
  handL.position.set(-0.35, 0.56, 0);
  const handR = handL.clone();
  handR.position.x = 0.35;
  g.add(handL, handR);
}

function addClassProp(g: THREE.Group, spec?: Specialization) {
  if (spec === "CEREALIER") {
    const stalk = cyl(0.02, 0.02, 0.7, 5, FLAT("#c9a227"));
    stalk.position.set(0.4, 0.85, 0.1);
    stalk.rotation.z = -0.22;
    const ear = cyl(0.07, 0.02, 0.24, 6, FLAT("#e8c85a"));
    ear.position.set(0.47, 1.24, 0.1);
    ear.rotation.z = -0.22;
    g.add(stalk, ear);
  }
  if (spec === "ELEVEUR") {
    const calf = new THREE.Group();
    const body = box(0.42, 0.24, 0.24, FLAT("#f2ece1"));
    body.position.y = 0.26;
    const patch = box(0.16, 0.12, 0.25, FLAT("#4a3527"));
    patch.position.set(0.06, 0.31, 0);
    const headC = box(0.2, 0.18, 0.18, FLAT("#f2ece1"));
    headC.position.set(-0.29, 0.32, 0);
    const snout = box(0.09, 0.1, 0.12, FLAT("#e0b6ac"));
    snout.position.set(-0.4, 0.28, 0);
    calf.add(body, patch, headC, snout);
    for (const [lx, lz] of [
      [-0.14, 0.08],
      [-0.14, -0.08],
      [0.14, 0.08],
      [0.14, -0.08],
    ]) {
      const leg = box(0.07, 0.18, 0.07, FLAT("#d9d2c6"));
      leg.position.set(lx, 0.09, lz);
      calf.add(leg);
    }
    calf.position.set(0.62, 0, 0.18);
    calf.rotation.y = -0.5;
    calf.scale.setScalar(0.86);
    g.add(calf);
  }
}

/** Personnage low-poly assemblé à partir des indices d'apparence. */
export function buildCharacter(
  appearance: CharacterAppearance,
  opts: { spec?: Specialization; prop?: boolean } = {},
): THREE.Group {
  const g = new THREE.Group();
  const skin = FLAT(SKIN_TONES[appearance.skin]?.hex ?? "#e8b58a");
  const cloth = FLAT(CLOTH_COLORS[appearance.clothColor]?.hex ?? "#3f8f52");
  const accent = FLAT(ACCENT_COLORS[appearance.accentColor]?.hex ?? "#d9b23c");

  addClothes(g, appearance, cloth, accent, skin);

  const neck = box(0.16, 0.1, 0.16, skin);
  neck.position.y = 1.15;
  g.add(neck);

  const head = box(0.36, 0.36, 0.34, skin);
  head.position.y = 1.37;
  g.add(head);

  addEars(g, appearance, skin);
  addEyes(g, appearance, skin);
  addNose(g, appearance, skin);
  addMouth(g, appearance);
  addHat(g, appearance);
  if (opts.prop) addClassProp(g, opts.spec);
  return g;
}
