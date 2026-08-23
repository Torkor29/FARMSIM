/**
 * Le cadrage de la vue : jusqu'où le joueur peut se déplacer, et comment on
 * l'arrête.
 *
 * ## Le défaut
 *
 * Le déplacement était borné à `viewSpan × 0,9`, soit une vingtaine d'unités
 * — un multiple de la taille de **l'île**, à l'époque où il n'y avait rien
 * autour d'elle. Depuis qu'il y a un pays, la borne n'a plus de rapport avec
 * ce qu'on peut voir : mesuré en jeu, la première couronne de parcelles est
 * atteignable, la deuxième non, et en descendant on cogne le mur avant
 * d'avoir vu le champ d'en bas. C'était le reproche — « la vision bloque
 * quand on descend ».
 *
 * Le monde rendu décide donc de la borne, et pas l'inverse.
 *
 * ## Pourquoi une butée élastique
 *
 * Un arrêt franc au bord ne dit rien : le doigt continue, l'image ne bouge
 * plus, et on ne sait pas si c'est la limite du monde ou une panne. Une butée
 * qui cède un peu puis rappelle dit les deux choses à la fois — il y a une
 * limite, et elle est là. C'est le geste des listes du téléphone, et personne
 * n'a besoin qu'on le lui explique.
 *
 * Tout ce module est de l'arithmétique pure : rien de Trois, rien du DOM, pour
 * que le comportement se vérifie sans monter une scène.
 */

export type Bornes = { xMin: number; xMax: number; zMin: number; zMax: number };

/** Emprise rectangulaire au sol, comme partout ailleurs dans le jeu. */
export type Boite = { x: number; z: number; w: number; d: number };

/**
 * Combien on peut dépasser la borne, en unités monde.
 *
 * Assez pour que le geste réponde, pas assez pour perdre la ferme : au-delà
 * d'une demi-parcelle, le dépassement ne se lit plus comme une résistance mais
 * comme un déplacement qu'on aurait autorisé puis annulé.
 */
export const COURSE = 6;

/**
 * Les bornes de déplacement, déduites de ce qui est effectivement rendu.
 *
 * On prend l'enveloppe de toutes les emprises données — l'île, la cour, les
 * parcelles voisines — et on l'élargit d'une marge. La marge n'est pas
 * décorative : sans elle on ne pourrait jamais centrer la parcelle la plus
 * éloignée, seulement l'amener au bord du cadre.
 */
export function bornesDeplacement(boites: readonly Boite[], marge: number): Bornes {
  if (!boites.length) return { xMin: 0, xMax: 0, zMin: 0, zMax: 0 };
  let xMin = Infinity;
  let xMax = -Infinity;
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const b of boites) {
    xMin = Math.min(xMin, b.x - b.w / 2);
    xMax = Math.max(xMax, b.x + b.w / 2);
    zMin = Math.min(zMin, b.z - b.d / 2);
    zMax = Math.max(zMax, b.z + b.d / 2);
  }
  return {
    xMin: xMin - marge,
    xMax: xMax + marge,
    zMin: zMin - marge,
    zMax: zMax + marge,
  };
}

/**
 * La position affichée pour une position demandée : le caoutchouc.
 *
 * Dans les bornes, c'est l'identité. Au-delà, le dépassement est comprimé et
 * tend vers `course` sans jamais l'atteindre — on peut donc tirer aussi fort
 * qu'on veut, l'image ne s'échappera pas.
 *
 * La compression s'applique à la **demande brute**, jamais au résultat de la
 * fois précédente. Comprimer une valeur déjà comprimée à chaque image donnerait
 * une résistance qui dépend de la cadence de l'écran, ce qui n'a aucun sens.
 */
export function elastique(v: number, min: number, max: number, course = COURSE): number {
  if (course <= 0) return Math.max(min, Math.min(max, v));
  if (v > max) {
    const d = v - max;
    return max + (course * d) / (course + d);
  }
  if (v < min) {
    const d = min - v;
    return min - (course * d) / (course + d);
  }
  return v;
}

/** La valeur la plus proche à l'intérieur des bornes. */
export function ramener(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Un pas de retour vers la borne, une fois le doigt levé.
 *
 * Exponentiel, et calculé sur le temps écoulé et non sur le nombre d'images :
 * un retour en « dix pour cent par image » va deux fois plus vite à cent vingt
 * hertz qu'à soixante, et le jeu tourne sur les deux.
 *
 * On accroche la cible quand il reste moins d'un centième d'unité, sinon la
 * valeur s'en approche indéfiniment et la vue se croit animée pour toujours.
 */
export function pasRetour(v: number, cible: number, deltaMs: number, tau = 110): number {
  const suivant = v + (cible - v) * (1 - Math.exp(-Math.max(0, deltaMs) / tau));
  return Math.abs(cible - suivant) < 0.01 ? cible : suivant;
}

/**
 * La demande brute, bridée avant même la compression.
 *
 * Sans cela, un glissement long accumule des centaines d'unités que la
 * compression masque — et au relâchement, le retour part de si loin qu'il
 * traverse toute la campagne. On ne garde donc jamais plus de deux courses de
 * dépassement en mémoire.
 */
export function retenir(v: number, min: number, max: number, course = COURSE): number {
  return Math.max(min - 2 * course, Math.min(max + 2 * course, v));
}

/** La vue est-elle hors de ses bornes, et vers où faut-il la ramener ? */
export function horsBornes(
  x: number,
  z: number,
  b: Bornes,
): { dehors: boolean; cibleX: number; cibleZ: number } {
  const cibleX = ramener(x, b.xMin, b.xMax);
  const cibleZ = ramener(z, b.zMin, b.zMax);
  return { dehors: cibleX !== x || cibleZ !== z, cibleX, cibleZ };
}
