/**
 * Une parcelle de voisin, en détail.
 *
 * ## Le reproche
 *
 * « La parcelle devait ressembler à la nôtre avec des cultures, élevage, tout
 * ça. » Les champs alentour étaient un damier de couleur, une haie, et parfois
 * une grange générique : de loin ça passait, de près c'était du papier peint.
 *
 * ## Ce qu'on fait, et ce qu'on ne fait pas
 *
 * On réutilise les modules du jeu plutôt que d'en écrire de moins bons :
 * `crop-field` pour les brins instanciés, `buildings3d` pour les vrais
 * bâtiments — ceux que le joueur construit —, `animal-meshes` pour les bêtes.
 * Un décor peint à part finirait toujours par ne plus ressembler au jeu.
 *
 * Les **bâtiments** du cadastre sont les mêmes partout : une étable de voisin
 * est une étable, un silo est un silo. Ce qui reste en LOD, ce sont les
 * cultures et les bêtes — trente champs en brins instanciés feraient cent
 * mille tiges. Seules les parcelles regardées passent en détail pour ça.
 *
 * ## Ce qu'on invente, faute de mieux
 *
 * La route rend un **résumé** — culture dominante, stade, part emblavée — et
 * non les cent quarante-quatre cases. Descendre les cases coûterait cinquante
 * fois plus de réseau pour un champ qu'on regarde de trente unités. On répartit
 * donc les brins sur la part annoncée, dans un ordre tiré de l'identifiant de
 * la parcelle : ce n'est pas le semis exact du voisin, c'est la bonne surface
 * de la bonne culture au bon stade, et à cette distance c'est ce qui se voit.
 */

import * as THREE from "three";
import { BUILDING_DEFS, type BuildingType } from "@farmsim/shared";
import { createBuildingRig, type BuildingRig } from "./buildings3d";
import { createCropField, type CropField } from "./crop-field";
import type { CropShape } from "./crop-shapes";
import { applyHerdPose, meshForHerd } from "./animal-meshes";
import { couleurChamp, grainerDe, suite, type ParcelleVoisine } from "./countryside-plan";

export type OptionsVoisin = {
  parcelle: ParcelleVoisine;
  /** Côté de la parcelle, talus compris. */
  emprise: number;
  /** Cases par côté, comme sur celle du joueur. */
  cases: number;
  /** Altitude du sol de la campagne. */
  y: number;
  shadows?: boolean;
  /** Réglage sobre : semis éclairci, moins de bêtes. */
  sobre?: boolean;
  /**
   * Poser les bâtiments ici.
   *
   * À `false`, c'est la campagne qui les pose une fois pour toutes — les
   * mêmes modèles, sur toutes les parcelles du cadastre, pas seulement
   * celles qu'on regarde. Le détail ne s'occupe plus que des cultures et
   * des bêtes.
   */
  batiments?: boolean;
};

/** Un ouvrage du cadastre, tel que la route le rend. */
export type BatimentCadastre = {
  type: string;
  level: number;
  x: number;
  y: number;
  rotation: number;
};

/**
 * Les vrais bâtiments du jeu, à leur place sur la grille.
 *
 * C'est le même `createBuildingRig` que sur la parcelle du joueur : un silo
 * reste un silo, une étable une étable. Une grange générique tirée au sort
 * racontait la même chose de toutes les fermes.
 *
 * Les positions sont **locales** à la parcelle : l'appelant ajoute le centre
 * du champ s'il pose dans le monde.
 */
export function poserBatimentsVoisin(o: {
  batiments: readonly BatimentCadastre[];
  pasCase: number;
  origine: number;
  grain: number;
  shadows?: boolean;
  y?: number;
}): BuildingRig[] {
  const y = o.y ?? 0.02;
  const rigs: BuildingRig[] = [];
  for (const b of o.batiments) {
    const def = BUILDING_DEFS[b.type as BuildingType];
    if (!def) continue;
    const quarts = (((b.rotation ?? 0) % 4) + 4) % 4;
    const fw = quarts % 2 === 0 ? def.w : def.h;
    const fh = quarts % 2 === 0 ? def.h : def.w;
    const rig = createBuildingRig(b.type as BuildingType, {
      level: b.level ?? 1,
      seed: o.grain + b.x * 7.3 + b.y * 3.1,
      shadows: o.shadows ?? false,
    });
    rig.group.scale.setScalar(o.pasCase);
    rig.group.position.set(
      o.origine + (b.x + (fw - 1) / 2) * o.pasCase,
      y,
      o.origine + (b.y + (fh - 1) / 2) * o.pasCase,
    );
    rig.group.rotation.y = quarts * (Math.PI / 2);
    rig.group.name = "voisin-batiment";
    rig.group.userData.type = b.type;
    rigs.push(rig);
  }
  return rigs;
}

export type VoisinDetaille = {
  object: THREE.Group;
  /** `t` en secondes de scène, `vent` de 0 (calme) à 1 (rafale). */
  update(t: number, vent: number): void;
  dispose(): void;
};

/** Combien de bêtes on montre au plus, quelle que soit la taille du troupeau. */
export const BETES_MAX = 5;

/**
 * La hauteur d'un brin selon le stade.
 *
 * Les mêmes valeurs que sur la parcelle du joueur : un champ de voisin qui
 * pousserait plus haut que le sien se remarquerait aussitôt.
 */
const HAUTEUR: Record<string, number> = {
  PREPARED: 0,
  PLANTED: 0.14,
  GROWING: 0.3,
  READY: 0.46,
  HARVESTED: 0,
  SPOILED: 0.2,
};

/** L'avancement de l'épi selon le stade — il ne sort qu'à maturité. */
const EPI: Record<string, number> = {
  PLANTED: 0,
  GROWING: 0.25,
  READY: 1,
  SPOILED: 0.8,
};

/**
 * Les cases semées d'une parcelle, réparties sur la part annoncée.
 *
 * Réparties et non groupées : `partCultivee` cases prises dans l'ordre
 * feraient un rectangle en haut du champ et une bande nue en bas. Un pas
 * irrationnel balaie la grille sans jamais retomber sur ses pas, et l'on
 * obtient un semis clairsemé mais réparti — ce qu'on voit d'un champ qui n'est
 * pas emblavé en entier.
 */
export function casesSemees(cases: number, part: number, graine: number): number[] {
  const total = cases * cases;
  const combien = Math.round(Math.min(1, Math.max(0, part)) * total);
  if (combien >= total) return Array.from({ length: total }, (_, i) => i);
  if (combien <= 0) return [];
  const rnd = suite(graine);
  const prises: number[] = [];
  const vues = new Set<number>();
  // Nombre d'or : le pas le plus « irrationnel » qui soit, donc celui qui
  // répartit le mieux une suite finie sur un intervalle.
  const pas = Math.max(1, Math.round(total * 0.6180339887));
  let i = Math.floor(rnd() * total);
  // Le pas et le total peuvent partager un diviseur : la suite boucle alors
  // sur un sous-ensemble et ne remplirait jamais le compte. On avance d'un
  // cran de plus dès qu'une case revient, ce qui casse le cycle.
  while (prises.length < combien) {
    const k = ((i % total) + total) % total;
    if (vues.has(k)) i += 1;
    else {
      vues.add(k);
      prises.push(k);
      i += pas;
    }
  }
  return prises.sort((a, b) => a - b);
}

export function creerVoisinDetaille(o: OptionsVoisin): VoisinDetaille {
  const { parcelle, emprise, cases, y } = o;
  const shadows = o.shadows ?? false;
  const sobre = o.sobre ?? false;
  const reel = parcelle.reel;

  const object = new THREE.Group();
  object.name = `voisin-detail-${parcelle.id}`;
  object.position.set(parcelle.x, y, parcelle.z);

  /* Le pas d'une case, déduit de l'emprise comme sur la nappe fusionnée. */
  const pasCase = (emprise - 1.4) / cases;
  const origine = -((cases - 1) * pasCase) / 2;
  const grain = grainerDe(parcelle.id);
  const rnd = suite(grain);

  /* —— Les cultures ——
     Le vrai champ du jeu : des brins instanciés qui ondulent au vent. Sur une
     machine modeste on éclaircit le semis plutôt que d'appauvrir la forme du
     brin — un champ moins dru reste un champ, un champ en bâtonnets n'en est
     plus un. */
  let champ: CropField | null = null;
  const stade = reel?.stade ?? "";
  const hauteur = HAUTEUR[stade] ?? 0;
  if (reel?.culture && hauteur > 0) {
    const indices = casesSemees(cases, reel.partCultivee, grain);
    if (indices.length) {
      champ = createCropField(indices.length, sobre ? 0.45 : 0.7);
      const teinte = couleurChamp(parcelle.culture, parcelle.etat ?? "POUSSE");
      const grand = reel.culture === "MAIZE";
      champ.setCells(
        indices.map((k) => {
          const cx = k % cases;
          const cz = Math.floor(k / cases);
          return {
            x: cx,
            y: cz,
            px: origine + cx * pasCase,
            pz: origine + cz * pasCase,
            height: hauteur * (grand ? 1.3 : 1),
            shape: reel.culture as CropShape,
            color: teinte,
            density: 0.55,
            ripe: EPI[stade] ?? 0,
            droop: stade === "SPOILED" ? 1 : 0,
          };
        }),
        pasCase,
      );
      object.add(champ.object);
    }
  }

  /* —— Les bâtiments ——
     Les vrais modèles, aux vraies places. Sauf si la campagne les a déjà
     posés pour tout le voisinage : alors on ne les remet pas ici. */
  const rigs: BuildingRig[] =
    o.batiments === false
      ? []
      : poserBatimentsVoisin({
          batiments: reel?.batiments ?? [],
          pasCase,
          origine,
          grain,
          shadows,
        });
  for (const rig of rigs) object.add(rig.group);

  /* —— Les bêtes ——
     Au pré, et non dans le bâtiment : c'est dehors qu'un troupeau se voit. On
     en montre une poignée quelle que soit la taille du cheptel — trente vaches
     modélisées coûteraient plus que tout le reste de la campagne réunie. */
  type Bete = { mesh: THREE.Group; x: number; z: number; phase: number; lent: number };
  const betes: Bete[] = [];
  {
    const espece = reel?.cheptel[0]?.kind ?? "COW";
    const combien = Math.min(
      sobre ? 2 : BETES_MAX,
      (reel?.cheptel ?? []).reduce((n, t) => n + t.size, 0),
    );
    // Autour du centre du champ : assez groupées pour faire un troupeau, assez
    // dispersées pour ne pas faire un rang.
    const rayon = emprise * 0.3;
    for (let i = 0; i < combien; i++) {
      const mesh = meshForHerd(espece, false, { welfare: 0.75, yield: 0.4 });
      mesh.scale.setScalar(pasCase);
      const a = (i / Math.max(1, combien)) * Math.PI * 2 + rnd() * 0.9;
      const r = rayon * (0.35 + rnd() * 0.65);
      const bx = Math.cos(a) * r;
      const bz = Math.sin(a) * r;
      mesh.position.set(bx, 0.02, bz);
      mesh.rotation.y = rnd() * Math.PI * 2;
      mesh.name = "voisin-bete";
      object.add(mesh);
      betes.push({ mesh, x: bx, z: bz, phase: rnd() * 40, lent: 0.6 + rnd() * 0.8 });
    }
  }

  function update(t: number, vent: number): void {
    champ?.update(t, vent);
    for (const b of betes) {
      /*
       * Brouter, lever la tête, faire trois pas.
       *
       * Une bête qui broute sans jamais relever la tête est un décor ; une
       * bête qui marche sans arrêt est un manège. L'alternance se joue sur une
       * onde lente et propre à chaque bête, sinon le troupeau est un ballet.
       */
      const u = (t + b.phase) * 0.11 * b.lent;
      const cycle = u - Math.floor(u);
      const marche = cycle > 0.72;
      // La transition doit être douce des deux côtés : une tête qui claque au
      // sol se voit plus qu'elle ne raconte.
      const brout = marche ? 0 : Math.min(1, Math.sin(cycle * Math.PI * 1.4) * 1.6);
      if (marche) {
        const avance = (cycle - 0.72) / 0.28;
        const cap = b.phase * 0.7;
        b.mesh.position.x = b.x + Math.cos(cap) * avance * 0.9;
        b.mesh.position.z = b.z + Math.sin(cap) * avance * 0.9;
        b.mesh.rotation.y = -cap + Math.PI / 2;
      }
      applyHerdPose(b.mesh, "COW", Math.max(0, brout), marche, t, b.phase, t * 0.6, false);
    }
  }

  function dispose(): void {
    champ?.dispose();
    for (const r of rigs) r.dispose();
    for (const b of betes) {
      const rig = b.mesh.userData.rig as { dispose?(): void } | undefined;
      rig?.dispose?.();
    }
    betes.length = 0;
    object.clear();
  }

  return { object, update, dispose };
}
