/**
 * Le village et ses enseignes : ce qu'il y a autour des champs.
 *
 * La campagne n'était que des parcelles, une route et des arbres : on y
 * cherchait en vain un endroit où aller. Trois lieux servent — la coopérative
 * où l'on vend, la concession où l'on achète ses engins, la mairie où l'on
 * achète ses terres — et trois autres habitent le paysage : un étang, un
 * verger, un rucher.
 *
 * Tout est bâti avec les modèles du jeu (`createBuildingRig`,
 * `createMachineRig`) et ses couleurs : un village dessiné à part jurerait
 * avec la ferme d'à côté.
 */

import * as THREE from "three";
import { createBuildingRig, type BuildingRig } from "./buildings3d";
import { createMachineRig, type MachineRig } from "./machines3d";
import { ajouterArbre, ajouterBoite, maillageFacette } from "./decor3d";
import { COTE_LIEU, type GenreLieu, type Lieu } from "./countryside-plan";

/** Les bâtiments du bourg sont plus grands que ceux d'une ferme. */
const ECHELLE_BOURG = 1.55;

/** Le bois des clôtures et des piquets, celui de la cour. */
export const BOIS = 0x7a5534;
const BOIS_CLAIR = 0x9c7650;
const CREME = 0xf4e7c5;
const LISERE = 0xc9542e;
const VERT_SOMBRE = 0x2f5d3a;

/** Ce qu'une enseigne affiche, et dans quelles couleurs. */
type Enseigne = { texte: string; fond: string; encre: string; bord: string };

const ENSEIGNES: Record<"VENTE" | "COOPERATIVE" | "CONCESSION" | "MAIRIE", Enseigne> = {
  VENTE: { texte: "À VENDRE", fond: "#f4e7c5", encre: "#b3431f", bord: "#c9542e" },
  COOPERATIVE: { texte: "COOPÉRATIVE", fond: "#f4e7c5", encre: "#2f5d3a", bord: "#2f5d3a" },
  CONCESSION: { texte: "CONCESSION", fond: "#f4e7c5", encre: "#8a3b1d", bord: "#c9542e" },
  MAIRIE: { texte: "MAIRIE", fond: "#f4e7c5", encre: "#23407a", bord: "#23407a" },
};

/**
 * Une enseigne peinte : fond crème, liseré, lettres dans la police du jeu.
 *
 * Une texture de canevas, et non des lettres en volumes : lisible de loin,
 * et un seul quad par panneau. Sans canevas (les tests, un navigateur sans
 * contexte 2D), `null` — le panneau reste un aplat de couleur, sans texte.
 */
function texteEnseigne(e: Enseigne): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 224;
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return null;
  ctx.fillStyle = e.bord;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = e.fond;
  ctx.fillRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.fillStyle = e.encre;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // La plus grande taille qui tient dans le panneau.
  let taille = 120;
  do {
    ctx.font = `800 ${taille}px "Baloo 2", Signika, system-ui, sans-serif`;
    taille -= 4;
  } while (ctx.measureText(e.texte).width > canvas.width - 70 && taille > 40);
  ctx.fillText(e.texte, canvas.width / 2, canvas.height / 2 + 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Ce qu'il faut jeter avec la campagne. */
export type Jetables = { geometries: THREE.BufferGeometry[]; materiaux: THREE.Material[]; textures: THREE.Texture[] };

function boite(
  j: Jetables,
  w: number,
  h: number,
  d: number,
  couleur: number,
  shadows: boolean,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color: couleur, flatShading: true });
  j.geometries.push(geo);
  j.materiaux.push(mat);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  return m;
}

/**
 * Un panneau sur deux piquets, tourné vers la caméra.
 *
 * La vue isométrique regarde depuis les `x` et `z` positifs : un quart de
 * demi-tour (`π/4`) met la face droit vers l'œil, où qu'on la pose.
 */
export function creerPanneau(
  genre: keyof typeof ENSEIGNES,
  j: Jetables,
  o: { largeur?: number; hauteur?: number; shadows?: boolean } = {},
): THREE.Group {
  const shadows = o.shadows ?? false;
  const L = o.largeur ?? 2.8;
  const H = (o.hauteur ?? 1.25) * (L / 2.8);
  const e = ENSEIGNES[genre];
  const g = new THREE.Group();
  g.name = `panneau-${genre}`;
  const pied = 1.25 * (L / 2.8);
  for (const sx of [-1, 1]) {
    const piquet = boite(j, 0.16, pied + H, 0.16, BOIS, shadows);
    piquet.position.set(sx * (L / 2 - 0.25), (pied + H) / 2, -0.02);
    g.add(piquet);
  }
  const cadre = boite(j, L, H, 0.1, parseInt(e.bord.slice(1), 16), shadows);
  cadre.position.set(0, pied + H / 2, 0);
  g.add(cadre);
  const chapeau = boite(j, L + 0.2, 0.12, 0.2, BOIS, shadows);
  chapeau.position.set(0, pied + H + 0.06, 0);
  g.add(chapeau);
  const texture = texteEnseigne(e);
  if (texture) {
    j.textures.push(texture);
    const geo = new THREE.PlaneGeometry(L - 0.16, H - 0.16);
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    j.geometries.push(geo);
    j.materiaux.push(mat);
    const face = new THREE.Mesh(geo, mat);
    face.position.set(0, pied + H / 2, 0.056);
    g.add(face);
  } else {
    const face = boite(j, L - 0.16, H - 0.16, 0.02, CREME, false);
    face.position.set(0, pied + H / 2, 0.06);
    g.add(face);
  }
  g.rotation.y = Math.PI / 4;
  return g;
}

/** Un lieu monté : son groupe, et les modèles à animer ou jeter. */
export type LieuMonte = {
  group: THREE.Group;
  batiments: BuildingRig[];
  engins: MachineRig[];
};

/** Les lieux où l'on peut aller : un clic les ouvre. */
export function lieuUtile(genre: GenreLieu): boolean {
  return genre === "COOPERATIVE" || genre === "CONCESSION" || genre === "MAIRIE";
}

/**
 * Un lieu du village, posé sur son emprise.
 *
 * `pasCase` met les bâtiments à l'échelle des cases, comme ceux des fermes
 * voisines ; `y` est le sol de la campagne.
 */
export function creerLieu(
  lieu: Lieu,
  o: { pasCase: number; y: number; shadows: boolean; jetables: Jetables },
): LieuMonte {
  const { pasCase, y, shadows, jetables: j } = o;
  const group = new THREE.Group();
  group.name = "campagne-lieu";
  group.userData.genre = lieu.genre;
  group.position.set(lieu.x, y, lieu.z);
  const batiments: BuildingRig[] = [];
  const engins: MachineRig[] = [];
  const pos: number[] = [];
  const col: number[] = [];
  const demi = COTE_LIEU / 2;

  const batiment = (type: Parameters<typeof createBuildingRig>[0], x: number, z: number, quarts = 0, seed = 0) => {
    const rig = createBuildingRig(type, { level: 2, seed, shadows });
    // Plus grands que ceux d'une ferme : ce sont des bâtiments de bourg, et
    // à l'échelle d'une case ils disparaissaient derrière leur enseigne.
    rig.group.scale.setScalar(pasCase * ECHELLE_BOURG);
    rig.group.position.set(x, 0.03, z);
    rig.group.rotation.y = quarts * (Math.PI / 2);
    group.add(rig.group);
    batiments.push(rig);
  };
  /*
   * L'enseigne au coin gauche de l'emprise, à l'écran : devant, elle cachait
   * le bâtiment qu'elle annonce.
   */
  const panneau = (genre: keyof typeof ENSEIGNES) => {
    const p = creerPanneau(genre, j, { largeur: 3.8, shadows });
    const x = -demi + 1.3;
    const z = demi - 1.3;
    p.position.set(x, 0, z);
    group.add(p);
  };

  // La cour du lieu : un gravier bordé, comme la cour de la ferme.
  if (lieuUtile(lieu.genre)) {
    ajouterBoite(pos, col, 0, 0.01, 0, COTE_LIEU + 0.3, 0.04, COTE_LIEU + 0.3, 0xb8a275);
    ajouterBoite(pos, col, 0, 0.03, 0, COTE_LIEU, 0.04, COTE_LIEU, 0xdcc9a0);
  }

  switch (lieu.genre) {
    case "COOPERATIVE": {
      // Deux silos et le hangar de collecte : la coopérative se reconnaît à
      // ses cellules à grain bien avant de lire son enseigne.
      batiment("SILO", -2.1, -2.1, 0, 11);
      batiment("SILO", 0.4, -2.4, 0, 12);
      batiment("HAY_BARN", 1.9, 0.2, 1, 13);
      panneau("COOPERATIVE");
      // Des sacs de grain empilés devant le hangar.
      for (let i = 0; i < 6; i++) {
        ajouterBoite(pos, col, -0.3 + (i % 3) * 0.55, 0.2 + Math.floor(i / 3) * 0.32, 1.5, 0.5, 0.3, 0.4, 0xe3cf9c);
      }
      break;
    }
    case "CONCESSION": {
      // Le hall d'exposition, et deux tracteurs neufs devant, sur leur dalle.
      batiment("MACHINE_SHED", -0.6, -1.9, 0, 21);
      for (const [x, z, tier] of [
        [2.2, 0.4, 3],
        [0.6, 2.2, 4],
      ] as const) {
        const rig = createMachineRig("TRACTOR", { shadows, tier, seed: 5 + tier });
        rig.group.scale.setScalar(1.05);
        rig.group.position.set(x, 0.06, z);
        rig.group.rotation.y = -Math.PI / 4;
        group.add(rig.group);
        engins.push(rig);
      }
      // Les fanions de la concession.
      for (let i = 0; i < 3; i++) {
        const x = -demi + 0.6 + i * 1.2;
        ajouterBoite(pos, col, x, 1.1, demi - 0.4, 0.07, 2.2, 0.07, 0xdedede);
        ajouterBoite(pos, col, x + 0.22, 1.95, demi - 0.4, 0.4, 0.3, 0.03, [LISERE, 0xe8b53a, VERT_SOMBRE][i]!);
      }
      panneau("CONCESSION");
      break;
    }
    case "MAIRIE": {
      batiment("FARMHOUSE", -0.6, -1.1, 0, 31);
      // Le mât et ses trois couleurs.
      ajouterBoite(pos, col, 2.2, 1.6, -2.0, 0.09, 3.2, 0.09, 0xe6e6e6);
      for (const [i, c] of [0x23407a, 0xf5f5f5, 0xc8323c].entries()) {
        ajouterBoite(pos, col, 2.45 + i * 0.32, 2.95, -2.0, 0.32, 0.5, 0.03, c);
      }
      // Deux arbres de place, taillés en boule.
      ajouterArbre(pos, col, 2.7, 0, 2.2, 1.1, 41);
      ajouterArbre(pos, col, 2.9, 0, 0.2, 1.0, 42);
      panneau("MAIRIE");
      break;
    }
    case "ETANG": {
      // Un disque d'eau à bord de roseaux, et un ponton.
      const eau: number[] = [];
      const eauCol: number[] = [];
      const n = 20;
      const rayon = (k: number) => 2.9 + Math.sin(k * 2.1) * 0.35 + Math.cos(k * 1.3) * 0.25;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        const r0 = rayon(k);
        const r1 = rayon(k + 1);
        for (const [r, h, c] of [
          [1.18, 0.012, new THREE.Color(0x8aa65a)],
          [1, 0.03, new THREE.Color(0x6fb4d6)],
        ] as const) {
          eau.push(0, h, 0, Math.cos(a1) * r1 * r, h, Math.sin(a1) * r1 * r, Math.cos(a0) * r0 * r, h, Math.sin(a0) * r0 * r);
          for (let v = 0; v < 3; v++) eauCol.push(c.r, c.g, c.b);
        }
      }
      const m = maillageFacette(eau, eauCol, { nom: "etang" });
      j.geometries.push(m.geometry);
      j.materiaux.push(m.material as THREE.Material);
      group.add(m);
      for (let k = 0; k < 14; k++) {
        const a = k * 0.9 + 0.4;
        const r = rayon(k) * 1.05;
        ajouterBoite(pos, col, Math.cos(a) * r, 0.35, Math.sin(a) * r, 0.07, 0.7 + (k % 3) * 0.15, 0.07, 0x6f9a3a);
      }
      ajouterBoite(pos, col, 2.6, 0.12, 0.6, 1.8, 0.08, 0.7, BOIS_CLAIR);
      break;
    }
    case "VERGER": {
      // Trois rangs de pommiers, leurs fruits en pointillés rouges.
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 3; k++) {
          const x = -2.3 + i * 2.3;
          const z = -2.3 + k * 2.3;
          ajouterArbre(pos, col, x, 0, z, 0.85, 100 + i * 3 + k);
          for (let f = 0; f < 3; f++) {
            ajouterBoite(pos, col, x + Math.cos(f * 2.1) * 0.55, 1.5 + (f % 2) * 0.35, z + Math.sin(f * 2.1) * 0.55, 0.14, 0.14, 0.14, 0xd9463c);
          }
        }
      }
      break;
    }
    case "RUCHER": {
      // Des ruches en rang, sur un pré fleuri.
      for (let i = 0; i < 4; i++) {
        const x = -2.2 + i * 1.45;
        ajouterBoite(pos, col, x, 0.28, 0, 0.62, 0.5, 0.52, i % 2 ? 0xf2d77a : 0xf4efe0);
        ajouterBoite(pos, col, x, 0.58, 0, 0.74, 0.1, 0.64, 0xc9a45a);
      }
      for (let f = 0; f < 26; f++) {
        const a = f * 2.39;
        const r = 1.2 + (f % 5) * 0.5;
        ajouterBoite(pos, col, Math.cos(a) * r, 0.05, Math.sin(a) * r + 0.6, 0.16, 0.08, 0.16, [0xf2f2f2, 0xf5c542, 0xd96c8a][f % 3]!);
      }
      break;
    }
  }
  if (pos.length) {
    const m = maillageFacette(pos, col, { shadows, recoit: shadows, nom: "lieu-decor" });
    j.geometries.push(m.geometry);
    j.materiaux.push(m.material as THREE.Material);
    group.add(m);
  }
  return { group, batiments, engins };
}
