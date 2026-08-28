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
 * Deux garde-fous. Le premier reconnaît les rasteriseurs logiciels connus en
 * interrogeant le contexte du rendu **déjà créé** : une première version
 * ouvrait un contexte jetable pour le sonder, et cette allocation
 * supplémentaire suffisait à faire tomber le compositeur de Chrome sous
 * SwiftShader — précisément la machine qu'il s'agissait de reconnaître. Le
 * second observe le temps réellement passé par image et déclasse en cours de
 * route : c'est le seul qui attrape un appareil lent que sa chaîne de
 * caractères ne trahit pas.
 */

export type RenderQuality = {
  /** Ombres portées : une passe de rendu complète en plus, par image. */
  shadows: boolean;
  /**
   * Projections de terre, de grain, d'engrais derrière l'engin.
   *
   * Elles suivaient les ombres, sur le même interrupteur. Le rapport de coût
   * ne le justifie pas : une passe d'ombres redessine toute la scène à chaque
   * image, ces gerbes-ci sont quelques dizaines de quadrilatères instanciés
   * lancés une fois toutes les quarante-cinq millisecondes. Les couper avec
   * les ombres revenait à jeter ce qui fait vivre un chantier pour économiser
   * ce qui ne coûtait rien — et c'est ce qu'a vu le joueur : « il n'y a plus
   * les petits trucs de terre en animation qui étaient sympas ».
   */
  sprays: boolean;
  /** Densité de pixels. Le coût de peinture varie avec son carré. */
  pixelRatio: number;
  antialias: boolean;
  /** Images par seconde maximum ; zéro pour ne pas brider. */
  maxFps: number;
};

/**
 * Ce que le joueur a demandé : « débrouille-toi », « tout », ou « sobre ».
 *
 * Sans ce choix, l'observation automatique avait le dernier mot et personne
 * ne pouvait la contredire : une mauvaise passe — un serveur qui rame, un
 * onglet en arrière-plan — et le jeu restait dégradé jusqu'au rechargement,
 * sans rien dire. Le réglage est retenu d'une partie à l'autre ; il n'a
 * d'intérêt que si l'on n'a pas à le reposer chaque fois.
 */
export type QualityChoice = "auto" | "full" | "reduced";

const CLE_CHOIX = "farmsim.qualite";

export function qualityChoice(): QualityChoice {
  try {
    const v = localStorage.getItem(CLE_CHOIX);
    return v === "full" || v === "reduced" ? v : "auto";
  } catch {
    // Navigation privée, stockage refusé : on retombe sur l'automatique.
    return "auto";
  }
}

export function setQualityChoice(choix: QualityChoice): void {
  try {
    if (choix === "auto") localStorage.removeItem(CLE_CHOIX);
    else localStorage.setItem(CLE_CHOIX, choix);
  } catch {
    // Rien à faire : le choix vaudra pour cette session seulement.
  }
}

function full(): RenderQuality {
  return {
    shadows: true,
    sprays: true,
    pixelRatio: Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio, 2),
    antialias: true,
    maxFps: 0,
  };
}

function reduced(): RenderQuality {
  // `sprays` reste vrai : c'est le point de la séparation ci-dessus. Le mode
  // sobre rend une machine lente jouable en coupant ce qui coûte — la passe
  // d'ombres, l'anticrénelage, la densité de pixels — pas ce qui fait plaisir.
  return { shadows: false, sprays: true, pixelRatio: 1, antialias: false, maxFps: 30 };
}

/** Rasteriseurs logiciels courants : SwiftShader, Mesa, le repli de Direct3D. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;

/**
 * Retenu dès qu'une vue a constaté la lenteur : les suivantes démarrent
 * directement en réglage sobre, sans repayer la période d'observation.
 */
let known = false;

/** Le rendu a-t-il été dégradé tout seul ? Le réglage l'affiche au joueur. */
export function qualityDowngraded(): boolean {
  return known;
}

/** Réglage de départ : le choix du joueur d'abord, l'observation ensuite. */
export function initialQuality(): RenderQuality {
  const choix = qualityChoice();
  if (choix === "full") return full();
  if (choix === "reduced") return reduced();
  return known ? reduced() : full();
}

/**
 * Examine le contexte d'un rendu existant et renvoie un réglage sobre si la
 * rasterisation se fait au processeur, sinon `null`. N'alloue rien et ne
 * touche pas au contexte : seule une lecture de paramètre a lieu.
 */
export function qualityForContext(gl: WebGLRenderingContext | WebGL2RenderingContext): RenderQuality | null {
  const choix = qualityChoice();
  // Un joueur qui a demandé « tout » ne se fait pas contredire par une
  // chaîne de caractères de pilote : c'est sa machine, il l'essaie.
  if (choix === "full") return null;
  if (choix === "reduced") return reduced();
  if (known) return reduced();
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    if (!SOFTWARE.test(name)) return null;
  } catch {
    // Un pilote qui refuse de se nommer n'est pas une raison de dégrader :
    // la surveillance du temps par image prendra le relais.
    return null;
  }
  known = true;
  return reduced();
}

/**
 * Surveille le temps par image et prévient une fois, définitivement, quand il
 * faut alléger. On exige une lenteur installée — une moyenne glissante au-delà
 * du seuil sur une centaine d'images — pour ne pas déclasser sur l'à-coup de
 * la première image, qui compile les shaders et téléverse les textures.
 */
export function makeFrameGovernor(onDowngrade: (q: RenderQuality) => void) {
  const SLOW_FRAME_MS = 40;
  const SAMPLE = 100;
  let average = 16;
  let seen = 0;
  let done = false;

  return function sample(deltaMs: number): void {
    if (done) return;
    // Le joueur a tranché : on ne repasse pas derrière lui.
    if (qualityChoice() !== "auto") {
      done = true;
      return;
    }
    if (known) {
      done = true;
      return;
    }
    // Une image très longue est presque toujours un événement isolé — un
    // changement d'onglet, un ramasse-miettes — et non le régime de croisière.
    if (deltaMs > 500) return;
    average += (deltaMs - average) / 12;
    if (++seen < SAMPLE) return;
    if (average > SLOW_FRAME_MS) {
      done = true;
      known = true;
      onDowngrade(reduced());
    } else {
      seen = 0;
    }
  };
}
