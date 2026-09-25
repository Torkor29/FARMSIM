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

describe("les pancartes modélisées dans Blender", () => {
  const PANCARTES = fs.readFileSync("blender/pancartes.py", "utf8");
  const CAMPAGNE = fs.readFileSync("src/countryside.ts", "utf8");
  const NOMS = ["pancarte-vente", "enseigne-rucher", "enseigne-cooperative", "enseigne-concession", "plaque-mairie"];

  it("sont livrées dans un seul fichier, une pièce nommée par pancarte", () => {
    const glb = fs.readFileSync("public/assets/decor3d/pancartes.glb");
    const texte = glb.toString("latin1");
    expect(glb.subarray(0, 4).toString("latin1")).toBe("glTF");
    expect(texte).toContain("EXT_meshopt_compression");
    for (const nom of NOMS) expect(texte).toContain(`"name":"${nom}"`);
    expect(glb.length).toBeLessThan(512 * 1024);
  });

  it("écrivent en relief dans la police du jeu, contours fusionnés", () => {
    // Une police variable garde des contours qui se chevauchent : remplis
    // pair-impair, ils trouaient les lettres (« N » sans jambage).
    expect(fs.existsSync("blender/polices/baloo2-800.ttf")).toBe(true);
    expect(PANCARTES).toMatch(/OverlapMode\.REMOVE/);
    expect(PANCARTES).toMatch(/extrude_face_region/);
  });

  it("remplacent chaque pancarte du jeu, la version en code restant en secours", () => {
    for (const nom of NOMS.slice(1)) expect(VILLAGE).toContain(`"${nom}"`);
    // Les « À VENDRE » sont instanciées : six appels de rendu pour toutes.
    expect(CAMPAGNE).toMatch(/instancierPiece\(PANCARTES, "pancarte-vente", poses, shadows\)/);
    expect(CAMPAGNE).toMatch(/\.catch\(pancartesEnCode\)/);
    expect(VILLAGE).toMatch(/\.catch\(enCode\)/);
  });
});
