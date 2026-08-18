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

  /**
   * Le test précédent ne suffisait pas, et cinq dessins sont restés invisibles
   * malgré lui.
   *
   * Il éprouvait le **codage** : les fichiers étaient bien de l'UTF-8, donc il
   * passait. Mais ils contenaient l'octet `0x14` là où un point médian avait
   * été perdu, et `0x19` là où une apostrophe l'avait été. Ces deux octets
   * sont de l'UTF-8 parfaitement valide — et des caractères **interdits en
   * XML**, y compris à l'intérieur d'un commentaire.
   *
   * Un navigateur applique la règle XML, pas la règle du codage : il rejette
   * le document entier. Les huit SVG du jeu — les cinq bêtes, l'étable, le
   * tracteur, le blé — ne se sont donc jamais affichés, et rien ne le disait :
   * une `<img>` qui échoue ne lève aucune erreur, elle laisse un carré vide.
   *
   * On vérifie donc ici la règle que le navigateur applique réellement.
   */
  it("n’a aucun SVG qu’un navigateur refuserait de rendre", () => {
    // XML n'admet, sous 0x20, que la tabulation, le saut de ligne et le
    // retour chariot. Tout le reste invalide le document.
    const interdits = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
    const casses: { fichier: string; octets: string[] }[] = [];
    for (const f of fichiers) {
      if (!/\.svg$/i.test(f)) continue;
      const texte = readFileSync(f, "utf8");
      if (!interdits.test(texte)) continue;
      casses.push({
        fichier: f.slice(PUBLIC.length + 1),
        octets: [...new Set([...texte].filter((c) => interdits.test(c)))].map(
          (c) => "0x" + c.charCodeAt(0).toString(16).padStart(2, "0"),
        ),
      });
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
