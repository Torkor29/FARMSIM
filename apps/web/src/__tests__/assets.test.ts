import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ANIMAL_ART, ANIMAL_GRAZE_ART, BUILDING_ART, BUILDING_DEFS, type BuildingType } from "@farmsim/shared";

// Les tests tournent en modules ES : pas de `__dirname`. Jest les lance depuis
// la racine du paquet, c'est-à-dire `apps/web`.
const PUBLIC = join(process.cwd(), "public");

function tousLesFichiers(dossier: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...tousLesFichiers(chemin));
    else out.push(chemin);
  }
  return out;
}

/**
 * Les images du jeu, vérifiées comme des fichiers et non comme des intentions.
 *
 * Les cinq dessins d'animaux ne s'affichaient pas : un carré gris à la place
 * de la vache, dans toute la fiche d'élevage. La cause n'était pas un chemin
 * faux — le serveur les rendait bien, en 200 — mais un encodage. Chaque
 * fichier portait un « é » écrit en latin-1 dans un commentaire, à l'intérieur
 * d'un SVG que le navigateur lit en UTF-8 strict : il refuse le document
 * entier pour un octet invalide, fût-il dans un commentaire.
 *
 * Rien ne pouvait le détecter à la lecture du code, et rien ne l'aurait
 * détecté à l'exécution : un `<img>` qui échoue ne lève pas d'erreur.
 */
describe("images livrées", () => {
  const fichiers = tousLesFichiers(PUBLIC);

  it("connaît le dossier public", () => {
    expect(fichiers.length).toBeGreaterThan(5);
  });

  it("n’a aucun fichier texte au codage invalide", () => {
    const decodeur = new TextDecoder("utf-8", { fatal: true });
    const casses: string[] = [];
    for (const f of fichiers) {
      if (!/\.(svg|html|json|txt|webmanifest)$/i.test(f)) continue;
      try {
        decodeur.decode(readFileSync(f));
      } catch {
        casses.push(f.slice(PUBLIC.length + 1));
      }
    }
    expect(casses).toEqual([]);
  });

  it("sert une vignette existante pour chaque bâtiment", () => {
    const manquants = (Object.keys(BUILDING_DEFS) as BuildingType[])
      .map((t) => [t, BUILDING_ART[t]] as const)
      .filter(([, url]) => {
        if (!url) return true;
        try {
          statSync(join(PUBLIC, url.replace(/^\//, "")));
          return false;
        } catch {
          return true;
        }
      })
      .map(([t]) => t);
    expect(manquants).toEqual([]);
  });

  it("sert un dessin existant pour chaque espèce", () => {
    const urls = [...Object.values(ANIMAL_ART), ...Object.values(ANIMAL_GRAZE_ART)];
    const manquants = urls.filter((url) => {
      try {
        statSync(join(PUBLIC, url.replace(/^\//, "")));
        return false;
      } catch {
        return true;
      }
    });
    expect(manquants).toEqual([]);
  });
});
