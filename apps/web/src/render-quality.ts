/**
 * Qualité de rendu adaptative.
 *
 * Le profilage du chargement de la ferme a montré que la peinture représentait
 * 94,5 % du temps passé, contre 4,8 % pour le JavaScript : ce ne sont pas nos
 * calculs qui coûtent, c'est la rasterisation. Sur une machine sans carte
 * graphique — un poste virtualisé, mais aussi bien un téléphone d'entrée de
 * gamme, qui reste la cible du jeu — chaque image demandait de deux à cinq
 * cents millisecondes, d'où les violations de handler au chargement.
 *
 * Deux garde-fous ici. Le premier reconnaît les rasteriseurs logiciels connus
 * et part d'emblée sur un réglage sobre. Le second observe le temps réellement
 * passé par image et déclasse en cours de route : c'est le seul qui attrape un
 * appareil lent que sa chaîne de caractères ne trahit pas.
 */

export type RenderQuality = {
  /** Ombres portées : une passe de rendu complète en plus, par image. */
  shadows: boolean;
  /** Densité de pixels. Le coût de peinture varie avec son carré. */
  pixelRatio: number;
  antialias: boolean;
  /** Images par seconde maximum ; zéro pour ne pas brider. */
  maxFps: number;
};

const FULL: RenderQuality = {
  shadows: true,
  pixelRatio: Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio, 2),
  antialias: true,
  maxFps: 0,
};

const REDUCED: RenderQuality = {
  shadows: false,
  pixelRatio: 1,
  antialias: false,
  maxFps: 30,
};

/** Rasteriseurs logiciels courants : SwiftShader, Mesa, le repli de Direct3D. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;

let probed: boolean | null = null;

/**
 * Indique si WebGL passe par le processeur. Sonde une seule fois : la réponse
 * ne change pas au cours d'une session, et créer un contexte coûte cher.
 */
export function isSoftwareRenderer(): boolean {
  if (probed !== null) return probed;
  probed = false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const name = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : String(gl.getParameter(gl.RENDERER));
      probed = SOFTWARE.test(name);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // Une sonde qui échoue ne doit jamais empêcher le jeu de démarrer.
  }
  return probed;
}

let forcedReduced = false;

/** Réglage de départ, sobre d'emblée si la machine est déjà connue comme lente. */
export function initialQuality(): RenderQuality {
  return forcedReduced || isSoftwareRenderer() ? { ...REDUCED } : { ...FULL };
}

/**
 * Surveille le temps par image et prévient une fois, définitivement, quand il
 * faut alléger. On exige une lenteur installée — une moyenne glissante au-delà
 * du seuil sur une centaine d'images — pour ne pas déclasser sur le à-coup de
 * la première image, qui compile les shaders et téléverse les textures.
 */
export function makeFrameGovernor(onDowngrade: (q: RenderQuality) => void) {
  const SLOW_FRAME_MS = 40;
  const SAMPLE = 100;
  let average = 16;
  let seen = 0;
  let done = forcedReduced || isSoftwareRenderer();

  return function sample(deltaMs: number): void {
    if (done) return;
    // Une image très longue est presque toujours un événement isolé — un
    // changement d'onglet, un ramasse-miettes — et non le régime de croisière.
    if (deltaMs > 500) return;
    average += (deltaMs - average) / 12;
    if (++seen < SAMPLE) return;
    if (average > SLOW_FRAME_MS) {
      done = true;
      forcedReduced = true;
      onDowngrade({ ...REDUCED });
    } else {
      seen = 0;
    }
  };
}
