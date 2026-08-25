import * as THREE from "three";
import { asTier, type MachineType, type MachineTier } from "@farmsim/shared";
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
  // Charrue : la fonte nue et le rouge sombre des charruiers.
  PLOUGH: { body: 0x9d3b2c, bodyDark: 0x6d2820, trim: 0x44342e, rim: 0x8d8f92, grain: 0x8a6a44 },
  // Semoir : le bleu des semoirs, qui ne se confond avec aucun autre outil.
  SEEDER: { body: 0x2f6fa8, bodyDark: 0x1f4d76, trim: 0x2a3138, rim: 0xd8d2c2, grain: 0xd9c47a },
  // Faucheuse : le gris-vert des faneuses, proche du tracteur sans s'y fondre.
  MOWER: { body: 0x5f8f4a, bodyDark: 0x3f6432, trim: 0x2c3a26, rim: 0xd8d2c2, grain: 0x9ec46a },
  // Pulvérisateur : le blanc-crème des cuves, qui tranche sur tout le reste.
  SPRAYER: { body: 0xd8d4c4, bodyDark: 0x9d9a8c, trim: 0x3f4a52, rim: 0xd8d2c2, grain: 0x9ec46a },
  // Remorque : la tôle peinte et le bois des ridelles.
  TRAILER: { body: 0x7b8794, bodyDark: 0x545e69, trim: 0x3a4149, rim: 0x8b5a2b, grain: 0xd9c47a },
  // Presse : le jaune-vert des constructeurs de fenaison, distinct du vert
  // tracteur pour qu'un attelage se lise comme deux engins et non comme un.
  BALER: { body: 0xb9c832, bodyDark: 0x7f8c22, trim: 0x3a3f22, rim: 0xd8d2c2, grain: 0xd9c47a },
  // Ensileuse : l'orange des ensileuses automotrices.
  FORAGE_HARVESTER: {
    body: 0xd97a1e,
    bodyDark: 0x9c5312,
    trim: 0x2a2c30,
    rim: 0xe4b41c,
    grain: 0x9ec46a,
  },
};

/** Valeur par palier. L’entrée T1 est l’ancre : c’est le modèle déjà en jeu. */
function atTier<T>(tier: MachineTier, values: readonly [T, T, T, T, T]): T {
  return values[tier - 1]!;
}

/**
 * Pignon de chenille : moyeu fonte, couronne acier, dents. Ce n’est pas un
 * pneu agricole — un T5 lu de loin doit poser une bande, pas quatre jantes
 * jumelées de plus.
 */
function crawlerSprocket(radius: number, width: number): Part {
  const p = new Part();
  const hw = width * 0.5;
  p.add(
    "cast",
    lathe(
      [
        [radius * 0.2, -hw * 0.58],
        [radius * 0.66, -hw * 0.48],
        [radius * 0.66, hw * 0.48],
        [radius * 0.2, hw * 0.58],
      ],
      14,
      [0, 0, 0],
    ),
  );
  p.add(
    "steel",
    lathe(
      [
        [radius * 0.5, -hw * 0.9],
        [radius * 0.9, -hw * 0.4],
        [radius * 0.9, hw * 0.4],
        [radius * 0.5, hw * 0.9],
      ],
      16,
      [0, 0, 0],
    ),
  );
  const teeth: THREE.BufferGeometry[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    teeth.push(
      box(
        radius * 0.065,
        radius * 0.14,
        width * 0.5,
        [Math.cos(a) * radius * 0.84, Math.sin(a) * radius * 0.84, 0],
        [0, 0, a],
      ),
    );
  }
  p.add("steel", ...teeth);
  p.add("rim", cyl(radius * 0.16, radius * 0.16, width * 0.36, 10, [0, 0, 0], [HALF, 0, 0]));
  return p;
}

/** Galet de bogie : petit cylindre caoutchouc, rôle `wheel` pour l’avance. */
function addTrackRoller(parent: Part, pos: Vec3, radius: number, width: number): void {
  const node = parent.child(pos, { role: "wheel", radius });
  node.add(
    "rubber",
    lathe(
      [
        [radius * 0.4, -width * 0.4],
        [radius, -width * 0.3],
        [radius, width * 0.3],
        [radius * 0.4, width * 0.4],
      ],
      12,
      [0, 0, 0],
    ),
  );
  node.add("cast", cyl(radius * 0.26, radius * 0.26, width * 0.42, 8, [0, 0, 0], [HALF, 0, 0]));
}

/**
 * Un train de chenilles, lu de loin : deux pignons acier, galets, bande
 * de patins. Le bas des patins pose au sol — pas les pignons, légèrement
 * relevés.
 *
 * Le flanc n’est **pas** un pavé de caoutchouc qui remplit le stade : ça
 * collait les quatre trains en deux barres noires. Le bogie reste creux,
 * les patins dessinent l’ovale, les galets se voient au milieu.
 */
function addCrawlerTrack(
  parent: Part,
  x: number,
  z: number,
  span: number,
  radius: number,
  width: number,
): void {
  const padH = 0.022;
  const lift = 0.012;
  const sy = radius + lift;
  for (const dx of [span / 2, -span / 2] as const) {
    parent
      .child([x + dx, sy, z], { role: "wheel", radius })
      .attach(crawlerSprocket(radius, width * 0.7));
  }
  // Bâti du bogie : plus court que la bande, pour laisser voir les pignons.
  parent.add(
    "paintDark",
    roundedBox(span * 0.82, radius * 0.72, width * 0.38, 0.03, [x, sy + radius * 0.08, z]),
  );
  parent.add(
    "cast",
    cyl(0.026, 0.026, span * 0.78, 8, [x, sy * 0.92, z], [0, 0, HALF]),
    roundedBox(0.07, radius * 0.42, width * 0.42, 0.018, [x + span / 2 + radius * 0.08, sy, z]),
  );
  // Capot de bogie, posé sur le train — plus un ventre qui flotte au-dessus.
  parent.add("paint", roundedBox(span * 0.72, 0.04, width * 0.72, 0.014, [x, sy + radius * 0.62, z]));
  // Galets porteurs au sol — c’est le train, pas deux pignons seuls.
  const nRoll = Math.max(3, Math.round(span / 0.16));
  const rollR = radius * 0.34;
  for (let i = 0; i < nRoll; i++) {
    const t = (i + 1) / (nRoll + 1);
    const rx = x - span / 2 + t * span;
    addTrackRoller(parent, [rx, rollR + lift * 0.4, z], rollR, width * 0.78);
  }
  const nRet = Math.max(2, Math.round(span / 0.3));
  for (let i = 0; i < nRet; i++) {
    const t = (i + 1) / (nRet + 1);
    const rx = x - span / 2 + t * span;
    parent.add(
      "cast",
      cyl(radius * 0.2, radius * 0.2, width * 0.5, 10, [rx, sy + radius * 0.48, z], [HALF, 0, 0]),
    );
  }
  // Brins haut et bas : la bande, pas le remplissage du stade.
  parent.add(
    "rubber",
    roundedBox(span, padH, width * 0.96, 0.006, [x, lift, z]),
    roundedBox(span, padH, width * 0.96, 0.006, [x, sy + radius, z]),
  );
  // Chant du brin, tout mince — assez pour lire la bande de profil, pas un slab.
  parent.add(
    "rubber",
    roundedBox(span, padH * 1.4, 0.014, 0.004, [x, lift + padH * 0.2, z + width * 0.48]),
    roundedBox(span, padH * 1.4, 0.014, 0.004, [x, lift + padH * 0.2, z - width * 0.48]),
    roundedBox(span, padH * 1.4, 0.014, 0.004, [x, sy + radius - padH * 0.2, z + width * 0.48]),
    roundedBox(span, padH * 1.4, 0.014, 0.004, [x, sy + radius - padH * 0.2, z - width * 0.48]),
  );
  parent.add(
    "paintDark",
    roundedBox(span * 0.7, radius * 0.18, 0.032, 0.008, [x, sy - radius * 0.12, z]),
  );
  const peri = 2 * span + Math.PI * 2 * radius;
  const nPads = Math.max(24, Math.round(peri / 0.05));
  const padL = (peri / nPads) * 0.84;
  const pads: THREE.BufferGeometry[] = [];
  const grousers: THREE.BufferGeometry[] = [];
  for (let i = 0; i < nPads; i++) {
    const s = (i / nPads) * peri;
    let px: number;
    let py: number;
    let rotZ = 0;
    if (s < span) {
      px = x - span / 2 + s;
      py = lift;
      rotZ = 0;
    } else if (s < span + Math.PI * radius) {
      const a = -HALF + (s - span) / radius;
      px = x + span / 2 + Math.cos(a) * radius;
      py = sy + Math.sin(a) * radius;
      rotZ = a + HALF;
    } else if (s < 2 * span + Math.PI * radius) {
      px = x + span / 2 - (s - span - Math.PI * radius);
      py = sy + radius;
      rotZ = 0;
    } else {
      const a = HALF + (s - 2 * span - Math.PI * radius) / radius;
      px = x - span / 2 + Math.cos(a) * radius;
      py = sy + Math.sin(a) * radius;
      rotZ = a + HALF;
    }
    pads.push(roundedBox(padL, padH, width, 0.004, [px, py, z], [0, 0, rotZ]));
    grousers.push(
      roundedBox(padL * 0.4, padH * 0.55, width * 1.12, 0.003, [px, py, z], [0, 0, rotZ]),
    );
  }
  parent.add("rubber", ...pads, ...grousers);
}

/* ------------------------------------------------------------------ */
/* Tracteur                                                            */
/* ------------------------------------------------------------------ */

const REAR_R = 0.235;
const REAR_W = 0.175;
const FRONT_R = 0.15;
const FRONT_W = 0.125;

function buildTractor(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const tracks = tier >= 5;
  /*
   * Les quatre lignes qui suivent retombent sur la valeur du T1 au palier 5,
   * ce qui ressemble à une régression et n'en est pas : à ce palier
   * `tracks` vaut vrai, la branche à roues n'est pas prise, et ces
   * dimensions ne sont jamais lues. On le note plutôt que de laisser le
   * prochain lecteur — ou le prochain audit — s'y arrêter.
   */
  const rearR = atTier(tier, [REAR_R, 0.242, 0.248, 0.255, REAR_R]);
  const rearW = atTier(tier, [REAR_W, 0.17, 0.168, 0.165, REAR_W]);
  const frontR = atTier(tier, [FRONT_R, 0.155, 0.165, 0.175, FRONT_R]);
  const frontW = atTier(tier, [FRONT_W, 0.126, 0.128, 0.13, FRONT_W]);
  const dual = tier === 4;
  const rearTrack = dual ? ([0.2, 0.38, -0.2, -0.38] as const) : ([0.238, -0.238] as const);
  const fenderTrack = dual ? ([0.38, -0.38] as const) : ([0.238, -0.238] as const);

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
  const nWeights = atTier(tier, [5, 5, 6, 7, 8]);
  const weights: THREE.BufferGeometry[] = [];
  for (let i = 0; i < nWeights; i++) {
    weights.push(
      roundedBox(0.045, 0.1, 0.042, 0.012, [0.632, 0.27, -((nWeights - 1) * 0.048) / 2 + i * 0.048]),
    );
  }
  root.add("cast", ...weights);
  if (tier >= 3) {
    root.add("steel", roundedBox(0.08, 0.14, 0.3, 0.02, [0.66, 0.28, 0]));
  }

  /* — Échappement ————————————————————————————————————— */
  root.add(
    "plastic",
    cyl(0.026, 0.03, 0.34, 16, [0.4, 0.72, 0.126]),
    cyl(0.034, 0.034, 0.12, 16, [0.4, 0.62, 0.126]),
  );
  root.add("chrome", cyl(0.03, 0.026, 0.06, 16, [0.4, 0.9, 0.126], [0, 0, 0.22]));
  root.child([0.4, 0.94, 0.126], { role: "exhaust" });

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
  if (tier >= 2) {
    root.add("plastic", roundedBox(0.22, 0.03, 0.06, 0.01, [-0.07, cabTop + 0.08, 0]));
    for (const z of [0.08, -0.08] as const) {
      root.add("lamp", box(0.04, 0.018, 0.03, [-0.07, cabTop + 0.095, z]));
    }
  }
  if (tier >= 2 && !tracks) {
    // 516 / 6R / 8R : capot plus long qu’un 6105M à nez court.
    root.add(
      "paint",
      roundedBox(0.1, 0.14 + 0.02 * (tier - 2), 0.27 + 0.02 * (tier - 2), 0.03, [
        0.61,
        0.46 + 0.015 * (tier - 2),
        0,
      ]),
    );
  }
  if (tier === 2) {
    // Cabine panoramique 500 Vario : vitrage plus enveloppant.
    root.add("glass", box(0.018, 0.18, 0.4, [0.128, 0.67, 0], [0, 0, 0.08]));
  }
  if (tier >= 3) {
    // 6R : capot plus haut, GPS de série.
    root.add("paint", roundedBox(0.34, 0.055, 0.3, 0.03, [0.2, 0.575, 0]));
    root.add("plastic", roundedBox(0.16, 0.04, 0.48, 0.012, [-0.07, cabTop + 0.075, 0]));
    root.add("plastic", ball(tier >= 4 ? 0.028 : 0.022, [-0.18, cabTop + 0.12, 0]));
    root.add("chrome", cyl(0.01, 0.01, 0.04, 8, [-0.18, cabTop + 0.145, 0]));
    for (const z of [0.18, -0.18] as const) {
      root.add("lamp", box(0.03, 0.016, 0.04, [-0.07, cabTop + 0.1, z]));
    }
  }
  if (tier >= 4) {
    root.add("paint", roundedBox(0.54, 0.04, 0.52, 0.05, [-0.07, cabTop + 0.07, 0]));
    root.add("steel", roundedBox(0.3, 0.02, 0.08, 0.008, [-0.28, cabTop + 0.1, 0]));
  }
  if (tier >= 5) {
    root.add(
      "plastic",
      cyl(0.026, 0.03, 0.34, 16, [0.32, 0.72, -0.126]),
      cyl(0.034, 0.034, 0.12, 16, [0.32, 0.62, -0.126]),
    );
    root.add("chrome", cyl(0.03, 0.026, 0.06, 16, [0.32, 0.9, -0.126], [0, 0, 0.22]));
    // Snorkel d’admission : le géant respire haut.
    root.add(
      "plastic",
      cyl(0.028, 0.032, 0.22, 12, [0.22, 0.68, 0.18]),
      cyl(0.036, 0.036, 0.08, 12, [0.22, 0.8, 0.18], [0, 0, HALF]),
    );
    for (const z of [0.24, -0.24] as const) {
      root.add("steel", cyl(0.01, 0.01, 0.18, 8, [0.16, cabTop + 0.05, z], [HALF, 0, 0.32]));
      root.add("plastic", roundedBox(0.045, 0.09, 0.08, 0.012, [0.18, cabTop + 0.03, z]));
      root.add("lamp", box(0.014, 0.04, 0.055, [0.205, cabTop + 0.03, z]));
    }
    for (const z of [0.12, 0, -0.12] as const) {
      root.add("lamp", box(0.05, 0.02, 0.035, [-0.07, cabTop + 0.12, z]));
    }
  }

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
  if (!tracks) {
    for (const z of fenderTrack) {
      const from = Math.PI * 0.1;
      const span = Math.PI * 0.72;
      root.add("paint", shell(rearR + 0.03, rearW + 0.012, from, span, [-0.26, rearR, z]));
      root.add(
        "paintDark",
        ring(rearR + 0.03, 0.007, 24, span, [-0.26, rearR, z + (z > 0 ? 0.007 : -0.007)], [0, 0, from]),
      );
      root.add("paint", roundedBox(0.2, 0.016, rearW + 0.01, 0.008, [-0.26, rearR + 0.032, z]));
      root.add(
        "steel",
        roundedBox(0.16, 0.014, 0.07, 0.01, [-0.09, 0.34, z * 0.95]),
        cyl(0.009, 0.009, 0.12, 6, [-0.09, 0.4, z * 0.95]),
      );
    }
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
  if (tracks) {
    // 9RX : quatre chenilles de même taille, **séparées**. Les trains avant
    // et arrière ne se recouvrent plus — sinon on lit deux barres, pas quatre
    // bogies. Le châssis descend jusqu’aux capots de bogie.
    const span = 0.58;
    const radius = 0.165;
    const width = 0.195;
    const zTrack = 0.42;
    const rearX = -0.48;
    const frontX = 0.5;
    const trackTop = radius + 0.012 + radius * 0.62;
    addCrawlerTrack(root, rearX, zTrack, span, radius, width);
    addCrawlerTrack(root, rearX, -zTrack, span, radius, width);
    // 9RX : châssis rigide. Les chenilles avant ne braquent pas comme des
    // pneus — sinon elles se recouvrent des arrière dès que le plateau tourne.
    addCrawlerTrack(root, frontX, zTrack, span, radius, width);
    addCrawlerTrack(root, frontX, -zTrack, span, radius, width);
    root.child([frontX, 0, 0], { role: "steer" });
    root.add("cast", roundedBox(1.08, 0.09, zTrack * 2 - width * 0.3, 0.03, [0.02, 0.2, 0]));
    root.add("paintDark", roundedBox(0.18, 0.12, zTrack * 2 + width * 0.2, 0.03, [rearX, 0.24, 0]));
    root.add("paintDark", roundedBox(0.18, 0.12, zTrack * 2 + width * 0.2, 0.03, [frontX, 0.24, 0]));
    root.add("paint", roundedBox(0.2, 0.16, 0.32, 0.04, [0.64, 0.42, 0]));
    for (const z of [zTrack, -zTrack] as const) {
      root.add("paint", roundedBox(span * 0.88, 0.045, width + 0.03, 0.016, [rearX, trackTop, z]));
      root.add("paint", roundedBox(span * 0.88, 0.045, width + 0.03, 0.016, [frontX, trackTop, z]));
      root.add("steel", roundedBox(0.08, 0.14, 0.05, 0.012, [rearX + 0.04, 0.26, z * 0.58]));
      root.add("steel", roundedBox(0.08, 0.14, 0.05, 0.012, [frontX - 0.04, 0.26, z * 0.58]));
    }
  } else {
    for (const z of rearTrack) {
      root
        .child([-0.26, rearR, z], { role: "wheel", radius: rearR })
        .attach(wheelPart(rearR, rearW, 14));
    }
    const steer = root.child([0.36, frontR, 0], { role: "steer" });
    for (const z of [0.208, -0.208] as const) {
      steer.child([0, 0, z], { role: "wheel", radius: frontR }).attach(wheelPart(frontR, frontW, 12));
      steer.add("cast", cyl(0.022, 0.022, 0.06, 10, [0, 0, z * 0.72], [HALF, 0, 0]));
      steer.add(
        "paint",
        shell(frontR + 0.03, frontW + 0.018, Math.PI * 0.12, Math.PI * 0.66, [0, 0, z], 20),
      );
    }
  }

  /*
   * La longueur valait `tracks ? 1.95 : 1.35` : **quatre paliers sur cinq
   * annonçaient exactement la même**, et seul le T5 chenillé s'en écartait.
   * C'est cette longueur que la vue de ferme emploie pour espacer les engins
   * et que les tests comparent à l'encombrement mesuré — un utilitaire de
   * 105 ch y occupait autant de place qu'un 370.
   */
  return {
    root,
    length: tracks ? 1.95 : atTier(tier, [1.35, 1.42, 1.5, 1.6, 1.6]),
    hitch: [-0.64, 0.16, 0],
    eye: [0, 0, 0],
  };
}

/* ------------------------------------------------------------------ */
/* Moissonneuse                                                        */
/* ------------------------------------------------------------------ */

function buildHarvester(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const DRIVE_R = 0.25;
  const DRIVE_W = 0.2;
  const STEER_R = 0.135;
    // Largeur de coupe : T1 ~4,5 m → T5 15,2 m (CR11), en unités monde.
    // Le T1 garde le bec déjà en jeu (1,1) ; le T5 s'élargit vraiment.
    const headerW = atTier(tier, [1.1, 1.28, 1.46, 1.72, 2.16]);
  const hs = headerW / 1.1;

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
  root.add(
    "plastic",
    cyl(0.028, 0.032, 0.3, 14, [-0.6, 0.78, 0.19]),
    cyl(0.036, 0.036, 0.1, 14, [-0.6, 0.66, 0.19]),
  );
  root.add("chrome", cyl(0.032, 0.028, 0.05, 14, [-0.6, 0.95, 0.19], [0, 0, 0.2]));
  root.child([-0.6, 0.99, 0.19], { role: "exhaust" });

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
  if (tier >= 2) {
    root.add("plastic", roundedBox(0.28, 0.03, 0.08, 0.01, [0.3, cabTop + 0.08, 0]));
    for (const z of [0.08, -0.08] as const) {
      root.add("lamp", box(0.05, 0.018, 0.035, [0.3, cabTop + 0.095, z]));
    }
  }
  if (tier >= 3) {
    root.add("trim", roundedBox(0.8, 0.04, 0.58, 0.015, [-0.14, 0.9, 0]));
    root.add("grain", roundedBox(0.7, 0.05, 0.5, 0.03, [-0.15, 0.87, 0]));
  }
  if (tier >= 5) {
    root.add(
      "plastic",
      cyl(0.028, 0.032, 0.3, 14, [-0.48, 0.78, -0.19]),
      cyl(0.036, 0.036, 0.1, 14, [-0.48, 0.66, -0.19]),
    );
    root.add("chrome", cyl(0.032, 0.028, 0.05, 14, [-0.48, 0.95, -0.19], [0, 0, 0.2]));
    for (const z of [0.2, 0, -0.2] as const) {
      root.add("lamp", box(0.04, 0.02, 0.04, [0.3, cabTop + 0.11, z]));
    }
    // CR11 : double rotor — deux caisses cylindriques, pas une batteuse allongée.
    for (const z of [0.22, -0.22] as const) {
      root.add("paintDark", cyl(0.14, 0.14, 0.52, 14, [-0.18, 0.46, z], [0, 0, HALF]));
      root.add("trim", ring(0.145, 0.012, 12, Math.PI * 2, [0.08, 0.46, z], [0, HALF, 0]));
    }
    root.add("grain", roundedBox(0.78, 0.06, 0.56, 0.03, [-0.16, 0.9, 0]));
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
      headerW,
      [0, 0, 0],
    ),
  );
  // Auge de vis d'alimentation, au fond du bec
  header.add("paintDark", cyl(0.1, 0.1, headerW * 0.92, 14, [0.04, 0.26, 0], [HALF, 0, 0]));
  header.add("rim", roundedBox(0.12, 0.045, headerW * 0.98, 0.018, [0.34, 0.15, 0]));
  const nSections = Math.max(8, Math.round(headerW / 0.08));
  const sections: THREE.BufferGeometry[] = [];
  for (let i = 0; i < nSections; i++) {
    const z = nSections === 1 ? 0 : -headerW * 0.46 + (i / (nSections - 1)) * headerW * 0.92;
    sections.push(cone(0.032, 0.07, 4, [0.41, 0.15, z], [0, 0, -HALF]));
  }
  header.add("steel", ...sections);
  // Diviseurs et bras de rabatteur
  for (const z of [headerW * 0.48, -headerW * 0.48] as const) {
    header.add("rim", cone(0.07, 0.28, 6, [0.24, 0.22, z], [0, 0, -HALF]));
    header.add("paintDark", roundedBox(0.3, 0.05, 0.05, 0.018, [0.06, 0.54, z * 0.82]));
  }

  const reel = header.child([0.2, 0.54, 0], { role: "reel", radius: 0.15 });
  const bats: THREE.BufferGeometry[] = [];
  const tines: THREE.BufferGeometry[] = [];
  const nTines = Math.max(5, Math.round(headerW / 0.22));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const bx = Math.cos(a) * 0.14;
    const by = Math.sin(a) * 0.14;
    bats.push(roundedBox(0.035, 0.035, headerW * 0.84, 0.012, [bx, by, 0]));
    for (let j = 0; j < nTines; j++) {
      const zTine = nTines === 1 ? 0 : -headerW * 0.4 + (j / (nTines - 1)) * headerW * 0.8;
      tines.push(cyl(0.006, 0.004, 0.09, 5, [bx * 1.16, by * 1.16 - 0.03, zTine], [0, 0, a]));
    }
  }
  reel.add("steel", ...bats);
  reel.add("rim", ...tines);
  for (const z of [0.46 * hs, -0.46 * hs] as const) {
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
  const augerLen = atTier(tier, [0.74, 0.82, 0.92, 1.04, 1.18]);
  const auger = root.child([-0.3, 0.9, 0.2], { role: "auger" });
  auger.add("paint", cyl(0.06, 0.06, augerLen, 14, [-augerLen / 2, 0.02, 0], [0, 0, HALF]));
  auger.add(
    "cast",
    roundedBox(0.12, 0.14, 0.12, 0.03, [-augerLen, -0.05, 0]),
    cyl(0.05, 0.05, 0.13, 10, [-0.02, -0.06, 0]),
  );
  auger.add("steel", roundedBox(0.18, 0.03, 0.03, 0.01, [-0.16, 0.08, 0]));
  if (tier >= 4) {
    auger.add("paintDark", cyl(0.045, 0.07, 0.12, 10, [-augerLen - 0.04, -0.02, 0], [0, 0, HALF]));
  }

  /* — Trains roulants ————————————————————————————————— */
  if (tier >= 5) {
    // Terra Trac : motrices sous la caisse, directrices distinctes derrière.
    // Un trou entre les deux trains — sinon ça se lit comme une seule bande.
    const driveSpan = 0.7;
    const driveR = 0.155;
    const driveW = 0.2;
    const zTrack = 0.42;
    addCrawlerTrack(root, 0.06, zTrack, driveSpan, driveR, driveW);
    addCrawlerTrack(root, 0.06, -zTrack, driveSpan, driveR, driveW);
    root.add("paintDark", roundedBox(0.55, 0.1, zTrack * 2 - 0.12, 0.03, [0.06, 0.26, 0]));
    const driveTop = driveR + 0.012 + driveR * 0.62;
    for (const z of [zTrack, -zTrack] as const) {
      root.add("paint", roundedBox(driveSpan * 0.86, 0.045, driveW + 0.02, 0.016, [0.06, driveTop, z]));
      root.add("steel", roundedBox(0.08, 0.12, 0.05, 0.012, [0.06, 0.24, z * 0.58]));
    }
    // Broyeur de paille : le T5 n’a plus un capot nu à l’arrière.
    root.add("cast", roundedBox(0.16, 0.14, 0.5, 0.03, [-0.9, 0.32, 0]));
    for (const z of [0.16, -0.16] as const) {
      const spin = root.child([-0.92, 0.28, z], { role: "spinner", spin: z > 0 ? 1 : -1 });
      spin.add("steel", cyl(0.06, 0.06, 0.04, 10, [0, 0, 0], [HALF, 0, 0]));
      spin.add("rim", roundedBox(0.12, 0.016, 0.016, 0.004, [0, 0, 0]));
    }
    const rearSpan = 0.52;
    const rearR = 0.138;
    const rearW = 0.18;
    const steer = root.child([-0.8, 0, 0], { role: "steer" });
    addCrawlerTrack(steer, 0, zTrack, rearSpan, rearR, rearW);
    addCrawlerTrack(steer, 0, -zTrack, rearSpan, rearR, rearW);
    const rearTop = rearR + 0.012 + rearR * 0.62;
    for (const z of [zTrack, -zTrack] as const) {
      steer.add("paint", roundedBox(rearSpan * 0.86, 0.04, rearW + 0.02, 0.014, [0, rearTop, z]));
    }
  } else {
    const driveZs = tier >= 4 ? ([0.22, 0.38, -0.22, -0.38] as const) : ([0.28, -0.28] as const);
    for (const z of driveZs) {
      root
        .child([0.12, DRIVE_R, z], { role: "wheel", radius: DRIVE_R })
        .attach(wheelPart(DRIVE_R, DRIVE_W, 16));
    }
    if (tier >= 4) {
      root.add("cast", roundedBox(0.14, 0.12, 0.46, 0.03, [-0.88, 0.3, 0]));
    }
    const steer = root.child([-0.58, STEER_R, 0], { role: "steer" });
    for (const z of [0.19, -0.19] as const) {
      steer.child([0, 0, z], { role: "wheel", radius: STEER_R }).attach(wheelPart(STEER_R, 0.11, 10));
    }
    steer.add("cast", cyl(0.03, 0.03, 0.34, 10, [0, 0, 0], [HALF, 0, 0]));
  }

  return { root, length: atTier(tier, [1.95, 1.98, 2.04, 2.12, 2.62]), hitch: [-0.9, 0.3, 0], eye: [0, 0, 0] };
}

/* ------------------------------------------------------------------ */
/* Épandeur                                                            */
/* ------------------------------------------------------------------ */

/**
 * Outil traîné : son origine est **l'anneau d'attelage**. Le reste se
 * développe vers les X négatifs, ce qui permet de l'accrocher derrière un
 * tracteur en posant son anneau sur la chape.
 */
function buildSpreader(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.17;
  const CX = -0.46;
  const hopD = atTier(tier, [0.56, 0.62, 0.7, 0.82, 0.96]);
  const hopTop = atTier(tier, [0.74, 0.755, 0.77, 0.785, 0.8]);
  const hopHalf = atTier(tier, [0.32, 0.34, 0.37, 0.4, 0.44]);
  const hs = hopD / 0.56;

  /* — Flèche, anneau, béquille ————————————————————————— */
  //
  // L'anneau est à la hauteur exacte de la chape du tracteur (y = 0.16) : le
  // timon monte ensuite vers le châssis. Sans cette contrainte partagée,
  // atteler l'outil l'enfonçait dans le sol de la différence des deux
  // hauteurs.
  root.add("rim", roundedBox(0.4, 0.07, 0.08, 0.02, [-0.19, 0.24, 0], [0, 0, -0.4]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add(
    "steel",
    cyl(0.018, 0.018, 0.16, 8, [-0.12, 0.16, 0.07]),
    roundedBox(0.07, 0.02, 0.07, 0.012, [-0.12, 0.08, 0.07]),
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
        [hopHalf, hopTop],
        [-hopHalf, hopTop],
      ],
      hopD,
      [CX, 0, 0],
      [0, HALF, 0],
    ),
  );
  root.add(
    "rim",
    roundedBox(hopHalf * 2 - 0.04, 0.035, 0.04, 0.012, [CX, hopTop + 0.015, hopD / 2 + 0.03]),
    roundedBox(hopHalf * 2 - 0.04, 0.035, 0.04, 0.012, [CX, hopTop + 0.015, -(hopD / 2 + 0.03)]),
    roundedBox(0.04, 0.035, hopD + 0.1, 0.012, [CX + hopHalf - 0.03, hopTop + 0.015, 0]),
    roundedBox(0.04, 0.035, hopD + 0.1, 0.012, [CX - hopHalf + 0.03, hopTop + 0.015, 0]),
  );
  root.add("grain", roundedBox(hopHalf * 1.56, 0.04, hopD * 0.89, 0.03, [CX, hopTop - 0.04, 0]));
  if (tier >= 2) {
    root.add("steel", cyl(0.016, 0.016, hopD * 0.7, 8, [CX, hopTop + 0.04, 0], [HALF, 0, 0]));
  }
  if (tier >= 5) {
    root.add("paintDark", roundedBox(hopHalf * 1.7, 0.04, hopD * 0.7, 0.02, [CX, hopTop + 0.04, 0]));
    root.add(
      "steel",
      tube(
        [
          [CX + hopHalf - 0.04, hopTop, hopD / 2],
          [CX + hopHalf + 0.02, hopTop + 0.12, hopD / 2 + 0.04],
          [CX + hopHalf + 0.02, 0.44, hopD / 2 + 0.08],
        ],
        0.008,
      ),
    );
    root.add("plastic", roundedBox(0.06, 0.05, 0.05, 0.01, [CX + hopHalf, hopTop + 0.02, 0]));
    root.add("lamp", box(0.02, 0.03, 0.04, [CX + hopHalf + 0.03, hopTop + 0.02, 0]));
  }
  root.add(
    "paintDark",
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX + 0.2 * hs, 0.54, (hopD / 2) * 0.96], [0, 0, 0.12]),
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX - 0.2 * hs, 0.54, (hopD / 2) * 0.96], [0, 0, 0.12]),
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX + 0.2 * hs, 0.54, -(hopD / 2) * 0.96], [0, 0, 0.12]),
    roundedBox(0.04, 0.4, 0.045, 0.012, [CX - 0.2 * hs, 0.54, -(hopD / 2) * 0.96], [0, 0, 0.12]),
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
    if (tier >= 3) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        disc.add(
          "steel",
          roundedBox(0.012, 0.02, 0.05, 0.004, [Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08], [0, -a, 0]),
        );
      }
    }
  }

  /* — Essieu, roues, garde-boue ————————————————————————— */
  // T4–T5 : tandem, trémie portée — le ZG-TS n'est plus un ZA-M agrandi.
  const axleXs = tier >= 4 ? ([CX - 0.14, CX + 0.16] as const) : ([CX + 0.02] as const);
  const track = 0.38 * Math.min(1.15, hs);
  for (const x of axleXs) {
    root.add("cast", cyl(0.035, 0.035, track * 2, 10, [x, WHEEL_R, 0], [HALF, 0, 0]));
    for (const z of [track, -track] as const) {
      root.child([x, WHEEL_R, z], { role: "wheel", radius: WHEEL_R }).attach(wheelPart(WHEEL_R, 0.13, 12));
      if (tier < 4) {
        root.add("paint", shell(WHEEL_R + 0.028, 0.145, Math.PI * 0.12, Math.PI * 0.66, [x, WHEEL_R, z]));
      }
    }
  }

  return { root, length: atTier(tier, [1.1, 1.12, 1.16, 1.18, 1.22]), hitch: [-0.95, 0.3, 0], eye: [0.01, 0.16, 0] };
}

/* ------------------------------------------------------------------ */
/* Déchaumeur à disques                                                */
/* ------------------------------------------------------------------ */

function buildDiscHarrow(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.16;
  const DISC_R = 0.16;
  const nDiscs = atTier(tier, [5, 6, 8, 10, 12]);
  const span = 0.6 * (nDiscs / 5);
  const frameZ = atTier(tier, [0.22, 0.26, 0.32, 0.4, 0.48]);

  /* — Flèche, anneau, béquille ————————————————————————— */
  //
  // Anneau à la hauteur de la chape du tracteur (y = 0.16), timon montant
  // jusqu'au cadre : c'est ce qui garantit que l'outil attelé pose ses roues
  // au sol et non dessous.
  root.add("paint", roundedBox(0.48, 0.08, 0.09, 0.025, [-0.19, 0.29, 0], [0, 0, -0.62]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add("steel", cyl(0.018, 0.018, 0.18, 8, [-0.14, 0.17, 0.08]));

  /* — Cadre : longerons, traverse, contreventement ——————————— */
  root.add(
    "paint",
    roundedBox(0.78, 0.075, 0.085, 0.02, [-0.6, 0.46, frameZ]),
    roundedBox(0.78, 0.075, 0.085, 0.02, [-0.6, 0.46, -frameZ]),
    roundedBox(0.09, 0.075, frameZ * 2 + 0.08, 0.02, [-0.94, 0.46, 0]),
    roundedBox(0.09, 0.075, frameZ * 2 + 0.08, 0.02, [-0.3, 0.46, 0]),
  );
  root.add(
    "paintDark",
    roundedBox(0.44, 0.05, 0.05, 0.015, [-0.26, 0.46, frameZ * 0.64], [0, 0.68, 0]),
    roundedBox(0.44, 0.05, 0.05, 0.015, [-0.26, 0.46, -frameZ * 0.64], [0, -0.68, 0]),
  );

  /* — Deux trains de disques, inclinés en sens inverse ——————— */
  for (const [x, yaw, dir] of [
    [-0.42, 0.42, 1],
    [-0.8, -0.42, -1],
  ] as const) {
    // Porte-disques : il descend au travail, remonte en transport.
    const tool = root.child([x, 0, 0], { role: "tool" });
    const hang = span / 2 - 0.12;
    tool.add(
      "paintDark",
      roundedBox(0.07, 0.34, 0.07, 0.02, [0, 0.3, hang]),
      roundedBox(0.07, 0.34, 0.07, 0.02, [0, 0.3, -hang]),
    );
    const gang = tool.child([0, 0.17, 0], { rot: [0, yaw, 0], role: "gang", radius: DISC_R, spin: dir });
    gang.add("cast", cyl(0.026, 0.026, span + 0.1, 10, [0, 0, 0], [HALF, 0, 0]));
    for (let i = 0; i < nDiscs; i++) {
      const z = -span / 2 + (nDiscs === 1 ? 0 : (i / (nDiscs - 1)) * span);
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
    if (tier >= 3) {
      tool.add(
        "chrome",
        cyl(0.01, 0.01, 0.22, 8, [0, 0.38, hang * 0.4], [0, 0, 0.45]),
        cyl(0.01, 0.01, 0.22, 8, [0, 0.38, -hang * 0.4], [0, 0, -0.45]),
      );
    }
  }

  /* — Roues de transport sur chandelles ————————————————— */
  const axleXs = tier >= 4 ? ([-0.98, -0.58] as const) : ([-0.98] as const);
  const trackW = atTier(tier, [0.42, 0.46, 0.54, 0.64, 0.74]);
  for (const x of axleXs) {
    root.add("cast", cyl(0.032, 0.032, trackW * 2, 10, [x, WHEEL_R, 0], [HALF, 0, 0]));
    for (const z of [trackW, -trackW] as const) {
      root.child([x, WHEEL_R, z], { role: "wheel", radius: WHEEL_R }).attach(wheelPart(WHEEL_R, 0.115, 11));
      root.add("paint", roundedBox(0.09, 0.34, 0.08, 0.02, [x, WHEEL_R + 0.19, z * 0.8]));
    }
  }
  if (tier >= 5) {
    root.add("paintDark", roundedBox(0.16, 0.08, frameZ * 1.6, 0.02, [-0.62, 0.54, 0]));
    root.add("plastic", roundedBox(0.06, 0.05, 0.05, 0.01, [-0.36, 0.54, frameZ]));
    root.add("lamp", box(0.02, 0.03, 0.04, [-0.33, 0.54, frameZ]));
  }

  return { root, length: atTier(tier, [1.2, 1.22, 1.26, 1.32, 1.38]), hitch: [-1.1, 0.36, 0], eye: [0.01, 0.16, 0] };
}

/* ------------------------------------------------------------------ */
/* Presse à balles rondes                                              */
/* ------------------------------------------------------------------ */

/**
 * Outil traîné, comme l'épandeur et le déchaumeur : l'origine est l'anneau
 * d'attelage, à la hauteur de chape partagée `y = 0.16`, et la machine se
 * développe vers les X négatifs.
 *
 * La silhouette tient en trois volumes qu'on reconnaît de loin : le
 * ramasseur bas à l'avant, la chambre de pressage cylindrique couchée en
 * travers, et le hayon incliné à l'arrière. Le rouleau du ramasseur porte le
 * rôle `reel` : il tourne avec l'avancement, comme le rabatteur de la
 * moissonneuse.
 */
function buildBaler(tier: MachineTier = 1): Blueprint {
  if (tier >= 5) return buildSquareBaler();
  const root = new Part();
  const WHEEL_R = 0.16;
  /** Centre de la chambre de pressage */
  const CX = -0.62;
  // La cinquième valeur n'est jamais lue : `buildSquareBaler` a déjà rendu
  // la main au-dessus. On la garde alignée sur la progression plutôt que
  // repliée sur le T1, pour que la suite se lise comme ce qu'elle est.
  const CHAMBER_R = atTier(tier, [0.32, 0.335, 0.35, 0.365, 0.385]);
  const CHAMBER_Y = WHEEL_R + CHAMBER_R + 0.05;

  /* — Flèche, anneau, béquille ————————————————————————— */
  root.add("paint", roundedBox(0.46, 0.08, 0.09, 0.025, [-0.2, 0.26, 0], [0, 0, -0.42]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add(
    "steel",
    cyl(0.018, 0.018, 0.17, 8, [-0.13, 0.16, 0.07]),
    roundedBox(0.07, 0.02, 0.07, 0.012, [-0.13, 0.08, 0.07]),
  );
  // Cardan : la prise de force entraîne le rotor, il faut la voir.
  root.add("chrome", cyl(0.022, 0.022, 0.3, 8, [-0.2, 0.2, -0.05], [0, 0, 0.16]));

  /* — Ramasseur : caisson bas, dents sur un rouleau tournant ——— */
  root.add(
    "paintDark",
    roundedBox(0.26, 0.11, 0.62, 0.03, [CX + 0.4, 0.14, 0]),
    // Les deux joues qui canalisent l'andain vers la chambre.
    roundedBox(0.24, 0.16, 0.03, 0.02, [CX + 0.4, 0.2, 0.31], [0, 0, -0.1]),
    roundedBox(0.24, 0.16, 0.03, 0.02, [CX + 0.4, 0.2, -0.31], [0, 0, -0.1]),
  );
  const pickup = root.child([CX + 0.42, 0.13, 0], { role: "reel", spin: 1 });
  pickup.add("steel", cyl(0.045, 0.045, 0.56, 10, [0, 0, 0], [HALF, 0, 0]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bar: THREE.BufferGeometry[] = [];
    for (let k = -2; k <= 2; k++) {
      bar.push(
        box(0.012, 0.072, 0.012, [Math.cos(a) * 0.072, Math.sin(a) * 0.072, k * 0.12], [a, 0, 0]),
      );
    }
    pickup.add("chrome", ...bar);
  }
  // Roue de jauge : elle tient le ramasseur au ras du sol.
  root.add("cast", cyl(0.02, 0.02, 0.1, 8, [CX + 0.56, 0.1, 0.3], [HALF, 0, 0]));
  root
    .child([CX + 0.56, 0.075, 0.34], { role: "wheel", radius: 0.075 })
    .attach(wheelPart(0.075, 0.05, 8));

  /* — Chambre de pressage : un cylindre couché, cerclé de rouleaux — */
  root.add(
    "paint",
    lathe(
      [
        [0, -0.29],
        [CHAMBER_R, -0.29],
        [CHAMBER_R, 0.29],
        [0, 0.29],
      ],
      18,
      [CX, CHAMBER_Y, 0],
      [HALF, 0, 0],
    ),
  );
  root.add(
    "rim",
    ring(CHAMBER_R + 0.012, 0.018, 16, Math.PI * 2, [CX, CHAMBER_Y, 0.3], [0, 0, 0]),
    ring(CHAMBER_R + 0.012, 0.018, 16, Math.PI * 2, [CX, CHAMBER_Y, -0.3], [0, 0, 0]),
  );
  // Bandes latérales : le contraste qui empêche le cylindre de paraître nu.
  root.add(
    "paintDark",
    roundedBox(0.5, 0.05, 0.62, 0.02, [CX, CHAMBER_Y + CHAMBER_R - 0.03, 0]),
    roundedBox(0.16, 0.14, 0.6, 0.03, [CX + CHAMBER_R - 0.02, CHAMBER_Y - 0.1, 0]),
  );
  // Compteur de balles et gyrophare : la presse travaille en aveugle.
  root.add("plastic", roundedBox(0.09, 0.07, 0.05, 0.015, [CX + 0.12, CHAMBER_Y + 0.3, 0.3]));
  root.child([CX - 0.1, CHAMBER_Y + 0.34, 0.26], { role: "beacon" });
  if (tier >= 2) {
    root.add("paintDark", roundedBox(0.12, 0.1, 0.08, 0.02, [CX + CHAMBER_R * 0.2, CHAMBER_Y + 0.08, 0.32]));
  }
  if (tier >= 4) {
    root.add("steel", roundedBox(0.4, 0.03, 0.64, 0.012, [CX, CHAMBER_Y + CHAMBER_R + 0.01, 0]));
    root.add("plastic", roundedBox(0.05, 0.04, 0.05, 0.01, [CX + 0.16, CHAMBER_Y + CHAMBER_R + 0.04, 0.28]));
    root.add("lamp", box(0.016, 0.024, 0.035, [CX + 0.19, CHAMBER_Y + CHAMBER_R + 0.04, 0.28]));
  }

  /* — Hayon : le volet arrière par lequel la balle tombe ————— */
  root.add(
    "paint",
    extrude(
      [
        [-0.34, 0.06],
        [-0.02, 0.02],
        [0.04, 0.44],
        [-0.3, 0.5],
      ],
      0.58,
      [CX - CHAMBER_R, CHAMBER_Y - 0.24, 0],
      [0, HALF, 0],
    ),
  );
  root.add(
    "steel",
    roundedBox(0.3, 0.03, 0.05, 0.012, [CX - CHAMBER_R - 0.16, CHAMBER_Y - 0.02, 0.29], [0, 0, 0.5]),
    roundedBox(0.3, 0.03, 0.05, 0.012, [CX - CHAMBER_R - 0.16, CHAMBER_Y - 0.02, -0.29], [0, 0, 0.5]),
  );
  // Rampe de dépose : la balle roule au sol au lieu de tomber d'un mètre.
  root.add(
    "rim",
    roundedBox(0.34, 0.035, 0.07, 0.015, [CX - CHAMBER_R - 0.16, WHEEL_R - 0.04, 0.2], [0, 0, -0.2]),
    roundedBox(0.34, 0.035, 0.07, 0.015, [CX - CHAMBER_R - 0.16, WHEEL_R - 0.04, -0.2], [0, 0, -0.2]),
  );

  /* — Châssis et roues ————————————————————————————————— */
  root.add(
    "cast",
    roundedBox(0.72, 0.07, 0.09, 0.02, [CX, WHEEL_R + 0.02, 0.24]),
    roundedBox(0.72, 0.07, 0.09, 0.02, [CX, WHEEL_R + 0.02, -0.24]),
    cyl(0.032, 0.032, 0.74, 10, [CX, WHEEL_R, 0], [HALF, 0, 0]),
  );
  for (const z of [0.37, -0.37] as const) {
    root
      .child([CX, WHEEL_R, z], { role: "wheel", radius: WHEEL_R })
      .attach(wheelPart(WHEEL_R, 0.12, 11));
  }

  // Cinquième valeur morte elle aussi, pour la même raison.
  return { root, length: atTier(tier, [1.35, 1.38, 1.42, 1.48, 1.56]), hitch: [-1.25, 0.3, 0], eye: [0.01, 0.16, 0] };
}

/**
 * Presse à balles cubiques — T5 seulement.
 *
 * La chambre ronde ne grandit plus : c'est un autre engin, ramasseur devant,
 * caisson rectangulaire, volant de noueur. Le ramasseur garde le rôle `reel`
 * pour que l'entraînement à la distance reste le même geste.
 */
function buildSquareBaler(): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.16;
  const CX = -0.78;

  root.add("paint", roundedBox(0.46, 0.08, 0.09, 0.025, [-0.2, 0.26, 0], [0, 0, -0.42]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add(
    "steel",
    cyl(0.018, 0.018, 0.17, 8, [-0.13, 0.16, 0.07]),
    roundedBox(0.07, 0.02, 0.07, 0.012, [-0.13, 0.08, 0.07]),
  );
  root.add("chrome", cyl(0.022, 0.022, 0.3, 8, [-0.2, 0.2, -0.05], [0, 0, 0.16]));

  /* — Ramasseur, identique au geste de la ronde ————————————— */
  root.add(
    "paintDark",
    roundedBox(0.26, 0.11, 0.62, 0.03, [CX + 0.58, 0.14, 0]),
    roundedBox(0.24, 0.16, 0.03, 0.02, [CX + 0.58, 0.2, 0.31], [0, 0, -0.1]),
    roundedBox(0.24, 0.16, 0.03, 0.02, [CX + 0.58, 0.2, -0.31], [0, 0, -0.1]),
  );
  const pickup = root.child([CX + 0.6, 0.13, 0], { role: "reel", spin: 1 });
  pickup.add("steel", cyl(0.045, 0.045, 0.56, 10, [0, 0, 0], [HALF, 0, 0]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bar: THREE.BufferGeometry[] = [];
    for (let k = -2; k <= 2; k++) {
      bar.push(
        box(0.012, 0.072, 0.012, [Math.cos(a) * 0.072, Math.sin(a) * 0.072, k * 0.12], [a, 0, 0]),
      );
    }
    pickup.add("chrome", ...bar);
  }
  root.add("cast", cyl(0.02, 0.02, 0.1, 8, [CX + 0.74, 0.1, 0.3], [HALF, 0, 0]));
  root
    .child([CX + 0.74, 0.075, 0.34], { role: "wheel", radius: 0.075 })
    .attach(wheelPart(0.075, 0.05, 8));
  root.add("cast", cyl(0.02, 0.02, 0.1, 8, [CX + 0.74, 0.1, -0.3], [HALF, 0, 0]));
  root
    .child([CX + 0.74, 0.075, -0.34], { role: "wheel", radius: 0.075 })
    .attach(wheelPart(0.075, 0.05, 8));

  /* — Chambre cubique : c'est ça qui dit « Quadrant » de loin ——— */
  root.add(
    "paint",
    roundedBox(1.02, 0.5, 0.5, 0.045, [CX, 0.52, 0]),
  );
  root.add(
    "paintDark",
    roundedBox(0.78, 0.09, 0.52, 0.02, [CX - 0.04, 0.8, 0]),
    roundedBox(0.14, 0.32, 0.52, 0.03, [CX + 0.48, 0.52, 0]),
    roundedBox(0.1, 0.26, 0.54, 0.02, [CX - 0.42, 0.62, 0]),
    roundedBox(0.2, 0.18, 0.08, 0.02, [CX + 0.1, 0.55, 0.28]),
    roundedBox(0.2, 0.18, 0.08, 0.02, [CX + 0.1, 0.55, -0.28]),
  );
  root.add(
    "steel",
    roundedBox(0.62, 0.035, 0.54, 0.012, [CX, 0.82, 0]),
    cyl(0.018, 0.018, 0.24, 8, [CX + 0.22, 0.68, 0.28], [HALF, 0, 0]),
    cyl(0.018, 0.018, 0.24, 8, [CX - 0.08, 0.68, 0.28], [HALF, 0, 0]),
  );
  // Noueurs : deux volants, plus un capot.
  const fly = root.child([CX + 0.16, 0.82, 0.26], { role: "spinner", spin: 1 });
  fly.add("steel", cyl(0.075, 0.075, 0.03, 12, [0, 0, 0], [HALF, 0, 0]));
  fly.add("rim", roundedBox(0.15, 0.02, 0.02, 0.006, [0, 0, 0]));
  const fly2 = root.child([CX - 0.06, 0.82, 0.26], { role: "spinner", spin: -1 });
  fly2.add("steel", cyl(0.06, 0.06, 0.025, 12, [0, 0, 0], [HALF, 0, 0]));
  fly2.add("rim", roundedBox(0.12, 0.016, 0.016, 0.005, [0, 0, 0]));
  root.add("paintDark", roundedBox(0.36, 0.08, 0.16, 0.02, [CX + 0.05, 0.88, 0.22]));
  root.add("plastic", roundedBox(0.1, 0.07, 0.06, 0.015, [CX + 0.24, 0.82, -0.2]));
  root.add("lamp", box(0.02, 0.03, 0.04, [CX + 0.3, 0.82, -0.2]));
  root.child([CX - 0.22, 0.86, 0.22], { role: "beacon" });

  /* — Goulotte de sortie, à l'arrière ————————————————— */
  root.add(
    "paint",
    roundedBox(0.34, 0.18, 0.4, 0.03, [CX - 0.64, 0.42, 0]),
  );
  root.add(
    "rim",
    roundedBox(0.4, 0.035, 0.08, 0.015, [CX - 0.78, WHEEL_R - 0.04, 0.18], [0, 0, -0.2]),
    roundedBox(0.4, 0.035, 0.08, 0.015, [CX - 0.78, WHEEL_R - 0.04, -0.18], [0, 0, -0.2]),
  );

  /* — Tandem jumelé ————————————————————————————— */
  root.add(
    "cast",
    roundedBox(0.96, 0.07, 0.09, 0.02, [CX, WHEEL_R + 0.02, 0.24]),
    roundedBox(0.96, 0.07, 0.09, 0.02, [CX, WHEEL_R + 0.02, -0.24]),
  );
  for (const x of [CX - 0.2, CX + 0.2]) {
    root.add("cast", cyl(0.032, 0.032, 0.86, 10, [x, WHEEL_R, 0], [HALF, 0, 0]));
    for (const z of [0.32, 0.46, -0.32, -0.46] as const) {
      root.child([x, WHEEL_R, z], { role: "wheel", radius: WHEEL_R }).attach(wheelPart(WHEEL_R, 0.11, 11));
    }
  }

  return { root, length: 1.72, hitch: [-1.4, 0.3, 0], eye: [0.01, 0.16, 0] };
}

/* ------------------------------------------------------------------ */
/* Ensileuse automotrice                                               */
/* ------------------------------------------------------------------ */

/**
 * Automotrice, comme la moissonneuse : quatre roues dont deux directrices à
 * l'arrière (rôle `steer`), et l'origine au centre de l'engin.
 *
 * Ce qui la distingue au premier coup d'œil, c'est la **goulotte** — le tube
 * coudé qui crache le fourrage en l'air, tourné vers l'arrière-gauche. Le
 * bec cueilleur à l'avant porte deux tambours à couteaux en rôle `reel`.
 */
function buildForageHarvester(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const DRIVE_R = 0.24;
  const STEER_R = 0.15;
  const HEAD_X = 0.66;
  const HEAD_W = atTier(tier, [1.06, 1.2, 1.36, 1.54, 1.78]);
  const nDrums = atTier(tier, [4, 4, 6, 6, 8]);
  const nPoints = atTier(tier, [5, 5, 7, 7, 9]);

  /* — Caisse : profil trapu, capot moteur haut à l'arrière ————— */
  root.add(
    "paint",
    extrude(
      [
        [-0.72, 0.32],
        [0.3, 0.32],
        [0.4, 0.4],
        [0.4, 0.56],
        [0.22, 0.64],
        [-0.34, 0.66],
        [-0.58, 0.62],
        [-0.72, 0.5],
      ],
      0.52,
      [0, 0, 0],
    ),
  );
  root.add("paintDark", roundedBox(1.0, 0.09, 0.54, 0.03, [-0.16, 0.31, 0]));

  /* — Cabine vitrée, avancée sur la gauche ————————————————— */
  root.add(
    "glass",
    extrude(
      [
        [-0.16, 0.66],
        [0.24, 0.66],
        [0.24, 1.0],
        [-0.16, 1.0],
      ],
      0.4,
      [0, 0, 0.03],
    ),
  );
  root.add(
    "rim",
    roundedBox(0.44, 0.035, 0.44, 0.015, [0.04, 1.02, 0.03]),
    roundedBox(0.05, 0.36, 0.05, 0.018, [-0.17, 0.84, 0.23]),
    roundedBox(0.05, 0.36, 0.05, 0.018, [0.25, 0.84, 0.23]),
  );
  root.child([0.04, 1.07, 0.03], { role: "beacon" });
  if (tier >= 2) {
    for (const z of [0.14, -0.08] as const) {
      root.add("plastic", roundedBox(0.05, 0.035, 0.055, 0.01, [0.22, 1.04, z]));
      root.add("lamp", box(0.012, 0.024, 0.04, [0.248, 1.04, z]));
    }
  }
  if (tier >= 4) {
    root.add("rim", roundedBox(0.48, 0.04, 0.48, 0.015, [0.04, 1.05, 0.03]));
    root.add("plastic", ball(0.024, [0.04, 1.1, 0.16]));
  }

  /* — Moteur : grille, échappement vertical ————————————————— */
  root.add("plastic", roundedBox(0.03, 0.2, 0.36, 0.03, [-0.73, 0.46, 0]));
  const grid: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) grid.push(box(0.012, 0.012, 0.32, [-0.745, 0.39 + i * 0.035, 0]));
  root.add("steel", ...grid);
  root.add(
    "plastic",
    cyl(0.03, 0.034, 0.32, 14, [-0.5, 0.82, -0.2]),
    cyl(0.038, 0.038, 0.1, 14, [-0.5, 0.69, -0.2]),
  );
  root.add("chrome", cyl(0.034, 0.03, 0.05, 14, [-0.5, 1.0, -0.2], [0, 0, 0.2]));
  root.child([-0.5, 1.04, -0.2], { role: "exhaust" });
  if (tier >= 5) {
    root.add(
      "plastic",
      cyl(0.03, 0.034, 0.32, 14, [-0.38, 0.82, 0.2]),
      cyl(0.038, 0.038, 0.1, 14, [-0.38, 0.69, 0.2]),
    );
    root.add("chrome", cyl(0.034, 0.03, 0.05, 14, [-0.38, 1.0, 0.2], [0, 0, 0.2]));
  }

  /* — Goulotte : ce qui fait reconnaître une ensileuse ——————— */
  //
  // Première version : un caisson posé de biais sur le capot. Sur la planche
  // de contact, on voyait « un tracteur orange avec une bosse » — la pièce ne
  // partait de nulle part et n'allait nulle part. Une goulotte doit **décoller
  // du corps, enjamber la machine et finir haut derrière**, sinon rien ne
  // distingue l'engin d'un automoteur quelconque.
  //
  // Un tube suivant une courbe le dit d'un seul trait, là où des caisses
  // aboutées laissaient des angles morts.
  // Le plafond de hauteur du parc est à 1,2 : au-delà, un engin écrase la
  // lecture de la parcelle, et le test le refuse. La goulotte gagne donc en
  // **allonge** ce qu'elle ne prend pas en hauteur — c'est de toute façon la
  // portée vers l'arrière qui la fait reconnaître, pas l'altitude.
  const SPOUT: Vec3[] = [
    [-0.02, 0.68, -0.12],
    [-0.14, 0.9, -0.22],
    [-0.36, 1.02, -0.34],
    [-0.66, 1.04, -0.44],
    [-0.95, 0.96, -0.5],
  ];
  root.add("paint", tube(SPOUT, 0.085, 8));
  // Embase : la goulotte pivote sur une couronne, elle n'est pas soudée.
  root.add("paintDark", cyl(0.13, 0.11, 0.09, 12, [-0.02, 0.66, -0.12]));
  root.add("chrome", ring(0.115, 0.014, 12, Math.PI * 2, [-0.02, 0.72, -0.12], [HALF, 0, 0]));
  // Déflecteur : le volet qui rabat le jet vers la remorque.
  root.add(
    "paintDark",
    roundedBox(0.22, 0.03, 0.24, 0.012, [-1.06, 0.9, -0.52], [0, 0.42, 0.55]),
  );
  if (tier >= 3) {
    root.add(
      "paintDark",
      roundedBox(0.16, 0.025, 0.18, 0.01, [-1.12, 0.86, -0.56], [0, 0.5, 0.45]),
    );
    root.add("chrome", ring(0.09, 0.012, 10, Math.PI * 2, [-0.66, 1.04, -0.44], [0, 0.4, 0.2]));
  }
  if (tier >= 5) {
    root.add("paint", tube(
      [
        [-0.02, 0.68, -0.12],
        [-0.18, 0.92, -0.28],
        [-0.42, 1.05, -0.4],
        [-0.74, 1.06, -0.52],
        [-1.08, 0.94, -0.58],
      ],
      0.055,
      8,
    ));
  }
  // Vérin de commande, entre le corps et le milieu de la flèche.
  root.add("chrome", cyl(0.022, 0.022, 0.4, 8, [-0.3, 0.86, -0.08], [0, 0, -0.8]));

  /* — Bec cueilleur : large, et qu'on le voie ————————————————— */
  //
  // Le premier bec faisait 0,86 de large pour une machine de 1,8 : trois
  // pointes maigres qui se perdaient sous la caisse. Un bec à maïs est la
  // pièce **la plus large** de l'engin — il déborde des roues, sinon il ne
  // ramasse rien et ne se voit pas.
  const header = root.child([HEAD_X, 0, 0], { role: "tool" });
  header.add(
    "paintDark",
    // Bâti : une auge basse qui court sur toute la largeur.
    roundedBox(0.26, 0.17, HEAD_W, 0.04, [0, 0.22, 0]),
    // Joues verticales, qui ferment le bec à ses deux bouts.
    roundedBox(0.24, 0.26, 0.035, 0.015, [0, 0.34, HEAD_W / 2], [0, 0, -0.1]),
    roundedBox(0.24, 0.26, 0.035, 0.015, [0, 0.34, -HEAD_W / 2], [0, 0, -0.1]),
  );
  // Bras d'alimentation : ils relient le bec à la caisse, sinon il flotte.
  header.add(
    "cast",
    roundedBox(0.3, 0.1, 0.11, 0.028, [-0.24, 0.32, 0.2]),
    roundedBox(0.3, 0.1, 0.11, 0.028, [-0.24, 0.32, -0.2]),
  );
  // Tambours à couteaux, entraînés par la distance.
  const drumSpan = HEAD_W * (0.78 / 1.06);
  for (let i = 0; i < nDrums; i++) {
    const z = nDrums === 1 ? 0 : -drumSpan / 2 + (i / (nDrums - 1)) * drumSpan;
    const drum = header.child([0.07, 0.27, z], { role: "reel", spin: z > 0 ? 1 : -1 });
    drum.add("chrome", cyl(0.085, 0.085, 0.1, 12, [0, 0, 0]));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      drum.add(
        "steel",
        box(0.1, 0.016, 0.055, [Math.cos(a) * 0.095, Math.sin(a) * 0.095, 0], [0, 0, a]),
      );
    }
  }
  // Pointes de séparation : la dent de scie qui dit « maïs » de loin.
  const pointSpan = HEAD_W - 0.12;
  for (let i = 0; i < nPoints; i++) {
    const z = nPoints === 1 ? 0 : -pointSpan / 2 + (i / (nPoints - 1)) * pointSpan;
    header.add("plastic", cone(0.055, 0.3, 8, [0.26, 0.23, z], [0, 0, -HALF]));
  }

  /* — Roues : motrices devant, directrices derrière ——————————— */
  if (tier >= 5) {
    const driveSpan = 0.66;
    const driveR = 0.15;
    const driveW = 0.19;
    const zTrack = 0.42;
    addCrawlerTrack(root, 0.16, zTrack, driveSpan, driveR, driveW);
    addCrawlerTrack(root, 0.16, -zTrack, driveSpan, driveR, driveW);
    root.add("paintDark", roundedBox(0.5, 0.1, zTrack * 2 - 0.12, 0.03, [0.16, 0.24, 0]));
    const driveTop = driveR + 0.012 + driveR * 0.62;
    for (const z of [zTrack, -zTrack] as const) {
      root.add("paint", roundedBox(driveSpan * 0.86, 0.045, driveW + 0.02, 0.016, [0.16, driveTop, z]));
      root.add("steel", roundedBox(0.08, 0.12, 0.05, 0.012, [0.16, 0.22, z * 0.58]));
    }
    const rearSpan = 0.5;
    const rearR = 0.135;
    const rearW = 0.175;
    const steer = root.child([-0.72, 0, 0], { role: "steer" });
    addCrawlerTrack(steer, 0, zTrack, rearSpan, rearR, rearW);
    addCrawlerTrack(steer, 0, -zTrack, rearSpan, rearR, rearW);
    const rearTop = rearR + 0.012 + rearR * 0.62;
    for (const z of [zTrack, -zTrack] as const) {
      steer.add("paint", roundedBox(rearSpan * 0.86, 0.04, rearW + 0.02, 0.014, [0, rearTop, z]));
    }
  } else {
    const driveZs = tier >= 4 ? ([0.24, 0.4, -0.24, -0.4] as const) : ([0.31, -0.31] as const);
    root.add("cast", cyl(0.038, 0.038, Math.max(...driveZs.map((z) => Math.abs(z))) * 2, 10, [0.28, DRIVE_R, 0], [HALF, 0, 0]));
    for (const z of driveZs) {
      root
        .child([0.28, DRIVE_R, z], { role: "wheel", radius: DRIVE_R })
        .attach(wheelPart(DRIVE_R, 0.19, 14));
      if (tier < 4) {
        root.add("paint", shell(DRIVE_R + 0.03, 0.2, Math.PI * 0.1, Math.PI * 0.62, [0.28, DRIVE_R, z]));
      }
    }
    const steer = root.child([-0.52, STEER_R, 0], { role: "steer" });
    for (const z of [0.2, -0.2] as const) {
      steer.child([0, 0, z], { role: "wheel", radius: STEER_R }).attach(wheelPart(STEER_R, 0.12, 10));
    }
    steer.add("cast", cyl(0.03, 0.03, 0.36, 10, [0, 0, 0], [HALF, 0, 0]));
  }

  // Bec élargi devant, goulotte qui porte loin derrière : l'engin mesure
  // vraiment deux unités. La valeur sert au cadrage de l'atelier et au
  // placement de la poussière — la laisser à 1,8 déréglerait les deux.
  return { root, length: atTier(tier, [2.05, 2.08, 2.12, 2.16, 2.42]), hitch: [-0.85, 0.3, 0], eye: [0, 0, 0] };
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


/* ------------------------------------------------------------------ */
/* Charrue                                                             */
/* ------------------------------------------------------------------ */

/**
 * Corps portés sous une poutre, plus une roue de jauge.
 *
 * C'est l'outil le plus lent du parc, et le modèle doit le dire : étroit,
 * bas sur terre, tout en fonte. Les corps descendent au travail et se
 * relèvent en transport — d'où le rôle `tool` sur chacun.
 *
 * T1 : 3 corps. T5 : 12 corps. On ne scale pas une charrue de trois, on
 * en ajoute.
 */
function buildPlough(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.15;
  const n = atTier(tier, [3, 4, 6, 8, 12]);
  const pitchX = atTier(tier, [0.28, 0.24, 0.2, 0.15, 0.11]);
  const pitchZ = atTier(tier, [0.13, 0.12, 0.1, 0.085, 0.068]);
  const beamLen = atTier(tier, [0.86, 1.0, 1.22, 1.42, 1.78]);
  const beamX = atTier(tier, [-0.72, -0.8, -0.9, -1.02, -1.18]);

  /* — Timon, anneau, béquille — même chape que les autres outils —— */
  root.add("paint", roundedBox(0.46, 0.08, 0.09, 0.025, [-0.18, 0.28, 0], [0, 0, -0.6]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add("steel", cyl(0.018, 0.018, 0.18, 8, [-0.13, 0.17, 0.07]));

  /* — Poutre maîtresse : une charrue, c'est d'abord ça —————— */
  root.add("paint", roundedBox(beamLen, 0.1, 0.11, 0.025, [beamX, 0.44, 0]));
  root.add("paintDark", roundedBox(0.1, 0.16, 0.1, 0.02, [-0.36, 0.36, 0]));

  /* — Corps décalés, soc et versoir ——————————————— */
  for (let i = 0; i < n; i++) {
    const x = -0.46 - i * pitchX;
    const z = 0.13 - i * pitchZ;
    const corps = root.child([x, 0, z], { role: "tool" });
    // Étançon : le bras vertical qui descend de la poutre au soc.
    corps.add("paintDark", roundedBox(0.06, 0.3, 0.055, 0.015, [0, 0.3, 0]));
    // Versoir : une tôle vrillée. Deux plans suffisent à la lire de loin.
    corps.add(
      "cast",
      roundedBox(0.24, 0.19, 0.03, 0.01, [-0.06, 0.15, -0.05], [0, 0.34, 0.5]),
      roundedBox(0.2, 0.03, 0.14, 0.01, [-0.03, 0.07, -0.02], [0.3, 0.2, 0]),
    );
    // Soc : la pointe qui entre en terre.
    corps.add("chrome", cone(0.05, 0.13, 6, [0.07, 0.055, 0.01], [0, 0, -HALF]));
    if (tier >= 2) {
      corps.add("steel", roundedBox(0.08, 0.04, 0.05, 0.01, [0.04, 0.2, 0.04], [0, 0.2, 0.3]));
    }
    if (tier >= 3) {
      corps.add("chrome", cyl(0.01, 0.01, 0.2, 8, [0.02, 0.38, 0], [0, 0, 0.5]));
    }
    if (tier >= 5) {
      corps.add(
        "cast",
        lathe(
          [
            [0.015, 0.004],
            [0.055, 0],
            [0.055, -0.006],
            [0.015, -0.008],
          ],
          10,
          [0.1, 0.16, 0.06],
          [HALF, 0.5, 0],
        ),
      );
    }
  }

  /* — Roue de jauge, à l'arrière ——————————————————————— */
  const wheelX = -0.46 - (n - 1) * pitchX - 0.04;
  const wheelZ = 0.13 - (n - 1) * pitchZ - 0.07;
  root
    .child([wheelX, WHEEL_R, wheelZ], { role: "wheel", radius: WHEEL_R })
    .attach(wheelPart(WHEEL_R, 0.1, 10));
  root.add("steel", roundedBox(0.06, 0.26, 0.06, 0.015, [wheelX, 0.32, wheelZ]));
  if (tier >= 5) {
    root
      .child([wheelX + 0.22, WHEEL_R, -wheelZ], { role: "wheel", radius: WHEEL_R })
      .attach(wheelPart(WHEEL_R, 0.1, 10));
    root.add("steel", roundedBox(0.06, 0.26, 0.06, 0.015, [wheelX + 0.22, 0.32, -wheelZ]));
    root.add("paintDark", roundedBox(0.18, 0.07, 0.08, 0.02, [beamX - 0.2, 0.48, 0]));
    root.add(
      "chrome",
      cyl(0.012, 0.012, 0.28, 8, [beamX + 0.1, 0.52, 0.08], [0, 0, 0.4]),
      cyl(0.012, 0.012, 0.28, 8, [beamX + 0.1, 0.52, -0.08], [0, 0, -0.4]),
    );
    root.add("plastic", roundedBox(0.08, 0.05, 0.06, 0.012, [-0.28, 0.5, 0.08]));
    root.add("lamp", box(0.02, 0.03, 0.04, [-0.32, 0.5, 0.08]));
  }

  return {
    root,
    length: atTier(tier, [1.2, 1.32, 1.52, 1.74, 2.12]),
    hitch: [-1.15, 0.3, 0],
    eye: [0.01, 0.16, 0],
  };
}

/* ------------------------------------------------------------------ */
/* Semoir                                                              */
/* ------------------------------------------------------------------ */

/**
 * Trémie sur châssis, rampe de descentes et disques ouvreurs.
 *
 * Les ouvreurs portent le rôle `tool` : relevés en transport, en terre au
 * travail. C'est le geste qui distingue un semoir d'une caisse à roues.
 */
function buildSeeder(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.16;
  const CX = -0.5;
  const n = atTier(tier, [5, 6, 8, 10, 16]);
  const barW = atTier(tier, [0.62, 0.74, 0.92, 1.12, 1.62]);
  const hopD = atTier(tier, [0.54, 0.58, 0.64, 0.72, 0.92]);
  const hopTop = atTier(tier, [0.72, 0.74, 0.76, 0.78, 0.86]);

  root.add("rim", roundedBox(0.42, 0.07, 0.08, 0.02, [-0.19, 0.25, 0], [0, 0, -0.44]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add("steel", cyl(0.018, 0.018, 0.16, 8, [-0.12, 0.16, 0.07]));

  /* — Châssis —————————————————————————————————— */
  root.add(
    "rim",
    roundedBox(0.66, 0.07, 0.09, 0.02, [CX, 0.3, 0.21]),
    roundedBox(0.66, 0.07, 0.09, 0.02, [CX, 0.3, -0.21]),
    roundedBox(0.09, 0.07, 0.5, 0.02, [CX + 0.28, 0.3, 0]),
  );

  /* — Trémie : caisse évasée, couvercle bombé ————————————— */
  const hopHalf = hopD / 2 + 0.03;
  root.add(
    "paint",
    extrude(
      [
        [-0.16, 0.33],
        [0.16, 0.33],
        [hopHalf, hopTop],
        [-hopHalf, hopTop],
      ],
      hopD,
      [CX, 0, 0],
      [0, HALF, 0],
    ),
  );
  root.add("paintDark", roundedBox(hopD + 0.1, 0.05, hopD + 0.04, 0.02, [CX, hopTop + 0.02, 0]));
  // Hublot de niveau : un semoir se juge à ce qu'il lui reste dedans.
  root.add("chrome", roundedBox(0.06, 0.2, 0.02, 0.008, [CX + hopHalf + 0.01, 0.55, 0]));
  if (tier >= 2) {
    root.add("chrome", roundedBox(0.05, 0.14, 0.018, 0.008, [CX - hopHalf - 0.01, 0.52, 0]));
  }
  if (tier >= 3) {
    root.add(
      "steel",
      tube(
        [
          [CX + 0.08, hopTop + 0.02, hopD / 2],
          [CX + 0.08, hopTop + 0.16, hopD / 2 + 0.04],
          [CX + 0.08, 0.42, hopD / 2 + 0.08],
        ],
        0.008,
      ),
    );
    for (let i = 0; i < 3; i++) {
      root.add("steel", box(0.08, 0.01, 0.012, [CX + 0.1, 0.42 + i * 0.1, hopD / 2 + 0.06]));
    }
  }

  /* — Rampe de descentes et ouvreurs ——————————————————— */
  const rampe = root.child([CX - 0.36, 0, 0], { role: "tool" });
  rampe.add("paintDark", roundedBox(0.07, 0.06, barW, 0.015, [0, 0.28, 0]));
  for (let i = 0; i < n; i++) {
    const z = n === 1 ? 0 : -barW / 2 + 0.05 + (i / (n - 1)) * (barW - 0.1);
    rampe.add("steel", cyl(0.012, 0.012, 0.22, 6, [0, 0.19, z]));
    rampe.add("chrome", lathe(
      [
        [0.02, 0.006],
        [0.075, 0.002],
        [0.075, -0.008],
        [0.02, -0.012],
      ],
      12,
      [-0.02, 0.08, z],
      [HALF, 0, 0.22],
    ));
  }

  /* — Roues ———————————————————————————————————— */
  const axleXs = tier >= 4 ? ([CX - 0.16, CX + 0.06] as const) : ([CX + 0.06] as const);
  const track = atTier(tier, [0.3, 0.32, 0.36, 0.4, 0.44]);
  for (const x of axleXs) {
    for (const z of [track, -track] as const) {
      root
        .child([x, WHEEL_R, z], { role: "wheel", radius: WHEEL_R })
        .attach(wheelPart(WHEEL_R, 0.12, 10));
    }
  }
  if (tier >= 2) {
    // Ailes repliables : le 6 m n’est plus une barre unique.
    for (const cote of [1, -1] as const) {
      rampe.add("paint", roundedBox(0.08, 0.04, barW * 0.18, 0.012, [0.03, 0.3, cote * barW * 0.42]));
    }
  }
  if (tier >= 5) {
    // Bourgault 3420 : packer, ailes très larges, trémie d’air cart.
    rampe.add("cast", cyl(0.07, 0.07, barW * 0.9, 12, [-0.22, 0.07, 0], [HALF, 0, 0]));
    rampe.add("paintDark", roundedBox(0.1, 0.05, barW, 0.015, [-0.22, 0.14, 0]));
    for (const cote of [1, -1] as const) {
      rampe.add("paint", roundedBox(0.12, 0.05, barW * 0.28, 0.015, [0.04, 0.32, cote * barW * 0.4]));
      rampe.add(
        "steel",
        cyl(0.01, 0.01, 0.32, 6, [0.02, 0.44, cote * barW * 0.46], [cote * 0.55, 0, 0]),
      );
      rampe.add("plastic", roundedBox(0.04, 0.08, 0.03, 0.008, [0.02, 0.58, cote * barW * 0.58]));
    }
    root.add("paint", cyl(0.2, 0.2, hopD * 0.42, 12, [CX + 0.06, 0.56, 0], [HALF, 0, 0]));
    root.add("paintDark", roundedBox(0.14, 0.04, hopD * 0.7, 0.015, [CX, hopTop + 0.05, 0]));
  }

  return { root, length: atTier(tier, [1.15, 1.18, 1.22, 1.28, 1.48]), hitch: [-1.0, 0.3, 0], eye: [0.01, 0.16, 0] };
}

/* ------------------------------------------------------------------ */
/* Faucheuse                                                           */
/* ------------------------------------------------------------------ */

/**
 * Lamier à disques, porté de biais derrière le tracteur.
 *
 * Les disques tournent à la prise de force — même rôle `spinner` que les
 * assiettes d'un épandeur : vite, régulièrement, et figés à l'arrêt.
 */
function buildMower(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.14;
  const butterfly = tier >= 3;
  const nCenter = butterfly ? 4 : atTier(tier, [4, 5, 6, 4, 4]);
  const nWing = atTier(tier, [0, 0, 2, 3, 4]);
  const barW = butterfly ? 0.66 : atTier(tier, [0.66, 0.8, 0.96, 0.66, 0.66]);

  root.add("paint", roundedBox(0.44, 0.075, 0.085, 0.02, [-0.18, 0.26, 0], [0, 0, -0.5]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add("steel", cyl(0.018, 0.018, 0.16, 8, [-0.12, 0.16, 0.07]));

  /* — Bâti et suspension du lamier ————————————————————— */
  root.add("paint", roundedBox(0.34, 0.09, 0.1, 0.02, [-0.46, 0.4, 0]));
  root.add("steel", cyl(0.016, 0.016, 0.3, 8, [-0.58, 0.4, 0.16], [0, 0, 0.5]));

  /* — Lamier : la barre et ses disques ————————————————— */
  const lamier = root.child([-0.76, 0, 0], { role: "tool" });

  const addBar = (parent: Part, z0: number, n: number, width: number) => {
    parent.add("paintDark", roundedBox(0.16, 0.07, width, 0.02, [0, 0.13, z0]));
    parent.add("steel", roundedBox(0.2, 0.03, width + 0.04, 0.01, [0, 0.07, z0]));
    for (let i = 0; i < n; i++) {
      const z = n === 1 ? z0 : z0 - width / 2 + 0.09 + (i / (n - 1)) * (width - 0.18);
      const disque = parent.child([0, 0.17, z], { role: "spinner", spin: i % 2 ? 1 : -1 });
      disque.add("chrome", cyl(0.075, 0.075, 0.014, 12, [0, 0, 0]));
      for (const a of [0, Math.PI]) {
        disque.add("steel", roundedBox(0.055, 0.008, 0.02, 0.004,
          [Math.cos(a) * 0.08, -0.008, Math.sin(a) * 0.08], [0, -a, 0]));
      }
    }
    parent.add("cast",
      roundedBox(0.22, 0.03, 0.07, 0.012, [0, 0.03, z0 + width / 2 - 0.05]),
      roundedBox(0.22, 0.03, 0.07, 0.012, [0, 0.03, z0 - width / 2 + 0.05]));
  };

  addBar(lamier, 0, nCenter, barW);
  if (butterfly) {
    const wingW = nWing * 0.16 + 0.02;
    const gap = barW / 2 + wingW / 2 + 0.08;
    addBar(lamier, gap, nWing, wingW);
    addBar(lamier, -gap, nWing, wingW);
    // Bras de papillon : sans eux les ailes flottent.
    lamier.add(
      "steel",
      roundedBox(0.06, 0.04, gap * 2, 0.012, [0.04, 0.22, 0]),
    );
    lamier.add(
      "chrome",
      cyl(0.012, 0.012, 0.32, 8, [0.02, 0.3, gap * 0.45], [0, 0, 0.35]),
      cyl(0.012, 0.012, 0.32, 8, [0.02, 0.3, -gap * 0.45], [0, 0, -0.35]),
    );
    if (tier >= 5) {
      lamier.add(
        "paint",
        roundedBox(0.1, 0.08, 0.1, 0.02, [0.02, 0.26, gap]),
        roundedBox(0.1, 0.08, 0.1, 0.02, [0.02, 0.26, -gap]),
      );
      lamier.add(
        "cast",
        cyl(0.04, 0.04, barW * 0.85, 10, [-0.08, 0.18, 0], [HALF, 0, 0]),
      );
      for (const cote of [1, -1] as const) {
        lamier.add("plastic", roundedBox(0.05, 0.04, 0.06, 0.01, [0.08, 0.22, cote * gap]));
        lamier.add("lamp", box(0.016, 0.024, 0.04, [0.11, 0.22, cote * gap]));
      }
    }
  }

  /* — Roue de report ——————————————————————————————— */
  root
    .child([-0.5, WHEEL_R, -0.3], { role: "wheel", radius: WHEEL_R })
    .attach(wheelPart(WHEEL_R, 0.1, 8));
  root.add("steel", roundedBox(0.055, 0.24, 0.055, 0.014, [-0.5, 0.3, -0.3]));
  if (butterfly) {
    root
      .child([-0.5, WHEEL_R, 0.3], { role: "wheel", radius: WHEEL_R })
      .attach(wheelPart(WHEEL_R, 0.1, 8));
  }

  return { root, length: 1.0, hitch: [-0.95, 0.3, 0], eye: [0.01, 0.16, 0] };
}

/* ------------------------------------------------------------------ */
/* Remorque                                                            */
/* ------------------------------------------------------------------ */

/**
 * Benne : simple essieu au T1, tandem au T3, tridem jumelé au T5.
 *
 * Elle n'a pas d'outil : une remorque ne travaille pas la terre, elle porte.
 * D'où l'absence de rôle `tool`, et des ridelles qui se lisent de loin.
 */
function buildTrailer(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.16;
  const CX = -0.62;
  const nAxles = atTier(tier, [1, 1, 2, 2, 3]);
  const sideH = atTier(tier, [0.22, 0.28, 0.36, 0.44, 0.54]);
  const bodyL = atTier(tier, [1.0, 1.06, 1.14, 1.22, 1.32]);
  const bodyW = atTier(tier, [0.56, 0.58, 0.6, 0.62, 0.64]);

  root.add("rim", roundedBox(0.44, 0.07, 0.08, 0.02, [-0.2, 0.24, 0], [0, 0, -0.36]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add("steel", cyl(0.018, 0.018, 0.16, 8, [-0.13, 0.16, 0.07]));

  /* — Châssis ————————————————————————————————— */
  root.add(
    "rim",
    roundedBox(bodyL - 0.02, 0.08, 0.1, 0.02, [CX, 0.3, 0.22]),
    roundedBox(bodyL - 0.02, 0.08, 0.1, 0.02, [CX, 0.3, -0.22]),
  );

  /* — Benne : plancher et quatre ridelles ————————————————— */
  root.add("paint", roundedBox(bodyL, 0.05, bodyW, 0.015, [CX, 0.37, 0]));
  root.add(
    "paint",
    roundedBox(bodyL, sideH, 0.045, 0.015, [CX, 0.37 + sideH / 2 + 0.02, bodyW / 2 - 0.01]),
    roundedBox(bodyL, sideH, 0.045, 0.015, [CX, 0.37 + sideH / 2 + 0.02, -(bodyW / 2 - 0.01)]),
    roundedBox(0.045, sideH, bodyW, 0.015, [CX - bodyL / 2, 0.37 + sideH / 2 + 0.02, 0]),
    roundedBox(0.045, sideH, bodyW, 0.015, [CX + bodyL / 2, 0.37 + sideH / 2 + 0.02, 0]),
  );
  // Montants : sans eux les ridelles ressemblent à du carton.
  for (const x of [CX - bodyL * 0.28, CX, CX + bodyL * 0.28]) {
    root.add("paintDark",
      roundedBox(0.035, sideH + 0.02, 0.05, 0.01, [x, 0.37 + sideH / 2 + 0.02, bodyW / 2]),
      roundedBox(0.035, sideH + 0.02, 0.05, 0.01, [x, 0.37 + sideH / 2 + 0.02, -bodyW / 2]));
  }

  /* — Essieux : simple au T1, tandem au T3, tridem jumelé au T5 —— */
  const axleSpan = atTier(tier, [0.4, 0.42, 0.46, 0.5, 0.64]);
  const track = atTier(tier, [0.29, 0.3, 0.31, 0.32, 0.28]);
  const zs = tier >= 5 ? ([0.26, 0.42, -0.26, -0.42] as const) : ([track, -track] as const);
  for (let i = 0; i < nAxles; i++) {
    const x = nAxles === 1 ? CX : CX - axleSpan / 2 + (i / (nAxles - 1)) * axleSpan;
    for (const z of zs) {
      root
        .child([x, WHEEL_R, z], { role: "wheel", radius: WHEEL_R })
        .attach(wheelPart(WHEEL_R, 0.11, 10));
    }
  }
  if (tier >= 4) {
    root.add("paintDark", roundedBox(0.12, 0.16, bodyW * 0.4, 0.03, [CX + bodyL / 2 + 0.04, 0.42, 0]));
    root.add("steel", cyl(0.04, 0.05, 0.18, 10, [CX + bodyL / 2 + 0.12, 0.32, 0], [0, 0, HALF]));
  }
  if (tier >= 2) {
    root.add("plastic", roundedBox(0.05, 0.04, 0.05, 0.01, [CX + bodyL / 2 - 0.08, 0.4 + sideH, bodyW / 2]));
    root.add("lamp", box(0.016, 0.025, 0.035, [CX + bodyL / 2 - 0.05, 0.4 + sideH, bodyW / 2]));
    root.add("tail", box(0.016, 0.025, 0.035, [CX - bodyL / 2 + 0.05, 0.4 + sideH, bodyW / 2]));
  }
  if (tier >= 5) {
    const topY = 0.4 + sideH;
    for (const x of [CX - bodyL * 0.3, CX, CX + bodyL * 0.3]) {
      root.add("steel", cyl(0.01, 0.01, bodyW * 0.92, 6, [x, topY + 0.08, 0], [HALF, 0, 0]));
      root.add("steel", cyl(0.008, 0.008, 0.1, 6, [x, topY + 0.03, 0]));
    }
    root.add(
      "steel",
      tube(
        [
          [CX + bodyL / 2, 0.38, bodyW / 2],
          [CX + bodyL / 2 + 0.04, topY * 0.6, bodyW / 2 + 0.04],
          [CX + bodyL / 2 + 0.04, 0.42, bodyW / 2 + 0.06],
        ],
        0.008,
      ),
    );
    for (let i = 0; i < 4; i++) {
      root.add("steel", box(0.09, 0.012, 0.012, [CX + bodyL / 2 + 0.02, 0.38 + i * 0.1, bodyW / 2 + 0.04]));
    }
  }

  return { root, length: atTier(tier, [1.35, 1.4, 1.48, 1.56, 1.68]), hitch: [-1.2, 0.3, 0], eye: [0.01, 0.16, 0] };
}


/* ------------------------------------------------------------------ */
/* Pulvérisateur                                                       */
/* ------------------------------------------------------------------ */

/**
 * Cuve sur châssis, rampe déployée de part et d'autre.
 *
 * C'est l'engin le plus large du parc et il doit se lire comme tel : la rampe
 * porte le rôle `tool`, donc elle se relève en transport et redescend au
 * travail — le geste qui distingue un pulvérisateur d'une citerne à roues.
 */
function buildSprayer(tier: MachineTier = 1): Blueprint {
  const root = new Part();
  const WHEEL_R = 0.16;
  const CX = -0.52;
  const nNozzles = atTier(tier, [5, 6, 9, 12, 16]);
  const tankR = atTier(tier, [0.22, 0.24, 0.26, 0.28, 0.3]);
  const tankL = atTier(tier, [0.62, 0.68, 0.76, 0.88, 1.0]);
  // T3+ : cabine d’automoteur. T4+ : garde au sol — le timon reste à 0,16.
  const auto = tier >= 3;
  const clearance = tier >= 4 ? 0.08 : 0;
  const tankY = 0.33 + tankR + clearance;
  const boomY = 0.42 + clearance;

  /* — Timon, anneau, béquille — la chape commune à tous les outils —— */
  root.add("rim", roundedBox(0.44, 0.07, 0.08, 0.02, [-0.19, 0.25, 0], [0, 0, -0.44]));
  root.add("chrome", ring(0.042, 0.012, 12, Math.PI * 2, [0.01, 0.16, 0], [HALF, 0, 0]));
  root.add("steel", cyl(0.018, 0.018, 0.16, 8, [-0.12, 0.16, 0.07]));

  /* — Châssis ————————————————————————————————— */
  root.add(
    "rim",
    roundedBox(tankL + 0.06, 0.07, 0.09, 0.02, [CX, 0.3 + clearance, 0.2]),
    roundedBox(tankL + 0.06, 0.07, 0.09, 0.02, [CX, 0.3 + clearance, -0.2]),
    roundedBox(0.09, 0.07, 0.48, 0.02, [CX + tankL * 0.48, 0.3 + clearance, 0]),
  );

  /* — Cuve : un cylindre couché, la forme qui dit « liquide » ————— */
  root.add("paint", cyl(tankR, tankR, tankL, 14, [CX, tankY, 0], [0, 0, HALF]));
  root.add("paintDark", cyl(tankR + 0.005, tankR + 0.005, 0.05, 14, [CX + tankL / 2 - 0.01, tankY, 0], [0, 0, HALF]));
  // Jauge de niveau : on juge une cuve à ce qu'il lui reste dedans.
  root.add("chrome", roundedBox(0.04, tankR * 1.36, 0.02, 0.008, [CX + tankL / 2 + 0.01, tankY, 0.06], [0, 0, 0.2]));
  root.add("steel", cyl(0.05, 0.05, 0.05, 10, [CX, tankY + tankR + 0.01, 0]));
  if (tier >= 2) {
    root.add(
      "paintDark",
      cyl(tankR + 0.008, tankR + 0.008, 0.04, 14, [CX - tankL * 0.18, tankY, 0], [0, 0, HALF]),
      cyl(tankR + 0.008, tankR + 0.008, 0.04, 14, [CX + tankL * 0.18, tankY, 0], [0, 0, HALF]),
    );
  }
  if (auto) {
    // Pantera / Rogator / Leeb : cabine vitrée posée à l’avant de la cuve,
    // au-dessus du cylindre — sinon le verre se noie dans le blanc de la cuve.
    // Pas de pot : l’outil reste attelé, le hitch à 0,16.
    const cabX = CX + tankL * 0.52;
    const cabW = 0.34 + 0.02 * Math.max(0, tier - 3);
    const cabH = 0.26;
    const cabLen = 0.3;
    const cabMidY = tankY + tankR * 0.15 + cabH * 0.45;
    root.add("glass", roundedBox(cabLen, cabH, cabW, 0.03, [cabX, cabMidY, 0]));
    root.add("paint", roundedBox(cabLen * 0.92, 0.032, cabW * 0.92, 0.02, [cabX, cabMidY + cabH * 0.5 + 0.02, 0]));
    root.add("paintDark", roundedBox(cabLen * 0.7, 0.06, cabW * 0.92, 0.02, [cabX, cabMidY - cabH * 0.42, 0]));
    root.add("plastic", ball(0.018, [cabX - 0.04, cabMidY + cabH * 0.5 + 0.055, 0]));
    for (const [dx, dz] of [
      [0.12, 0.15],
      [0.12, -0.15],
      [-0.12, 0.15],
      [-0.12, -0.15],
    ] as const) {
      root.add("paintDark", cyl(0.012, 0.012, cabH, 8, [cabX + dx, cabMidY, dz]));
    }
  }
  if (tier >= 5) {
    root.add("paint", cyl(tankR * 0.42, tankR * 0.42, 0.28, 12, [CX + tankL * 0.22, tankY - 0.02, 0.22], [0, 0, HALF]));
    root.add("plastic", roundedBox(0.07, 0.05, 0.05, 0.012, [CX, tankY + tankR + 0.04, 0.12]));
    root.add("lamp", box(0.02, 0.03, 0.04, [CX, tankY + tankR + 0.04, 0.15]));
  }

  /* — Rampe : centre et deux volets, très large ——————————————— */
  const rampe = root.child([CX - 0.36, 0, 0], { role: "tool" });
  rampe.add("paintDark", roundedBox(0.06, 0.05, 0.34, 0.012, [0, boomY, 0]));
  const lastZ = 0.2 + (nNozzles - 1) * 0.12;
  const wingLen = lastZ - 0.16;
  const wingMid = 0.16 + wingLen / 2;
  for (const cote of [1, -1]) {
    rampe.add(
      "steel",
      roundedBox(0.045, 0.035, wingLen, 0.01, [0, boomY, cote * wingMid]),
      roundedBox(0.03, 0.025, wingLen * 0.58, 0.008, [0, boomY + 0.08, cote * (wingMid * 0.72)]),
    );
    for (let i = 0; i < nNozzles; i++) {
      const z = cote * (0.2 + i * 0.12);
      rampe.add("chrome", cone(0.016, 0.05, 6, [0, boomY - 0.04, z], [Math.PI, 0, 0]));
    }
    rampe.add("steel", cyl(0.008, 0.008, nNozzles === 5 ? 0.4 : Math.min(0.48, wingLen * 0.32), 6, [0, nNozzles === 5 ? boomY + 0.05 : boomY + 0.14, cote * (nNozzles === 5 ? 0.24 : wingMid * 0.4)], [cote * (nNozzles === 5 ? 0.42 : 0.16), 0, 0]));
    if (tier >= 4) {
      rampe.add("cast", ball(0.028, [0, boomY + 0.02, cote * 0.18]));
      rampe.add("paintDark", roundedBox(0.05, 0.06, 0.05, 0.012, [0, boomY + 0.06, cote * wingMid]));
    }
  }
  if (tier >= 5) {
    rampe.add("paintDark", roundedBox(0.08, 0.07, 0.1, 0.018, [0, boomY + 0.08, 0]));
    rampe.add("steel", roundedBox(0.04, 0.04, lastZ * 2, 0.01, [0, boomY + 0.14, 0]));
    for (let i = 0; i < 8; i++) {
      const z = -lastZ * 0.82 + (i / 7) * lastZ * 1.64;
      rampe.add("lamp", ball(0.012, [0.03, boomY + 0.16, z]));
    }
  }

  /* — Roues ———————————————————————————————————— */
  const axleXs = tier >= 4 ? ([CX - 0.16, CX + 0.14] as const) : ([CX] as const);
  const track = atTier(tier, [0.28, 0.3, 0.32, 0.34, 0.36]);
  for (const x of axleXs) {
    for (const z of [track, -track] as const) {
      root
        .child([x, WHEEL_R, z], { role: "wheel", radius: WHEEL_R })
        .attach(wheelPart(WHEEL_R, 0.11, 10));
      if (tier >= 4) {
        root.add("steel", cyl(0.014, 0.014, 0.1 + clearance, 6, [x, 0.22 + clearance * 0.5, z]));
      }
    }
  }

  return { root, length: atTier(tier, [1.15, 1.18, 1.24, 1.36, 1.48]), hitch: [-1.0, 0.3, 0], eye: [0.01, 0.16, 0] };
}

const BUILDERS: Record<MachineType, (tier: MachineTier) => Blueprint> = {
  TRACTOR: buildTractor,
  HARVESTER: buildHarvester,
  FORAGE_HARVESTER: buildForageHarvester,
  PLOUGH: buildPlough,
  SEEDER: buildSeeder,
  SPREADER: buildSpreader,
  DISC_HARROW: buildDiscHarrow,
  MOWER: buildMower,
  SPRAYER: buildSprayer,
  BALER: buildBaler,
  TRAILER: buildTrailer,
};

const blueprints = new Map<string, Blueprint>();

function blueprint(type: MachineType, tier: MachineTier = 1): Blueprint {
  const t = asTier(tier);
  const key = `${type}-${t}`;
  let bp = blueprints.get(key);
  if (!bp) {
    bp = BUILDERS[type](t);
    blueprints.set(key, bp);
  }
  return bp;
}

/**
 * Outils traînés : sans moteur, il leur faut un tracteur.
 *
 * La presse à balles manquait à l'appel. Elle est pourtant **bâtie** comme un
 * outil traîné — origine sur l'anneau d'attelage, développement vers les X
 * négatifs, béquille et cardan — mais elle était annoncée « automoteur » :
 * l'atelier l'affichait plantée seule au milieu du pré, et rien ne l'attelait
 * derrière un tracteur au champ.
 */
const TOWED: MachineType[] = [
  "PLOUGH",
  "SEEDER",
  "SPREADER",
  "DISC_HARROW",
  "MOWER",
  "SPRAYER",
  "BALER",
  "TRAILER",
];

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
  /**
   * État de la machine, 0 à 100 comme dans le jeu. En dessous du seuil de
   * révision, la peinture se ternit, le chrome s'oxyde et les pneus
   * blanchissent : l'entretien se lit sur le champ, pas seulement au garage.
   */
  condition?: number;
  /** Ombres portées */
  shadows?: boolean;
  /** Graine de variation de teinte, pour ne pas cloner deux engins voisins */
  seed?: number;
  /** Palier catalogue : un T5 n’est pas un T1 agrandi, il a une autre silhouette. */
  tier?: MachineTier;
};

export type MachineRig = {
  /** À ajouter à la scène ; l'appelant en pilote position et rotation */
  group: THREE.Group;
  /** Emprise au sol, unités monde */
  length: number;
  /** Sortie du pot d'échappement — nul sur un outil traîné */
  exhaust: THREE.Object3D | null;
  /**
   * Nœuds animés d'un rôle donné — rabatteur, trains de disques, disques
   * d'épandage… La vue s'en sert comme points d'émission : les gerbes partent
   * de la pièce qui les produit, pas d'un point approximatif.
   */
  anchors(role: Role): THREE.Object3D[];
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

/**
 * Usure visible, de 0 (neuve) à 1. Une machine reste présentable jusqu'aux
 * trois quarts de sa vie : la dégradation ne se voit que dans le dernier
 * tiers, là où le jeu demande justement d'intervenir.
 */
function wearOf(condition: number | undefined): number {
  if (condition == null) return 0;
  const c = Math.max(0, Math.min(100, condition));
  return Math.max(0, Math.min(1, (75 - c) / 65));
}

function createUnit(type: MachineType, opts: MachineRigOptions): Unit {
  const bp = blueprint(type, asTier(opts.tier));
  const materials = createMaterials(PALETTES[type], opts.seed ?? 0, wearOf(opts.condition));
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

  // Trains de disques : entraînés par le sol, donc par la distance — et
  // seulement au travail : relevés en transport, ils ne raclent plus.
  if (s.working) {
    for (const gang of roles.get("gang") ?? []) {
      const r = (gang.userData.radius as number) || 0.16;
      const dir = (gang.userData.spin as number) || 1;
      gang.rotation.z = (-s.distance / r) * dir;
    }
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
  const palier = asTier(opts.tier);
  let length = blueprint(type, palier).length;

  if (opts.towed && isTowedImplement(type)) {
    const tractor = createUnit("TRACTOR", opts);
    const implement = createUnit(type, { ...opts, seed: (opts.seed ?? 0) + 7 });
    // L'anneau de l'outil vient se poser sur la chape du tracteur : attelage
    // jointif, plutôt qu'un outil qui flotte derrière son timon.
    const hitch = blueprint("TRACTOR", palier).hitch;
    const eye = blueprint(type, palier).eye;
    implement.group.position.set(hitch[0] - eye[0], hitch[1] - eye[1], 0);
    group.add(tractor.group, implement.group);
    units.push(tractor, implement);
    length = blueprint("TRACTOR", palier).length + blueprint(type, palier).length;
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
    exhaust: units[0].roles.get("exhaust")?.[0] ?? null,
    anchors(role) {
      const found: THREE.Object3D[] = [];
      for (const unit of units) found.push(...(unit.roles.get(role) ?? []));
      return found;
    },
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

const CARGO_TINT: Record<string, number> = {
  WHEAT: 0xe8c65e,
  BARLEY: 0xe6d27a,
  MAIZE: 0xf0c33c,
  RAPE: 0xf2d429,
  PEA: 0xc6d45a,
  HAY: 0xc9c46a,
  MILK: 0xf4f0e8,
  EGGS: 0xf3e6c4,
  WOOL: 0xf0ebe3,
  MEAT: 0xd47a6a,
  MANURE: 0x5a3d24,
};

/** Accroche une remorque derrière le tracteur, pour une livraison. */
export function hitchTrailer(rig: MachineRig, commodity?: string): void {
  if (rig.group.userData.hauled) return;
  const cargo = CARGO_TINT[commodity ?? ""] ?? 0xc9a36a;
  const trailer = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: true });
  const load = new THREE.MeshLambertMaterial({ color: cargo, flatShading: true });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.4), wood);
  bed.position.set(0, 0.16, 0);
  trailer.add(bed);
  const heap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.28), load);
  heap.position.set(0, 0.28, 0);
  trailer.add(heap);
  const hitch = blueprint("TRACTOR").hitch;
  trailer.position.set(hitch[0] - 0.42, 0, 0);
  rig.group.add(trailer);
  rig.group.userData.hauled = true;
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
/**
 * Fumée d'échappement : bouffées grises qui montent et s'étalent en se
 * diluant. Plus légères et plus lentes que la poussière du sol — un moteur qui
 * tire fume, il ne soulève pas de la terre.
 */
export function createExhaustSmoke(count = 12): DustTrail {
  return createDustTrail(count, 0x7c7a76, {
    rise: 0.5,
    spread: 0.04,
    grow: 3.2,
    fade: 1.0,
    interval: 0.11,
    opacity: 0.42,
  });
}

export type PuffOptions = {
  /** Vitesse de montée, unités par seconde */
  rise?: number;
  /** Dispersion horizontale à l'émission */
  spread?: number;
  /** Grossissement sur la durée de vie */
  grow?: number;
  /** Vitesse d'extinction */
  fade?: number;
  /** Délai entre deux bouffées, secondes */
  interval?: number;
  /** Opacité initiale */
  opacity?: number;
};

export function createDustTrail(count = 8, color = 0xd8c9a8, opts: PuffOptions = {}): DustTrail {
  const rise = opts.rise ?? 0.18;
  const spread = opts.spread ?? 0.12;
  const grow = opts.grow ?? 0.9;
  const fade = opts.fade ?? 2;
  const interval = opts.interval ?? 0.09;
  const baseOpacity = opts.opacity ?? 0.35;
  const object = new THREE.Group();
  if (!dustGeometry) dustGeometry = markShared(new THREE.IcosahedronGeometry(0.07, 0));
  const geo = dustGeometry;
  const mat = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    transparent: true,
    opacity: baseOpacity,
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
        cooldown = interval;
        const puff = puffs[next];
        next = (next + 1) % puffs.length;
        puff.life = 1;
        puff.mesh.position.set(
          x + (Math.random() - 0.5) * spread,
          y,
          z + (Math.random() - 0.5) * spread,
        );
        puff.mesh.scale.setScalar(0.5);
        puff.mesh.visible = true;
      }
      for (const puff of puffs) {
        if (puff.life <= 0) continue;
        puff.life -= dt * fade;
        if (puff.life <= 0) {
          puff.mesh.visible = false;
          continue;
        }
        puff.mesh.position.y += dt * rise;
        puff.mesh.scale.setScalar(0.5 + (1 - puff.life) * grow);
        (puff.mesh.material as THREE.MeshLambertMaterial).opacity = puff.life * baseOpacity;
      }
    },
    dispose() {
      for (const puff of puffs) (puff.mesh.material as THREE.Material).dispose();
      mat.dispose();
      object.clear();
    },
  };
}
