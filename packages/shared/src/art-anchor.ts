/**
 * Ancrage au sol des illustrations isométriques.
 *
 * Les webp de bâtiments et d'engins sont carrés, objet posé sur une dalle
 * de terre dessinée. Si on plante le bas du cadre sur le terrain, toute
 * cette dalle — et le vide sous elle — flotte. On plante l'équateur de la
 * dalle (ses coins gauche/droit) : les flancs de terre s'enfoncent, le
 * bâtiment repose.
 *
 * Un dessin sans cette dalle (arbre, cadre rempli jusqu'en bas) garde le
 * dernier rang opaque.
 */

/** Seuil alpha aligné sur `alphaTest: 0.35` des panneaux Three. */
export const ART_ALPHA_CUTOFF = 89;

/**
 * Largeur du trait opaque de chaque rang, du haut vers le bas.
 * `data` est un tampon RGBA (4 octets par pixel).
 */
export function opaqueRowSpans(
  data: ArrayLike<number>,
  width: number,
  height: number,
  alphaMin = ART_ALPHA_CUTOFF,
): number[] {
  const spans = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y++) {
    let minX = -1;
    let maxX = -1;
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > alphaMin) {
        if (minX < 0) minX = x;
        maxX = x;
      }
    }
    if (minX >= 0) spans[y] = maxX - minX + 1;
  }
  return spans;
}

/**
 * Fraction verticale (0 = haut de l'image, 1 = bas) du rang qui doit
 * reposer sur le sol 3D.
 */
export function artGroundFraction(spans: readonly number[], width: number): number {
  const h = spans.length;
  if (h === 0 || width <= 0) return 1;

  let last = -1;
  for (let y = 0; y < h; y++) {
    if (spans[y] > 0) last = y;
  }
  if (last < 0) return 1;

  // L'équateur de la dalle vit dans le bas-milieu du cadre, pas dans le
  // houppier d'un arbre ni dans le vide sous les pieds.
  const lo = Math.floor(h * 0.38);
  const hi = Math.min(last, Math.floor(h * 0.82));
  let maxSpan = 0;
  let maxY = lo;
  for (let y = lo; y <= hi; y++) {
    if (spans[y] > maxSpan) {
      maxSpan = spans[y];
      maxY = y;
    }
  }

  const taperH = last - maxY;
  const taperFrac = taperH / h;
  const bottomSpan = spans[last] ?? 0;
  const wideEnough = maxSpan >= width * 0.82;
  const pointedBottom = bottomSpan <= width * 0.28;
  const shortTaper = taperFrac >= 0.14 && taperFrac <= 0.4;

  if (wideEnough && pointedBottom && shortTaper) {
    return clamp01((maxY + 1) / h);
  }
  return clamp01((last + 1) / h);
}

/** Déplacement local +Y pour que le rang `groundFraction` tombe sur l'origine. */
export function billboardLift(spanY: number, groundFraction: number): number {
  return spanY * (clamp01(groundFraction) - 0.5);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0.2, n));
}
