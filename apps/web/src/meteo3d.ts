import * as THREE from "three";
import type { Meteo } from "./ambiance";

/**
 * La météo en trois dimensions : pluie, éclaboussures, neige, éclairs.
 *
 * La pluie et la neige vivaient dans le fond CSS, **derrière** la ferme : il
 * pleuvait sur le ciel, pas sur les champs. Ici elles tombent dans la scène,
 * devant et derrière les bâtiments (le tampon de profondeur les cache
 * derrière un toit), et la pluie éclabousse le sol.
 *
 * Rien n'est calculé par le processeur à chaque image : chaque goutte porte
 * sa graine, et c'est le shader de sommets qui la fait tomber à partir du
 * temps. Une averse de deux mille gouttes coûte un appel de rendu et un
 * uniforme par image. Le volume suit le point visé de la caméra.
 */

const HAUTEUR = 24;

interface Couche {
  objet: THREE.Object3D;
  mat: THREE.ShaderMaterial;
  nb: number;
  geo: THREE.BufferGeometry;
}

const COMMUNS = /* glsl */ `
  uniform float uTemps;
  uniform float uIntensite;
  uniform float uEtendue;
  uniform vec3 uCentre;
  uniform vec2 uVent;
`;

/** La pluie : des traits obliques, qui s'effacent en haut et au ras du sol. */
function pluie(nb: number): Couche {
  const geo = new THREE.BufferGeometry();
  const graines = new Float32Array(nb * 2 * 3);
  const bouts = new Float32Array(nb * 2);
  for (let i = 0; i < nb; i++) {
    const g = [Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 2; k++) {
      graines.set(g, (i * 2 + k) * 3);
      bouts[i * 2 + k] = k;
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nb * 2 * 3), 3));
  geo.setAttribute("aGraine", new THREE.BufferAttribute(graines, 3));
  geo.setAttribute("aBout", new THREE.BufferAttribute(bouts, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTemps: { value: 0 },
      uIntensite: { value: 0 },
      uEtendue: { value: 50 },
      uCentre: { value: new THREE.Vector3() },
      uVent: { value: new THREE.Vector2(0.25, 0.1) },
      uCouleur: { value: new THREE.Color(0xdde8f4) },
    },
    vertexShader: /* glsl */ `
      ${COMMUNS}
      attribute vec3 aGraine;
      attribute float aBout;
      varying float vAlpha;
      void main() {
        float vitesse = 17.0 + aGraine.z * 6.0;
        float y = mod(aGraine.z * ${HAUTEUR.toFixed(1)} - uTemps * vitesse, ${HAUTEUR.toFixed(1)});
        vec3 dir = normalize(vec3(uVent.x, -1.0, uVent.y));
        vec3 p = vec3(
          uCentre.x + (aGraine.x - 0.5) * uEtendue,
          y,
          uCentre.z + (aGraine.y - 0.5) * uEtendue
        );
        // Penchée par le vent : plus haut, plus en amont.
        p.xz -= uVent * y;
        p += dir * (0.8 + aGraine.x * 0.5) * aBout;
        // Seules les gouttes « tirées » sous l'intensité du moment tombent.
        float visible = step(aGraine.y * 0.999, uIntensite);
        vAlpha = visible * smoothstep(0.0, 0.6, y) * (1.0 - smoothstep(${(HAUTEUR - 4).toFixed(1)}, ${HAUTEUR.toFixed(1)}, y))
               * mix(0.35, 0.9, aBout);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCouleur;
      varying float vAlpha;
      void main() {
        if (vAlpha < 0.01) discard;
        gl_FragColor = vec4(uCouleur, vAlpha * 0.8);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const objet = new THREE.LineSegments(geo, mat);
  objet.frustumCulled = false;
  objet.renderOrder = 10;
  return { objet, mat, nb, geo };
}

/** Les éclaboussures : de petits anneaux qui s'ouvrent au sol, puis s'effacent. */
function eclaboussures(nb: number, pixelRatio: number): Couche {
  const geo = new THREE.BufferGeometry();
  const graines = new Float32Array(nb * 3);
  for (let i = 0; i < nb * 3; i++) graines[i] = Math.random();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nb * 3), 3));
  geo.setAttribute("aGraine", new THREE.BufferAttribute(graines, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTemps: { value: 0 },
      uIntensite: { value: 0 },
      uEtendue: { value: 50 },
      uCentre: { value: new THREE.Vector3() },
      uVent: { value: new THREE.Vector2() },
      uTaille: { value: 9 * pixelRatio },
    },
    vertexShader: /* glsl */ `
      ${COMMUNS}
      uniform float uTaille;
      attribute vec3 aGraine;
      varying float vVie;
      varying float vVisible;
      void main() {
        float cycle = 0.55 + aGraine.z * 0.4;
        float t = uTemps / cycle + aGraine.z * 17.0;
        float tour = floor(t);
        vVie = fract(t);
        // Chaque cycle, l'anneau renaît ailleurs.
        vec2 ou = fract(aGraine.xy + vec2(0.618, 0.382) * tour);
        vec3 p = vec3(uCentre.x + (ou.x - 0.5) * uEtendue, 0.04, uCentre.z + (ou.y - 0.5) * uEtendue);
        vVisible = step(aGraine.y * 0.999, uIntensite);
        gl_PointSize = uTaille * (0.35 + vVie);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vVie;
      varying float vVisible;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        // Écrasé en ellipse : l'anneau est couché sur le sol.
        d.y *= 1.9;
        float r = length(d) * 2.0;
        float anneau = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.85, 1.0, r));
        float a = anneau * (1.0 - vVie) * vVisible * 0.55;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.9, 0.95, 1.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const objet = new THREE.Points(geo, mat);
  objet.frustumCulled = false;
  objet.renderOrder = 9;
  return { objet, mat, nb, geo };
}

/** La neige : des flocons doux qui descendent en se balançant. */
function neige(nb: number, pixelRatio: number): Couche {
  const geo = new THREE.BufferGeometry();
  const graines = new Float32Array(nb * 3);
  for (let i = 0; i < nb * 3; i++) graines[i] = Math.random();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nb * 3), 3));
  geo.setAttribute("aGraine", new THREE.BufferAttribute(graines, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTemps: { value: 0 },
      uIntensite: { value: 0 },
      uEtendue: { value: 50 },
      uCentre: { value: new THREE.Vector3() },
      uVent: { value: new THREE.Vector2(0.25, 0.1) },
      uTaille: { value: 5 * pixelRatio },
    },
    vertexShader: /* glsl */ `
      ${COMMUNS}
      uniform float uTaille;
      attribute vec3 aGraine;
      varying float vAlpha;
      void main() {
        float vitesse = 1.3 + aGraine.z * 1.1;
        float y = mod(aGraine.z * ${HAUTEUR.toFixed(1)} - uTemps * vitesse, ${HAUTEUR.toFixed(1)});
        vec3 p = vec3(uCentre.x + (aGraine.x - 0.5) * uEtendue, y, uCentre.z + (aGraine.y - 0.5) * uEtendue);
        float phase = aGraine.x * 6.2831;
        p.x += sin(uTemps * 0.9 + phase) * 0.55 + uVent.x * y * 0.4;
        p.z += cos(uTemps * 0.7 + phase * 1.3) * 0.45 + uVent.y * y * 0.4;
        float visible = step(aGraine.y * 0.999, uIntensite);
        vAlpha = visible * smoothstep(0.0, 0.4, y) * (1.0 - smoothstep(${(HAUTEUR - 4).toFixed(1)}, ${HAUTEUR.toFixed(1)}, y));
        gl_PointSize = uTaille * (0.6 + aGraine.z * 0.8);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.35, 1.0, r)) * vAlpha * 0.9;
        if (a < 0.01) discard;
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const objet = new THREE.Points(geo, mat);
  objet.frustumCulled = false;
  objet.renderOrder = 10;
  return { objet, mat, nb, geo };
}

/** Intensité cible de chaque couche selon le temps qu'il fait. */
function cibles(meteo: Meteo): { pluie: number; neige: number } {
  switch (meteo) {
    case "RAIN":
      return { pluie: 0.7, neige: 0 };
    case "STORM":
      return { pluie: 1, neige: 0 };
    case "SNOW":
      return { pluie: 0, neige: 0.8 };
    default:
      return { pluie: 0, neige: 0 };
  }
}

export interface Meteo3d {
  objet: THREE.Group;
  /**
   * Avance la météo. `centre` : le point visé par la caméra ; `etendue` : la
   * largeur de monde à couvrir. Rend la force de l'éclair en cours (0..1),
   * que l'appelant ajoute à ses lumières.
   */
  mettreAJour(dt: number, t: number, meteo: Meteo, centre: THREE.Vector3, etendue: number): number;
  dispose(): void;
}

export function creerMeteo3d(opts: { pixelRatio: number; sobre?: boolean }): Meteo3d {
  const facteur = opts.sobre ? 0.5 : 1;
  const couches = {
    pluie: pluie(Math.round(2200 * facteur)),
    eclats: eclaboussures(Math.round(260 * facteur), opts.pixelRatio),
    neige: neige(Math.round(1600 * facteur), opts.pixelRatio),
  };
  const objet = new THREE.Group();
  objet.name = "meteo3d";
  objet.add(couches.pluie.objet, couches.eclats.objet, couches.neige.objet);

  const courant = { pluie: 0, neige: 0 };
  // L'orage : des éclairs à intervalles irréguliers, en double battement.
  let prochainEclair = 3 + Math.random() * 6;
  let debutEclair = -10;

  return {
    objet,
    mettreAJour(dt, t, meteo, centre, etendue) {
      const cible = cibles(meteo);
      // Une averse arrive et repart en quelques secondes, jamais d'un coup.
      const pas = Math.min(1, dt * 0.35);
      courant.pluie += (cible.pluie - courant.pluie) * pas;
      courant.neige += (cible.neige - courant.neige) * pas;
      for (const c of Object.values(couches)) {
        const u = c.mat.uniforms;
        u.uTemps.value = t;
        u.uCentre.value.copy(centre);
        u.uEtendue.value = etendue;
      }
      couches.pluie.mat.uniforms.uIntensite.value = courant.pluie;
      couches.eclats.mat.uniforms.uIntensite.value = courant.pluie;
      couches.neige.mat.uniforms.uIntensite.value = courant.neige;
      const vent = meteo === "STORM" ? 0.5 : 0.22;
      couches.pluie.mat.uniforms.uVent.value.set(vent, vent * 0.4);
      couches.pluie.objet.visible = courant.pluie > 0.01;
      couches.eclats.objet.visible = courant.pluie > 0.01;
      couches.neige.objet.visible = courant.neige > 0.01;

      if (meteo !== "STORM") return 0;
      if (t >= prochainEclair) {
        debutEclair = t;
        prochainEclair = t + 4 + Math.random() * 9;
      }
      const e = t - debutEclair;
      if (e < 0 || e > 0.45) return 0;
      // Deux battements : le premier franc, le second plus faible.
      return Math.max(Math.exp(-e * 30), 0.6 * Math.exp(-Math.abs(e - 0.18) * 40));
    },
    dispose() {
      for (const c of Object.values(couches)) {
        c.geo.dispose();
        c.mat.dispose();
      }
    },
  };
}
