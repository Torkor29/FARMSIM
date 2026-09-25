import fs from "node:fs";

import { MODELES_DISPONIBLES } from "../modeles-decor";

/**
 * Le rucher est modélisé dans Blender.
 *
 * Trois versions dessinées en code — pavés, caisses, ruches en paille — ont
 * appelé « c'est quoi ça ? » puis « c'est horrible ». Le modèle vient
 * maintenant d'un script Blender versionné, exporté en `.glb` compressé.
 */
const VILLAGE = fs.readFileSync("src/village3d.ts", "utf8");
const SCRIPT = fs.readFileSync("blender/rucher.py", "utf8");

describe("le rucher modélisé dans Blender", () => {
  it("est livré, compressé, avec le script qui le refait", () => {
    const glb = fs.readFileSync("public/assets/decor3d/rucher.glb");
    // En-tête glTF binaire, et l'extension meshopt que le jeu sait décoder.
    expect(glb.subarray(0, 4).toString("latin1")).toBe("glTF");
    expect(glb.toString("latin1")).toContain("EXT_meshopt_compression");
    // Un décor, pas un film : moins d'un demi-mégaoctet.
    expect(glb.length).toBeLessThan(512 * 1024);
    expect(SCRIPT).toMatch(/def ruche\(/);
    expect(SCRIPT).toMatch(/def lavande\(/);
    expect(SCRIPT).toMatch(/def tournesol\(/);
    expect(SCRIPT).toMatch(/"meshopt"/);
  });

  it("se charge dans le jeu, avec la version en code en secours", () => {
    expect(VILLAGE).toMatch(/poserModele\("\/assets\/decor3d\/rucher\.glb", shadows\)/);
    expect(VILLAGE).toMatch(/\.catch\(\(\) => \{\s*const secours/);
    // Dans Node, pas de fichier à chercher : les tests montent la version en code.
    expect(MODELES_DISPONIBLES).toBe(false);
  });
});
