import fs from "node:fs";

/**
 * La pluie doit se raccorder à elle-même.
 *
 * Signalé en jouant, deux fois : « j'ai encore les traits dans le fond
 * d'écran ». Deux défauts se cumulaient dans la même règle.
 *
 * 1. Un `repeating-linear-gradient` de 1 px trace des filets **continus** —
 *    des fils tendus d'un bord à l'autre de l'écran. L'œil y voit une rayure
 *    d'écran, pas une averse. Il faut une goutte par tuile, et rien qui
 *    déborde d'une tuile à l'autre.
 *
 * 2. Le défilement avançait de 12 % de la hauteur de l'écran — une distance
 *    qui ne tombe jamais juste sur le motif. À chaque boucle, la pluie
 *    sautait. Ce test tient l'invariant qui l'empêche : le pas d'animation
 *    vaut **exactement** une tuile, pour chaque nappe.
 *
 * C'est une propriété arithmétique, vérifiable sans navigateur : c'est
 * précisément ce qu'une relecture ne voit pas.
 */
const CSS = fs.readFileSync("src/styles.css", "utf8");

/**
 * Le corps d'une règle, par sélecteur exact.
 *
 * Compte les accolades au lieu de s'arrêter à la première : un bloc
 * `@keyframes` en contient d'autres, et couper trop tôt ne montrerait que son
 * image `from`.
 */
function regle(selecteur: string): string {
  const i = CSS.indexOf(selecteur + " {");
  expect(`${selecteur} présent`).toBe(i >= 0 ? `${selecteur} présent` : `${selecteur} absent`);
  let profondeur = 0;
  for (let j = CSS.indexOf("{", i); j < CSS.length; j++) {
    if (CSS[j] === "{") profondeur++;
    else if (CSS[j] === "}" && --profondeur === 0) return CSS.slice(i, j);
  }
  return CSS.slice(i);
}

/** Les hauteurs de tuile d'un `background-size: 13px 24px, 23px 40px`. */
function hauteursDeTuile(corps: string): number[] {
  const m = /background-size:([^;]+);/.exec(corps);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((paire) => Number(/(-?\d+(?:\.\d+)?)px\s*$/.exec(paire.trim())?.[1] ?? NaN));
}

/** Les déplacements verticaux de l'image `to` d'une animation. */
function pasVertical(keyframes: string): number[] {
  const m = /to\s*{\s*background-position:([^;]+);/.exec(keyframes);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((paire) => Number(/(-?\d+(?:\.\d+)?)px\s*$/.exec(paire.trim())?.[1] ?? NaN));
}

describe("les précipitations", () => {
  it("ne tire plus de filets continus d’un bord à l’autre", () => {
    const pluie = regle(".sky-precip.rain");
    // `repeating-linear-gradient` est exactement ce qui produisait les traits :
    // il répète le motif à l'infini, sans jamais le couper.
    expect(pluie.includes("repeating-linear-gradient")).toBe(false);
    // Une tuile bornée, donc une goutte qui commence et qui finit.
    expect(hauteursDeTuile(pluie).length).toBeGreaterThan(0);
  });

  it("avance d’exactement une tuile par boucle — pluie", () => {
    const tuiles = hauteursDeTuile(regle(".sky-precip.rain"));
    const pas = pasVertical(regle("@keyframes rain-fall"));
    expect(pas).toEqual(tuiles);
  });

  it("avance d’exactement une tuile par boucle — neige", () => {
    const tuiles = hauteursDeTuile(regle(".sky-precip.snow"));
    const pas = pasVertical(regle("@keyframes snow-fall"));
    expect(pas).toEqual(tuiles);
  });

  it("fait tomber les nappes à des vitesses différentes", () => {
    // Même durée, distances différentes : c'est ce qui donne la profondeur
    // sans ajouter le moindre élément à la page.
    const tuiles = hauteursDeTuile(regle(".sky-precip.rain"));
    expect(new Set(tuiles).size).toBe(tuiles.length);
  });

  it("ne déborde plus au-dessus du ciel", () => {
    // L'ancienne règle débordait de 10 % vers le haut pour cacher le saut de
    // l'animation. Sans saut, plus besoin de déborder.
    expect(regle(".sky-precip").includes("inset: 0")).toBe(true);
  });
});
