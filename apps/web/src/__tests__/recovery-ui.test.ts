/**
 * Le code de secours ne s'affiche qu'une fois : ce qui le cache le perd.
 *
 * Ces règles-là ne se voient pas en lisant le composant — elles se jouent
 * entre deux feuilles de style écrites à des mois d'intervalle. D'où ce
 * fichier, sur le modèle de `layout-css.test.ts` : on mesure le CSS livré.
 */

import fs from "node:fs";

const AUTH = fs.readFileSync("src/auth.css", "utf8");
const JEU = fs.readFileSync("src/styles.css", "utf8");

/** Plus haut `z-index` déclaré dans une feuille. */
function plafond(css: string): number {
  const valeurs = [...css.matchAll(/z-index:\s*(-?\d+)/g)].map((m) => Number(m[1]));
  return Math.max(...valeurs);
}

/** Le bloc de règles d'un sélecteur, tel qu'écrit. */
function bloc(css: string, selecteur: string): string {
  const i = css.indexOf(`${selecteur} {`);
  if (i < 0) throw new Error(`sélecteur absent : ${selecteur}`);
  return css.slice(i, css.indexOf("}", i));
}

describe("le voile du code de secours", () => {
  it("passe devant tout le reste du jeu", () => {
    // Le code est remis après la connexion : il s'affiche donc par-dessus la
    // ferme, ses panneaux, son bandeau d'absence et ses notifications. Un
    // seul de ces calques au-dessus, et le joueur ferme la fenêtre sans avoir
    // pu lire son code — qui n'existe alors plus nulle part.
    const veil = bloc(AUTH, ".recovery-veil");
    const z = Number(/z-index:\s*(\d+)/.exec(veil)?.[1]);
    expect(z).toBeGreaterThan(plafond(JEU));
  });

  it("couvre l'écran entier, pas seulement la carte", () => {
    const veil = bloc(AUTH, ".recovery-veil");
    expect(veil).toMatch(/position:\s*fixed/);
    expect(veil).toMatch(/inset:\s*0/);
  });

  it("laisse le code se sélectionner et se couper sur un téléphone", () => {
    // Seize symboles en gras débordaient d'un écran de 360 px : sans césure,
    // la fin du code sortait de la carte.
    const code = bloc(AUTH, ".recovery-code");
    expect(code).toMatch(/user-select:\s*all/);
    expect(code).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
