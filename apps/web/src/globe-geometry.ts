/** Recul exact pour conserver la même marge dans le plus petit champ de vue. */
export function globeFitScale(aspect: number, verticalFov: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  const halfVertical = verticalFov / 2;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  return Math.sin(halfVertical) / Math.sin(Math.min(halfVertical, halfHorizontal));
}

/** Relief continu au rivage, borné à 1,4 % du rayon pour garder un limbe lisse. */
export function globeSurfaceRadius(radius: number, coastHeight: number, elevation: number): number {
  const t = Math.max(0, Math.min(1, coastHeight / 0.16));
  const coast = t * t * (3 - 2 * t);
  return radius + Math.min(radius * 0.014, Math.max(0, elevation) * 0.08) * coast;
}
