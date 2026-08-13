import * as THREE from "three";
import { markShared } from "./three-cleanup";

/**
 * Projections balistiques — grain, terre, engrais.
 *
 * La poussière et la fumée montent et se diluent ; ces particules-ci sont
 * *lancées* : elles partent avec une vitesse, retombent sous la gravité, et
 * disparaissent en touchant le sol. C'est ce qui distingue une gerbe de grain
 * d'un nuage.
 *
 * Un seul maillage instancié par gerbe : cent grains ne coûtent qu'un appel de
 * rendu. Les particules mortes sont mises à l'échelle zéro plutôt que retirées
 * — on ne recompose pas le tampon soixante fois par seconde pour si peu.
 */

export type Spray = {
  object: THREE.Object3D;
  /** Lance une particule depuis un point, avec une vitesse initiale. */
  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
  ): void;
  update(dt: number): void;
  dispose(): void;
};

export type SprayOptions = {
  /** Nombre de particules du bassin */
  count?: number;
  color?: number;
  /** Côté d'une particule, unités monde */
  size?: number;
  /** Gravité, unités par seconde carrée */
  gravity?: number;
  /** Durée de vie, secondes */
  life?: number;
  /** Altitude à laquelle la particule est absorbée par le sol */
  floor?: number;
  /** Vitesse de rotation sur elle-même */
  spin?: number;
  opacity?: number;
};

const cache = new Map<number, THREE.BufferGeometry>();

function grainGeometry(size: number): THREE.BufferGeometry {
  const key = Math.round(size * 1000);
  const cached = cache.get(key);
  if (cached) return cached;
  // Un octaèdre : trois fois moins de faces qu'un cube arrondi, et sa
  // silhouette irrégulière passe pour un grain comme pour une motte.
  const geo = markShared(new THREE.OctahedronGeometry(size, 0));
  cache.set(key, geo);
  return geo;
}

export function createSpray(opts: SprayOptions = {}): Spray {
  const count = opts.count ?? 60;
  const gravity = opts.gravity ?? 6.5;
  const life = opts.life ?? 0.9;
  const floor = opts.floor ?? 0.09;
  const spin = opts.spin ?? 6;

  const material = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xe8c65c,
    flatShading: true,
    transparent: true,
    opacity: opts.opacity ?? 1,
  });
  const mesh = new THREE.InstancedMesh(grainGeometry(opts.size ?? 0.035), material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;

  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const age = new Float32Array(count).fill(-1);
  const seed = new Float32Array(count).map(() => Math.random() * 6.28);
  let next = 0;

  const dummy = new THREE.Object3D();
  // Toutes les particules démarrent invisibles : échelle nulle.
  dummy.scale.setScalar(0);
  dummy.updateMatrix();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, dummy.matrix);

  return {
    object: mesh,

    emit(x, y, z, vx, vy, vz) {
      const i = next;
      next = (next + 1) % count;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel[i * 3] = vx;
      vel[i * 3 + 1] = vy;
      vel[i * 3 + 2] = vz;
      age[i] = 0;
    },

    update(dt) {
      let live = false;
      for (let i = 0; i < count; i++) {
        if (age[i] < 0) continue;
        age[i] += dt;
        if (age[i] > life) {
          age[i] = -1;
          dummy.scale.setScalar(0);
          dummy.position.set(0, 0, 0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          live = true;
          continue;
        }
        vel[i * 3 + 1] -= gravity * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

        // Au sol, la particule s'écrase : elle s'aplatit puis s'éteint.
        const grounded = pos[i * 3 + 1] <= floor;
        if (grounded) {
          pos[i * 3 + 1] = floor;
          vel[i * 3] *= 0.6;
          vel[i * 3 + 2] *= 0.6;
          vel[i * 3 + 1] = 0;
        }
        const fade = 1 - age[i] / life;
        dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        dummy.rotation.set(
          seed[i] + age[i] * spin,
          seed[i] * 1.7 + age[i] * spin * 0.6,
          seed[i] * 0.3,
        );
        dummy.scale.setScalar(grounded ? fade * 0.7 : 0.5 + fade * 0.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        live = true;
      }
      if (live) mesh.instanceMatrix.needsUpdate = true;
    },

    dispose() {
      material.dispose();
      mesh.dispose();
    },
  };
}
