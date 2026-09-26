import fs from "node:fs";
import path from "node:path";
import { catalogueConstruction } from "@farmsim/shared";

/**
 * Le jeu d'icônes : un seul style, et aucune icône cassée.
 *
 * Les icônes sont générées par `scripts/icones-jeu.mjs`. Un attribut en double
 * dans une balise (deux `stroke-width`) rend un SVG invalide : le navigateur
 * n'affiche alors qu'un carré vide — c'est arrivé à la moitié du jeu au
 * premier essai. Ces tests l'attrapent avant l'écran.
 */
const DOSSIERS = ["public/assets/icons/jeu", "public/assets/icons/goods"];

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sources(p);
    return /\.(tsx?|css)$/.test(e.name) ? [p] : [];
  });
}

describe("le jeu d'icônes", () => {
  it("chaque icône est un SVG sans attribut en double", () => {
    for (const dir of DOSSIERS) {
      for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".svg"))) {
        const svg = fs.readFileSync(path.join(dir, f), "utf8");
        expect(`${f}: ${svg.startsWith("<svg")}`).toBe(`${f}: true`);
        for (const balise of svg.match(/<[a-z]+\s[^>]*>/g) ?? []) {
          const noms = [...balise.matchAll(/\s([a-z-]+)="/g)].map((m) => m[1]);
          const doubles = noms.filter((n, i) => noms.indexOf(n) !== i);
          expect(`${f}: ${doubles.join(",")}`).toBe(`${f}: `);
        }
      }
    }
  });

  it("chaque icône citée dans le code existe", () => {
    const citees = new Set<string>();
    for (const f of sources("src")) {
      for (const m of fs.readFileSync(f, "utf8").matchAll(/\/assets\/icons\/(?:jeu|goods)\/[a-z-]+\.svg/g)) citees.add(m[0]);
    }
    expect(citees.size).toBeGreaterThan(15);
    for (const c of citees) expect(`${c}: ${fs.existsSync(`public${c}`)}`).toBe(`${c}: true`);
  });

  it("chaque élément du catalogue de construction a son icône", () => {
    for (const d of catalogueConstruction()) {
      if (d.pose === "BATIMENT") continue; // un bâtiment montre son illustration
      expect(`${d.id}: ${fs.existsSync(`public/assets/icons/jeu/${d.id}.svg`)}`).toBe(`${d.id}: true`);
    }
  });
});
