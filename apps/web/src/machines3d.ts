import * as THREE from "three";
import type { MachineType } from "@farmsim/shared";
import { markShared } from "./three-cleanup";
import {
  HALF,
  Part,
  ball,
  box,
  cone,
  createMaterials,
  cyl,
  extrude,
  lathe,
  place,
  ring,
  roundedBox,
  shell,
  tube,
  wheelPart,
  type Materials,
  type Palette,
  type Role,
  type Vec3,
} from "./machine-kit";

/**
 * Le parc matériel : tracteur, moissonneuse, épandeur, déchaumeur.
 *
 * Deux exigences commandent ce module.
 *
 * **La machine doit tenir de près.** Tôles galbées, arêtes cassées, pneus et
 * jantes tournés au tour, calandre à lames, cabine vitrée, relevage complet,
 * flexibles courbés : le vocabulaire de formes est dans `machine-kit.ts`. Le
 * rendu est PBR — peinture vernie, chrome, fonte mate, verre teinté — et la
 * scène doit fournir un environnement (`attachStudioEnvironment`).
 *
 * **La machine doit vivre.** Un engin n'est pas un maillage figé mais un
 * *rig* : roues, essieu directeur, rabatteur, vis de déchargement, disques
 * d'épandage, trains de disques et gyrophare sont des nœuds animés. Le
 * pilotage vient de la **distance parcourue**, jamais du temps qui passe :
 * les roues tournent exactement à la vitesse de l'engin, et calent avec lui.
 *
 * Le coût est tenu par la fusion des pièces par matière et par un cache de
 * plans de montage : construire un engin ne crée que des maillages et des
 * matériaux, la géométrie étant calculée une fois pour toutes.
 *
 * Repère local : l'engin avance vers **+X**, le sol est à **y = 0**.
 */

const PALETTES: Record<MachineType, Palette> = {
  TRACTOR: { body: 0x37901c, bodyDark: 0x23601a, trim: 0x1d4d14, rim: 0xe4b41c, grain: 0xd8b25a },
  HARVESTER: { body: 0xc42f22, bodyDark: 0x8e211a, trim: 0x24262a, rim: 0xe4b41c, grain: 0xdcb03c },
  SPREADER: { body: 0x8b9199, bodyDark: 0x5f656c, trim: 0x3f444a, rim: 0xe0ac1c, grain: 0xd9d3c4 },
  DISC_HARROW: { body: 0x9a5f33, bodyDark: 0x6f4322, trim: 0x53341b, rim: 0x8a5f38, grain: 0xd8c9a8 },
};

/* ------------------------------------------------------------------ */
/* Tracteur                                                            */
/* ------------------------------------------------------------------ */

const REAR_R = 0.235;
const REAR_W = 0.175;
const FRONT_R = 0.15;
const FRONT_W = 0.125;

function buildTractor(): Blueprint {
  const root = new Part();

  /* — Transmission, ponts, carters ————————————————————————— */
  root.add(
    "cast",
    roundedBox(0.52, 0.2, 0.32, 0.05, [-0.1, 0.32, 0]),
    roundedBox(0.24, 0.17, 0.27, 0.05, [0.2, 0.3, 0]),
    cyl(0.045, 0.045, 0.44, 12, [0.36, 0.26, 0], [HALF, 0, 0]),
    roundedBox(0.12, 0.12, 0.16, 0.03, [0.36, 0.3, 0]),
  );
  root.add("paintDark", roundedBox(0.3, 0.16, 0.1, 0.04, [-0.12, 0.36, 0.2]));

  /* — Capot : un profil de côté galbé, pas un pavé ————————————— */
  root.add(
    "paint",
    extrude(
      [
        [-0.04, 0.3],
        [0.48, 0.3],
        [0.56, 0.335],
        [0.575, 0.41],
        [0.545, 0.48],
        [0.44, 0.53],
        [0.12, 0.555],
        [-0.04, 0.555],
      ],
      0.31,
      [0, 0, 0],
    ),
  );
  root.add("paintDark", box(0.34, 0.035, 0.325, [0.22, 0.38, 0]));
  const louvres: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    for (const z of [0.163, -0.163] as const) {
      louvres.push(box(0.14, 0.014, 0.008, [0.3 - i * 0.055, 0.44, z]));
    }
  }
  root.add("plastic", ...louvres);

  /* — Calandre, phares, contrepoids ————————————————————————— */
  root.add("plastic", roundedBox(0.03, 0.16, 0.26, 0.03, [0.568, 0.39, 0]));
  const slats: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) slats.push(box(0.012, 0.012, 0.24, [0.585, 0.33 + i * 0.024, 0]));
  root.add("chrome", ...slats);
  for (const z of [0.105, -0.105] as const) {
    root.add("chrome", ring(0.034, 0.008, 14, Math.PI * 2, [0.556, 0.47, z], [0, HALF, 0]));
    root.add("lamp", cyl(0.03, 0.03, 0.02, 14, [0.553, 0.47, z], [0, 0, HALF]));
  }
  root.add("steel", roundedBox(0.05, 0.1, 0.26, 0.02, [0.6, 0.28, 0]));
  const weights: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    weights.push(roundedBox(0.045, 0.1, 0.042, 0.012, [0.632, 0.27, -0.096 + i * 0.048]));
  }
  root.add("cast", ...weights);

  /* — Échappement ————————————————————————————————————— */
  root.add(
    "plastic",
    cyl(0.026, 0.03, 0.34, 16, [0.4, 0.72, 0.126]),
    cyl(0.034, 0.034, 0.12, 16, [0.4, 0.62, 0.126]),
  );
  root.add("chrome", cyl(0.03, 0.026, 0.06, 16, [0.4, 0.9, 0.126], [0, 0, 0.22]));

  /* — Cabine ——————————————————————————————————————— */
  const cabFloor = 0.46;
  const cabTop = 0.78;
  root.add("cast", roundedBox(0.44, 0.04, 0.42, 0.03, [-0.08, cabFloor, 0]));
  for (const [x, z] of [
    [-0.26, 0.2],
    [-0.26, -0.2],
    [0.12, 0.2],
    [0.12, -0.2],
  ] as const) {
    root.add("paintDark", cyl(0.017, 0.017, cabTop - cabFloor, 10, [x, (cabFloor + cabTop) / 2, z]));
  }
  root.add(
    "paintDark",
    box(0.4, 0.022, 0.022, [-0.07, cabTop, 0.2]),
    box(0.4, 0.022, 0.022, [-0.07, cabTop, -0.2]),
  );
  root.add(
    "paint",
    roundedBox(0.5, 0.055, 0.48, 0.06, [-0.07, cabTop + 0.04, 0]),
    box(0.07, 0.02, 0.42, [0.19, cabTop + 0.05, 0], [0, 0, -0.12]),
    // Panneaux bas : la cabine est fermée sous la ligne de vitrage.
    roundedBox(0.38, 0.11, 0.022, 0.02, [-0.07, 0.52, 0.2]),
    roundedBox(0.38, 0.11, 0.022, 0.02, [-0.07, 0.52, -0.2]),
    roundedBox(0.022, 0.11, 0.38, 0.02, [-0.262, 0.52, 0]),
  );
  root.add(
    "glass",
    box(0.02, 0.2, 0.37, [0.117, 0.67, 0], [0, 0, 0.12]),
    box(0.02, 0.2, 0.37, [-0.262, 0.67, 0]),
    box(0.35, 0.2, 0.018, [-0.07, 0.67, 0.198]),
    box(0.35, 0.2, 0.018, [-0.07, 0.67, -0.198]),
  );
  root.add("chrome", ring(0.03, 0.006, 8, Math.PI, [-0.05, 0.56, 0.213], [HALF, 0, 0]));
  root.add(
    "plastic",
    cyl(0.006, 0.006, 0.1, 6, [0.15, 0.52, 0.06], [0, 0, 0.9]),
    box(0.012, 0.006, 0.14, [0.13, 0.56, 0.06], [0, 0, 0.9]),
  );
  for (const z of [0.235, -0.235] as const) {
    root.add("steel", cyl(0.008, 0.008, 0.12, 8, [0.13, cabTop + 0.03, z * 0.86], [HALF, 0, 0.4]));
    root.add("plastic", roundedBox(0.02, 0.09, 0.06, 0.015, [0.13, cabTop - 0.02, z]));
  }
  for (const z of [0.15, -0.15] as const) {
    root.add("plastic", roundedBox(0.05, 0.04, 0.06, 0.012, [0.16, cabTop + 0.07, z]));
    root.add("lamp", box(0.012, 0.03, 0.05, [0.187, cabTop + 0.07, z]));
  }
  root
    .child([-0.22, cabTop + 0.08, 0.16], { role: "beacon" })
    .add("steel", cyl(0.022, 0.022, 0.02, 10, [0, 0, 0]))
    .add("beacon", cyl(0.026, 0.03, 0.05, 12, [0, 0.03, 0]));

  /* — Poste de conduite ————————————————————————————————— */
  root.add(
    "seat",
    roundedBox(0.17, 0.05, 0.2, 0.03, [-0.14, 0.55, 0]),
    roundedBox(0.05, 0.2, 0.19, 0.03, [-0.22, 0.63, 0]),
  );
  root.add("plastic", cyl(0.05, 0.06, 0.06, 10, [-0.14, 0.5, 0]));
  root.add("steel", cyl(0.014, 0.014, 0.14, 8, [0.04, 0.58, 0], [0, 0, 0.55]));
  root.add("plastic", ring(0.055, 0.012, 16, Math.PI * 2, [0.09, 0.64, 0], [0, HALF, 1.02]));
  root.add("plastic", roundedBox(0.1, 0.07, 0.22, 0.02, [0.1, 0.53, 0], [0, 0, -0.3]));
  root.add(
    "steel",
    cyl(0.007, 0.007, 0.09, 6, [-0.04, 0.56, 0.13], [0, 0, 0.25]),
    cyl(0.007, 0.007, 0.07, 6, [-0.08, 0.55, 0.13], [0, 0, 0.25]),
  );

  /* — Garde-boue et marchepieds ————————————————————————— */
  for (const z of [0.238, -0.238] as const) {
    const from = Math.PI * 0.1;
    const span = Math.PI * 0.72;
    root.add("paint", shell(REAR_R + 0.03, REAR_W + 0.012, from, span, [-0.26, REAR_R, z]));
    root.add(
      "paintDark",
      ring(REAR_R + 0.03, 0.007, 24, span, [-0.26, REAR_R, z + (z > 0 ? 0.007 : -0.007)], [0, 0, from]),
    );
    root.add("paint", roundedBox(0.2, 0.016, REAR_W + 0.01, 0.008, [-0.26, REAR_R + 0.032, z]));
    root.add(
      "steel",
      roundedBox(0.16, 0.014, 0.07, 0.01, [-0.09, 0.34, z * 0.95]),
      cyl(0.009, 0.009, 0.12, 6, [-0.09, 0.4, z * 0.95]),
    );
  }

  /* — Relevage trois points, prise de force, flexibles ——————————— */
  for (const z of [0.12, -0.12] as const) {
    root.add(
      "steel",
      roundedBox(0.26, 0.045, 0.05, 0.015, [-0.5, 0.2, z], [0, 0, 0.12]),
      cyl(0.011, 0.011, 0.16, 8, [-0.44, 0.31, z], [0, 0, 0.14]),
    );
    root.add("cast", ball(0.026, [-0.62, 0.185, z]));
  }
  root.add(
    "steel",
    cyl(0.016, 0.016, 0.2, 10, [-0.5, 0.36, 0], [0, 0, 1.25]),
    cyl(0.024, 0.024, 0.06, 10, [-0.5, 0.36, 0], [0, 0, 1.25]),
    cyl(0.03, 0.03, 0.07, 12, [-0.6, 0.26, 0], [0, 0, HALF]),
  );
  root.add("cast", ball(0.024, [-0.58, 0.31, 0]), ball(0.024, [-0.42, 0.42, 0]));
  const splines: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    splines.push(
      box(0.07, 0.008, 0.008, [-0.6, 0.26 + Math.sin(a) * 0.03, Math.cos(a) * 0.03], [a, 0, 0]),
    );
  }
  root.add("steel", ...splines);
  root.add("cast", cyl(0.05, 0.05, 0.03, 12, [-0.565, 0.26, 0], [0, 0, HALF]));
  for (const z of [0.06, -0.06] as const) {
    root.add("chrome", cyl(0.012, 0.012, 0.05, 8, [-0.42, 0.44, z], [0, 0, HALF]));
    root.add(
      "plastic",
      tube(
        [
          [-0.44, 0.44, z],
          [-0.52, 0.42, z * 1.4],
          [-0.58, 0.33, z * 1.6],
          [-0.6, 0.24, z * 1.5],
        ],
        0.009,
      ),
    );
  }
  for (const z of [0.16, -0.16] as const) {
    root.add("plastic", roundedBox(0.03, 0.05, 0.06, 0.012, [-0.55, 0.42, z]));
    root.add("tail", box(0.01, 0.035, 0.045, [-0.567, 0.42, z]));
  }
  root.add(
    "steel",
    roundedBox(0.16, 0.03, 0.05, 0.012, [-0.56, 0.16, 0]),
    ring(0.028, 0.008, 10, Math.PI * 2, [-0.64, 0.16, 0], [HALF, 0, 0]),
  );

  /* — Trains roulants ————————————————————————————————— */
  for (const z of [0.238, -0.238] as const) {
    root
      .child([-0.26, REAR_R, z], { role: "wheel", radius: REAR_R })
      .attach(wheelPart(REAR_R, REAR_W, 14));
  }
  const steer = root.child([0.36, FRONT_R, 0], { role: "steer" });
  for (const z of [0.208, -0.208] as const) {
    steer.child([0, 0, z], { role: "wheel", radius: FRONT_R }).attach(wheelPart(FRONT_R, FRONT_W, 12));
    steer.add("cast", cyl(0.022, 0.022, 0.06, 10, [0, 0, z * 0.72], [HALF, 0, 0]));
    steer.add(
      "paint",
      shell(FRONT_R + 0.03, FRONT_W + 0.018, Math.PI * 0.12, Math.PI * 0.66, [0, 0, z], 20),
    );
  }

  return { root, length: 1.35, hitch: [-0.64, 0.16, 0], eye: [0, 0, 0] };
}

/* ------------------------------------------------------------------ */
/* Moissonneuse                                                        */
/* ------------------------------------------------------------------ */

function buildHarvester(): Blueprint {
  const root = new Part();
  const DRIVE_R = 0.25;
  const DRIVE_W = 0.2;
  const STEER_R = 0.135;

  /* — Caisse : un profil de côté, capot moteur incliné à l'arrière —— */
  root.add(
    "paint",
    extrude(
      [
        [-0.78, 0.3],
        [0.34, 0.3],
        [0.46, 0.37],
        [0.46, 0.54],
        [0.3, 0.62],
        [-0.4, 0.64],
        [-0.64, 0.58],
        [-0.78, 0.46],
      ],
      0.5,
      [0, 0, 0],
    ),
  );
  root.add("paintDark", roundedBox(1.1, 0.09, 0.52, 0.03, [-0.2, 0.29, 0]));
  // Grille de refroidissement et broyeur de paille
  root.add("plastic", roundedBox(0.03, 0.2, 0.34, 0.03, [-0.79, 0.44, 0]));
  const grid: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) grid.push(box(0.012, 0.012, 0.3, [-0.805, 0.37 + i * 0.035, 0]));
  root.add("steel", ...grid);
  root.add("cast", roundedBox(0.12, 0.18, 0.46, 0.04, [-0.86, 0.34, 0]));

  /* — Trémie à grain : caisse évasée, rambarde, blé qui affleure ——— */
  root.add(
    "paint",
    extrude(
      [
        [-0.44, 0.63],
        [0.16, 0.63],
        [0.22, 0.86],
        [-0.5, 0.86],
      ],
      0.54,
      [0, 0, 0],
    ),
  );
  root.add(
    "trim",
    roundedBox(0.74, 0.03, 0.035, 0.012, [-0.14, 0.88, 0.27]),
    roundedBox(0.74, 0.03, 0.035, 0.012, [-0.14, 0.88, -0.27]),
    roundedBox(0.035, 0.03, 0.54, 0.012, [-0.5, 0.88, 0]),
    roundedBox(0.035, 0.03, 0.54, 0.012, [0.21, 0.88, 0]),
  );
  root.add("grain", roundedBox(0.66, 0.04, 0.48, 0.03, [-0.15, 0.845, 0]));

  /* — Cabine avancée ————————————————————————————————— */
  const cabY = 0.62;
  const cabTop = 0.94;
  root.add("cast", roundedBox(0.4, 0.04, 0.44, 0.03, [0.3, cabY, 0]));
  for (const [x, z] of [
    [0.14, 0.21],
    [0.14, -0.21],
    [0.46, 0.21],
    [0.46, -0.21],
  ] as const) {
    root.add("trim", cyl(0.018, 0.018, cabTop - cabY, 10, [x, (cabY + cabTop) / 2, z]));
  }
  root.add(
    "trim",
    roundedBox(0.46, 0.055, 0.5, 0.06, [0.3, cabTop + 0.04, 0]),
    roundedBox(0.34, 0.1, 0.02, 0.02, [0.3, cabY + 0.06, 0.215]),
    roundedBox(0.34, 0.1, 0.02, 0.02, [0.3, cabY + 0.06, -0.215]),
  );
  root.add(
    "glass",
    box(0.02, 0.22, 0.4, [0.475, 0.78, 0], [0, 0, -0.1]),
    box(0.02, 0.22, 0.4, [0.135, 0.78, 0]),
    box(0.32, 0.22, 0.018, [0.3, 0.78, 0.208]),
    box(0.32, 0.22, 0.018, [0.3, 0.78, -0.208]),
  );
  for (const z of [0.18, -0.18] as const) {
    root.add("plastic", roundedBox(0.05, 0.04, 0.06, 0.012, [0.46, cabTop + 0.07, z]));
    root.add("lamp", box(0.012, 0.03, 0.05, [0.487, cabTop + 0.07, z]));
    root
      .child([0.14, cabTop + 0.08, z], { role: "beacon" })
      .add("steel", cyl(0.02, 0.02, 0.02, 10, [0, 0, 0]))
      .add("beacon", cyl(0.024, 0.028, 0.045, 12, [0, 0.03, 0]));
  }
  // Échelle d'accès et main courante
  for (const z of [0.28] as const) {
    root.add(
      "steel",
      tube(
        [
          [0.14, 0.62, z],
          [0.1, 0.72, z + 0.02],
          [0.1, 0.86, z + 0.02],
        ],
        0.008,
      ),
    );
    for (let i = 0; i < 3; i++) {
      root.add("steel", box(0.1, 0.012, 0.012, [0.02, 0.3 + i * 0.1, z]));
    }
    root.add("steel", cyl(0.008, 0.008, 0.34, 6, [-0.03, 0.44, z]), cyl(0.008, 0.008, 0.34, 6, [0.07, 0.44, z]));
  }

  /* — Convoyeur et bec de coupe ————————————————————————— */
  root.add(
    "paintDark",
    extrude(
      [
        [0.44, 0.3],
        [0.44, 0.54],
        [0.78, 0.42],
        [0.78, 0.22],
      ],
      0.38,
      [0, 0, 0],
    ),
  );

  const header = root.child([0.86, 0, 0], { role: "tool" });
  header.add(
    "paint",
    extrude(
      [
        [-0.1, 0.14],
        [0.24, 0.14],
        [0.32, 0.24],
        [0.3, 0.5],
        [-0.1, 0.5],
      ],
      1.1,
      [0, 0, 0],
    ),
  );
  // Auge de vis d'alimentation, au fond du bec
  header.add("paintDark", cyl(0.1, 0.1, 1.02, 14, [0.04, 0.26, 0], [HALF, 0, 0]));
  header.add("rim", roundedBox(0.12, 0.045, 1.08, 0.018, [0.34, 0.15, 0]));
  const sections: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 15; i++) {
    sections.push(cone(0.032, 0.07, 4, [0.41, 0.15, -0.49 + i * 0.07], [0, 0, -HALF]));
  }
  header.add("steel", ...sections);
  // Diviseurs et bras de rabatteur
  for (const z of [0.56, -0.56] as const) {
    header.add("rim", cone(0.07, 0.28, 6, [0.24, 0.22, z], [0, 0, -HALF]));
    header.add("paintDark", roundedBox(0.3, 0.05, 0.05, 0.018, [0.06, 0.54, z * 0.78]));
  }

  const reel = header.child([0.2, 0.54, 0], { role: "reel", radius: 0.15 });
  const bats: THREE.BufferGeometry[] = [];
  const tines: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const bx = Math.cos(a) * 0.14;
    const by = Math.sin(a) * 0.14;
    bats.push(roundedBox(0.035, 0.035, 0.92, 0.012, [bx, by, 0]));
    for (let j = 0; j < 5; j++) {
      const z = -0.38 + j * 0.19;
      tines.push(cyl(0.006, 0.004, 0.09, 5, [bx * 1.16, by * 1.16 - 0.03, z], [0, 0, a]));
    }
  }
  reel.add("steel", ...bats);
  reel.add("rim", ...tines);
  for (const z of [0.46, -0.46] as const) {
    reel.add(
      "steel",
      lathe(
        [
          [0.02, 0],
          [0.14, 0],
          [0.14, 0.02],
          [0.02, 0.02],
        ],
        14,
        [0, 0, z],
      ),
    );
  }

  /* — Vis de déchargement ————————————————————————————— */
  const auger = root.child([-0.3, 0.9, 0.2], { role: "auger" });
  auger.add("paint", cyl(0.06, 0.06, 0.74, 14, [-0.36, 0.02, 0], [0, 0, HALF]));
  auger.add(
    "cast",
    roundedBox(0.12, 0.14, 0.12, 0.03, [-0.72, -0.05, 0]),
    cyl(0.05, 0.05, 0.13, 10, [-0.02, -0.06, 0]),
  );
  auger.add("steel", roundedBox(0.18, 0.03, 0.03, 0.01, [-0.16, 0.08, 0]));

  /* — Trains roulants ————————————————————————————————— */
  for (const z of [0.28, -0.28] as const) {
    root
      .child([0.12, DRIVE_R, z], { role: "wheel", radius: DRIVE_R })
      .attach(wheelPart(DRIVE_R, DRIVE_W, 16));
  }
  const steer = root.child([-0.58, STEER_R, 0], { role: "steer" });
  for (const z of [0.19, -0.19] as const) {
    steer.child([0, 0, z], { role: "wheel", radius: STEER_R }).attach(wheelPart(STEER_R, 0.11, 10));
  }
  steer.add("cast", cyl(0.03, 0.03, 0.34, 10, [0, 0, 0], [HALF, 0, 0]));

  return { root, length: 1.95, hitch: [-0.9, 0.3, 0], eye: [0, 0, 0] };
}

/* ------------------------------------------------------------------ */
/* Épandeur                                                            */
/* ------------------------------------------------------------------ */

/**
 * Outil traîné : son origine est **l'anneau d'attelage**. Le reste se
 * développe vers les X négatifs, ce qui permet de l'accrocher derrière un
 * tracteur en posant son anneau sur la chape.
 */
function buildSpreader(): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.17;
  const CX = -0.46;

  /* — Flèche, anneau, béquille ————————————————————————— */
  root.add("rim", roundedBox(0.34, 0.07, 0.08, 0.02, [-0.17, 0.3, 0]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.3, 0], [HALF, 0, 0]));
  root.add(
    "steel",
    cyl(0.018, 0.018, 0.2, 8, [-0.1, 0.2, 0.07]),
    roundedBox(0.07, 0.02, 0.07, 0.012, [-0.1, 0.11, 0.07]),
  );

  /* — Châssis : deux longerons, la trémie posée dessus ——————— */
  root.add(
    "rim",
    roundedBox(0.58, 0.07, 0.09, 0.02, [CX, 0.31, 0.2]),
    roundedBox(0.58, 0.07, 0.09, 0.02, [CX, 0.31, -0.2]),
    roundedBox(0.09, 0.07, 0.48, 0.02, [CX + 0.24, 0.31, 0]),
    roundedBox(0.09, 0.07, 0.48, 0.02, [CX - 0.24, 0.31, 0]),
    roundedBox(0.3, 0.06, 0.09, 0.02, [CX - 0.34, 0.31, 0.17]),
    roundedBox(0.3, 0.06, 0.09, 0.02, [CX - 0.34, 0.31, -0.17]),
  );

  /* — Trémie : un V transversal, le profil réel d'un épandeur ——— */
  root.add(
    "paint",
    extrude(
      [
        [-0.08, 0.34],
        [0.08, 0.34],
        [0.32, 0.74],
        [-0.32, 0.74],
      ],
      0.56,
      [CX, 0, 0],
      [0, HALF, 0],
    ),
  );
  root.add(
    "rim",
    roundedBox(0.6, 0.035, 0.04, 0.012, [CX, 0.755, 0.31]),
    roundedBox(0.6, 0.035, 0.04, 0.012, [CX, 0.755, -0.31]),
    roundedBox(0.04, 0.035, 0.66, 0.012, [CX + 0.29, 0.755, 0]),
    roundedBox(0.04, 0.035, 0.66, 0.012, [CX - 0.29, 0.755, 0]),
  );
  root.add("grain", roundedBox(0.5, 0.04, 0.5, 0.03, [CX, 0.7, 0]));
  root.add(
    "paintDark",
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX + 0.2, 0.54, 0.27], [0, 0, 0.12]),
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX - 0.2, 0.54, 0.27], [0, 0, 0.12]),
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX + 0.2, 0.54, -0.27], [0, 0, 0.12]),
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX - 0.2, 0.54, -0.27], [0, 0, 0.12]),
  );

  /* — Descentes et disques d'épandage ————————————————————— */
  root.add(
    "plastic",
    cone(0.06, 0.14, 10, [CX - 0.32, 0.31, 0.16], [Math.PI, 0, 0]),
    cone(0.06, 0.14, 10, [CX - 0.32, 0.31, -0.16], [Math.PI, 0, 0]),
  );
  for (const [z, dir] of [
    [0.16, 1],
    [-0.16, -1],
  ] as const) {
    const disc = root.child([CX - 0.32, 0.2, z], { role: "spinner", spin: dir });
    disc.add(
      "steel",
      lathe(
        [
          [0.02, 0],
          [0.115, -0.008],
          [0.115, 0.006],
          [0.02, 0.012],
        ],
        16,
        [0, 0, 0],
        [0, 0, 0],
      ),
    );
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      disc.add(
        "rim",
        roundedBox(0.018, 0.035, 0.085, 0.008, [Math.cos(a) * 0.055, 0.024, Math.sin(a) * 0.055], [0, -a, 0]),
      );
    }
    disc.add("chrome", cyl(0.018, 0.018, 0.05, 8, [0, 0.025, 0]));
  }

  /* — Essieu, roues, garde-boue ————————————————————————— */
  root.add("cast", cyl(0.035, 0.035, 0.76, 10, [CX + 0.02, WHEEL_R, 0], [HALF, 0, 0]));
  for (const z of [0.38, -0.38] as const) {
    root
      .child([CX + 0.02, WHEEL_R, z], { role: "wheel", radius: WHEEL_R })
      .attach(wheelPart(WHEEL_R, 0.13, 12));
    root.add(
      "paint",
      shell(WHEEL_R + 0.028, 0.145, Math.PI * 0.12, Math.PI * 0.66, [CX + 0.02, WHEEL_R, z]),
    );
  }

  return { root, length: 1.1, hitch: [-0.95, 0.3, 0], eye: [0.01, 0.3, 0] };
}

/* ------------------------------------------------------------------ */
/* Déchaumeur à disques                                                */
/* ------------------------------------------------------------------ */

function buildDiscHarrow(): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.16;
  const DISC_R = 0.16;

  /* — Flèche, anneau, béquille ————————————————————————— */
  root.add("paint", roundedBox(0.36, 0.08, 0.09, 0.025, [-0.18, 0.36, 0]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.36, 0], [HALF, 0, 0]));
  root.add("steel", cyl(0.018, 0.018, 0.22, 8, [-0.12, 0.25, 0.08]));

  /* — Cadre : longerons, traverse, contreventement ——————————— */
  root.add(
    "paint",
    roundedBox(0.78, 0.075, 0.085, 0.02, [-0.6, 0.46, 0.22]),
    roundedBox(0.78, 0.075, 0.085, 0.02, [-0.6, 0.46, -0.22]),
    roundedBox(0.09, 0.075, 0.52, 0.02, [-0.94, 0.46, 0]),
    roundedBox(0.09, 0.075, 0.52, 0.02, [-0.3, 0.46, 0]),
  );
  root.add(
    "paintDark",
    roundedBox(0.44, 0.05, 0.05, 0.015, [-0.26, 0.46, 0.14], [0, 0.68, 0]),
    roundedBox(0.44, 0.05, 0.05, 0.015, [-0.26, 0.46, -0.14], [0, -0.68, 0]),
  );

  /* — Deux trains de disques, inclinés en sens inverse ——————— */
  for (const [x, yaw, dir] of [
    [-0.42, 0.42, 1],
    [-0.8, -0.42, -1],
  ] as const) {
    // Porte-disques : il descend au travail, remonte en transport.
    const tool = root.child([x, 0, 0], { role: "tool" });
    tool.add(
      "paintDark",
      roundedBox(0.07, 0.34, 0.07, 0.02, [0, 0.3, 0.18]),
      roundedBox(0.07, 0.34, 0.07, 0.02, [0, 0.3, -0.18]),
    );
    const gang = tool.child([0, 0.17, 0], { rot: [0, yaw, 0], role: "gang", radius: DISC_R, spin: dir });
    gang.add("cast", cyl(0.026, 0.026, 0.7, 10, [0, 0, 0], [HALF, 0, 0]));
    for (let i = 0; i < 5; i++) {
      const z = -0.3 + i * 0.15;
      // Un disque de déchaumeur est une calotte, pas une rondelle : la
      // concavité est ce qui retourne la terre, et ce qui accroche la
      // lumière par la tranche.
      gang.add(
        "steel",
        lathe(
          [
            [0.03, 0.012],
            [0.08, 0.004],
            [0.13, -0.012],
            [DISC_R, -0.036],
            [DISC_R, -0.05],
            [0.13, -0.026],
            [0.08, -0.01],
            [0.03, -0.002],
          ],
          20,
          [0, 0, z],
        ),
      );
      gang.add("cast", cyl(0.042, 0.042, 0.04, 10, [0, 0, z], [HALF, 0, 0]));
    }
  }

  /* — Roues de transport sur chandelles ————————————————— */
  root.add("cast", cyl(0.032, 0.032, 0.82, 10, [-0.98, WHEEL_R, 0], [HALF, 0, 0]));
  for (const z of [0.42, -0.42] as const) {
    root
      .child([-0.98, WHEEL_R, z], { role: "wheel", radius: WHEEL_R })
      .attach(wheelPart(WHEEL_R, 0.115, 11));
    root.add("paint", roundedBox(0.09, 0.34, 0.08, 0.02, [-0.98, WHEEL_R + 0.19, z * 0.8]));
  }

  return { root, length: 1.2, hitch: [-1.1, 0.36, 0], eye: [0.01, 0.36, 0] };
}

/* ------------------------------------------------------------------ */
/* Plans de montage                                                    */
/* ------------------------------------------------------------------ */

type Blueprint = {
  root: Part;
  /** Emprise au sol, unités monde (1 = une case) */
  length: number;
  /** Point d'attelage arrière */
  hitch: Vec3;
  /** Anneau d'attelage d'un outil traîné, dans son propre repère */
  eye: Vec3;
};

const BUILDERS: Record<MachineType, () => Blueprint> = {
  TRACTOR: buildTractor,
  HARVESTER: buildHarvester,
  SPREADER: buildSpreader,
  DISC_HARROW: buildDiscHarrow,
};

const blueprints = new Map<MachineType, Blueprint>();

function blueprint(type: MachineType): Blueprint {
  let bp = blueprints.get(type);
  if (!bp) {
    bp = BUILDERS[type]();
    blueprints.set(type, bp);
  }
  return bp;
}

/** Outils traînés : sans moteur, il leur faut un tracteur. */
const TOWED: MachineType[] = ["SPREADER", "DISC_HARROW"];

export function isTowedImplement(type: MachineType): boolean {
  return TOWED.includes(type);
}

/* ------------------------------------------------------------------ */
/* Rig                                                                 */
/* ------------------------------------------------------------------ */

export type MachineState = {
  /** Temps de scène, secondes */
  t: number;
  /** Distance parcourue depuis le montage, en unités monde */
  distance: number;
  /** Chantier en cours : outil posé, gyrophare, moteur qui vibre */
  working: boolean;
  /** Braquage normalisé, −1 (gauche) à 1 (droite) */
  steer?: number;
  /** Moissonneuse : vis de déchargement déployée */
  unloading?: boolean;
};

export type MachineRigOptions = {
  /** Attelé derrière un tracteur — obligatoire pour un outil au travail */
  towed?: boolean;
  /** Ombres portées */
  shadows?: boolean;
  /** Graine de variation de teinte, pour ne pas cloner deux engins voisins */
  seed?: number;
};

export type MachineRig = {
  /** À ajouter à la scène ; l'appelant en pilote position et rotation */
  group: THREE.Group;
  /** Emprise au sol, unités monde */
  length: number;
  update(state: MachineState): void;
  dispose(): void;
};

type Unit = {
  group: THREE.Group;
  /** Corps suspendu : c'est lui qui vibre, pas le groupe piloté par l'appelant */
  body: THREE.Group;
  roles: Map<Role, THREE.Object3D[]>;
  materials: Materials;
};

function createUnit(type: MachineType, opts: MachineRigOptions): Unit {
  const bp = blueprint(type);
  const materials = createMaterials(PALETTES[type], opts.seed ?? 0);
  const roles = new Map<Role, THREE.Object3D[]>();
  const body = bp.root.build(materials, roles, opts.shadows ?? true);
  const group = new THREE.Group();
  group.add(body);
  return { group, body, roles, materials };
}

function animateUnit(unit: Unit, s: Required<MachineState>) {
  const { roles } = unit;

  // Roues : la rotation vient de la distance, pas du temps. Un engin à
  // l'arrêt a des roues immobiles — le détail que l'œil repère aussitôt.
  for (const w of roles.get("wheel") ?? []) {
    const r = (w.userData.radius as number) || 0.2;
    w.rotation.z = -s.distance / r;
  }
  for (const st of roles.get("steer") ?? []) {
    st.rotation.y += (s.steer * 0.34 - st.rotation.y) * 0.18;
  }

  // Rabatteur : un peu plus vite que l'avance, sinon il patine sur les épis.
  for (const reel of roles.get("reel") ?? []) {
    const r = (reel.userData.radius as number) || 0.15;
    reel.rotation.z = -(s.distance * 1.25) / r - (s.working ? s.t * 1.6 : 0);
  }

  // Trains de disques : entraînés par le sol, donc par la distance.
  for (const gang of roles.get("gang") ?? []) {
    const r = (gang.userData.radius as number) || 0.16;
    const dir = (gang.userData.spin as number) || 1;
    gang.rotation.z = (-s.distance / r) * dir;
  }

  // Disques d'épandage : entraînés par la prise de force, donc par le régime
  // moteur — ils tournent vite et régulièrement, et se figent à l'arrêt.
  if (s.working) {
    for (const sp of roles.get("spinner") ?? []) {
      sp.rotation.y = s.t * 13 * ((sp.userData.spin as number) || 1);
    }
  }

  // Outil : posé au travail, relevé en déplacement.
  for (const tool of roles.get("tool") ?? []) {
    const target = s.working ? 0 : 0.11;
    tool.position.y += (target - tool.position.y) * 0.12;
    tool.rotation.z = -tool.position.y * 0.35;
  }

  // Vis de déchargement : elle pivote sur le côté pour vider la trémie.
  for (const auger of roles.get("auger") ?? []) {
    const target = s.unloading ? -HALF : 0;
    auger.rotation.y += (target - auger.rotation.y) * 0.06;
  }

  // Gyrophare : éteint au repos, battement à ~2 Hz au travail.
  const beacon = unit.materials.beacon as THREE.MeshStandardMaterial;
  beacon.emissiveIntensity = s.working ? 0.35 + Math.abs(Math.sin(s.t * 6.2)) * 1.6 : 0.16;
  for (const b of roles.get("beacon") ?? []) {
    b.scale.setScalar(s.working ? 1 + Math.abs(Math.sin(s.t * 6.2)) * 0.1 : 1);
  }

  // Moteur : vibration fine, uniquement au travail. Sur un engin à l'arrêt
  // elle passerait pour un défaut de rendu.
  unit.body.position.y = s.working ? Math.sin(s.t * 46) * 0.004 : 0;
  unit.body.rotation.z = s.working ? Math.sin(s.t * 31) * 0.003 : 0;
}

/**
 * Monte un engin prêt à animer.
 *
 * Un outil traîné (épandeur, déchaumeur) demandé avec `towed` est livré
 * attelé derrière un tracteur : c'est le seul attelage crédible au champ.
 * Sans `towed`, il est livré dételé, béquille sortie, comme au parc matériel.
 */
export function createMachineRig(type: MachineType, opts: MachineRigOptions = {}): MachineRig {
  const group = new THREE.Group();
  const units: Unit[] = [];
  let length = blueprint(type).length;

  if (opts.towed && isTowedImplement(type)) {
    const tractor = createUnit("TRACTOR", opts);
    const implement = createUnit(type, { ...opts, seed: (opts.seed ?? 0) + 7 });
    // L'anneau de l'outil vient se poser sur la chape du tracteur : attelage
    // jointif, plutôt qu'un outil qui flotte derrière son timon.
    const hitch = blueprint("TRACTOR").hitch;
    const eye = blueprint(type).eye;
    implement.group.position.set(hitch[0] - eye[0], hitch[1] - eye[1], 0);
    group.add(tractor.group, implement.group);
    units.push(tractor, implement);
    length = blueprint("TRACTOR").length + blueprint(type).length;
    // Recentrage : sans cela le tracteur occuperait le milieu de la case et
    // l'outil travaillerait hors du champ.
    for (const child of group.children) child.position.x += length * 0.22;
  } else {
    const unit = createUnit(type, opts);
    group.add(unit.group);
    units.push(unit);
  }

  const state: Required<MachineState> = {
    t: 0,
    distance: 0,
    working: false,
    steer: 0,
    unloading: false,
  };

  return {
    group,
    length,
    update(next: MachineState) {
      state.t = next.t;
      state.distance = next.distance;
      state.working = next.working;
      state.steer = next.steer ?? 0;
      state.unloading = next.unloading ?? false;
      for (const unit of units) animateUnit(unit, state);
    },
    dispose() {
      // Les géométries sont partagées et mises en cache : seuls les matériaux,
      // propres à l'instance, sont à libérer.
      for (const unit of units) for (const m of Object.values(unit.materials)) m.dispose();
      group.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Poussière de travail                                                */
/* ------------------------------------------------------------------ */

export type DustTrail = {
  object: THREE.Object3D;
  /** À appeler à chaque image : `dt` en secondes, position de l'engin */
  update(dt: number, x: number, y: number, z: number, emitting: boolean): void;
  dispose(): void;
};

/** Une seule bouffée de géométrie pour toute l'application. */
let dustGeometry: THREE.IcosahedronGeometry | null = null;

/**
 * Panache derrière un engin au travail — dix bouffées recyclées, jamais plus.
 * C'est le détail qui fait qu'une machine *pèse* sur le sol au lieu de
 * glisser dessus.
 */
export function createDustTrail(count = 8, color = 0xd8c9a8): DustTrail {
  const object = new THREE.Group();
  if (!dustGeometry) dustGeometry = markShared(new THREE.IcosahedronGeometry(0.07, 0));
  const geo = dustGeometry;
  const mat = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const puffs = Array.from({ length: count }, () => {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    object.add(m);
    return { mesh: m, life: 0 };
  });
  let next = 0;
  let cooldown = 0;

  return {
    object,
    update(dt, x, y, z, emitting) {
      cooldown -= dt;
      if (emitting && cooldown <= 0) {
        cooldown = 0.09;
        const puff = puffs[next];
        next = (next + 1) % puffs.length;
        puff.life = 1;
        puff.mesh.position.set(x + (Math.random() - 0.5) * 0.12, y, z + (Math.random() - 0.5) * 0.12);
        puff.mesh.visible = true;
      }
      for (const puff of puffs) {
        if (puff.life <= 0) continue;
        puff.life -= dt * 2;
        if (puff.life <= 0) {
          puff.mesh.visible = false;
          continue;
        }
        puff.mesh.position.y += dt * 0.18;
        puff.mesh.scale.setScalar(1 + (1 - puff.life) * 0.9);
        (puff.mesh.material as THREE.MeshLambertMaterial).opacity = puff.life * 0.35;
      }
    },
    dispose() {
      for (const puff of puffs) (puff.mesh.material as THREE.Material).dispose();
      mat.dispose();
      object.clear();
    },
  };
}
