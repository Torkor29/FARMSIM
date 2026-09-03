/**
 * Deux défauts signalés en jouant, et la règle qui les empêche de revenir.
 *
 *  - « La pop-up est toujours derrière, ce qui rend impossible le reste. »
 *  - « Le tuto est beaucoup trop court » et « ne s'affiche pas lors de la
 *    première entrée en jeu ».
 *
 * Le premier est une question d'empilement, et un empilement se vérifie : il
 * suffit de lire tous les `z-index` de la feuille de style et de s'assurer
 * qu'aucun calque du jeu ne dépasse la confirmation.
 */

import { readFileSync } from "node:fs";

import { ETAPES } from "../tutorial-steps";

// Chemins depuis la racine du paquet, comme le reste de la suite : les tests
// tournent en ESM, où `__dirname` n'existe pas.
const STYLES = readFileSync("src/styles.css", "utf8");
const APP = readFileSync("src/App.tsx", "utf8");

/** Le `z-index` d'un sélecteur, tel que la feuille de style le déclare. */
function zIndexDe(selecteur: string): number {
  const bloc = new RegExp(`\\.${selecteur}\\s*\\{[^}]*?z-index:\\s*(\\d+)`, "s").exec(STYLES);
  if (!bloc) throw new Error(`aucun z-index trouvé pour .${selecteur}`);
  return Number(bloc[1]);
}

describe("la fenêtre de confirmation", () => {
  /**
   * Le cas exact du signalement : vendre une machine depuis sa fiche, ou
   * licencier depuis le personnel, ouvrait la confirmation *derrière* l'écran
   * qui l'avait demandée.
   */
  it("passe devant tous les écrans du jeu", () => {
    const confirmation = zIndexDe("confirm-backdrop");
    for (const dessous of [
      "machine-sheet-backdrop",
      "care-backdrop",
      "voisin-backdrop",
      "tutorial-backdrop",
      "skills-backdrop",
      "toast",
    ]) {
      expect(zIndexDe(dessous)).toBeLessThan(confirmation);
    }
  });

  /**
   * Le vrai filet : n'importe quel calque futur, pas seulement ceux qu'on
   * connaît aujourd'hui. C'est ce qui manquait — le défaut est né d'un écran
   * ajouté plus haut que la confirmation, sans que personne y pense.
   */
  it("reste au-dessus de tout ce que la feuille de style empile", () => {
    const confirmation = zIndexDe("confirm-backdrop");
    const tous = [...STYLES.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1]));
    const plusHaut = Math.max(...tous);
    expect(plusHaut).toBe(confirmation);
  });

  it("garde de la marge pour un écran à venir", () => {
    // Un calque neuf doit pouvoir monter sans repasser devant par mégarde.
    const confirmation = zIndexDe("confirm-backdrop");
    const autres = [...STYLES.matchAll(/z-index:\s*(\d+)/g)]
      .map((m) => Number(m[1]))
      .filter((z) => z < confirmation);
    expect(confirmation - Math.max(...autres)).toBeGreaterThanOrEqual(100);
  });
});

describe("le tutoriel", () => {
  /**
   * Il s'ouvrait dès qu'un joueur existait — donc pendant l'installation,
   * derrière l'écran qui la mène, et il ne revenait jamais. Il attend
   * maintenant que le joueur ait vraiment une parcelle.
   */
  it("attend que le joueur soit installé sur sa ferme", () => {
    expect(APP).toMatch(/const installe = Boolean\(player\?\.farm\?\.parcels\?\.length\)/);
    expect(APP).toMatch(/if \(!installe\) return;\s*\n\s*if \(localStorage\.getItem\(TUTORIAL_KEY\)\)/);
  });

  it("couvre tout le jeu, pas seulement le semis", () => {
    const ids = ETAPES.map((e) => e.id);
    // Les quatre sujets absents de l'ancienne version, et qui valaient le
    // reproche « il ne montre pas les sections, les outils, comment nettoyer ».
    for (const attendu of ["outil", "desherber", "dechaumer", "troupeau", "personnel", "onglets"]) {
      expect(ids).toContain(attendu);
    }
    expect(ETAPES.length).toBeGreaterThanOrEqual(12);
  });

  it("montre chaque étape, il ne fait pas que la décrire", () => {
    for (const e of ETAPES) {
      expect(e.scene).toBeTruthy();
      expect(e.titre.length).toBeGreaterThan(3);
      expect(e.texte.length).toBeGreaterThan(40);
    }
  });

  it("dit le bon geste selon l'écran", () => {
    // Montrer un cliquer-glisser à quelqu'un qui joue au doigt, c'est lui
    // montrer ce qu'il ne peut pas faire.
    const selection = ETAPES.find((e) => e.id === "selection")!;
    expect(selection.texte).toMatch(/gliss/i);
    expect(selection.texteTactile).toBeTruthy();
    expect(selection.texteTactile).not.toMatch(/glissez/i);
  });

  it("range les étapes par chapitres suivis", () => {
    // Un chapitre qui revient plus loin, c'est un plan qu'on a perdu.
    const vus: string[] = [];
    for (const e of ETAPES) {
      if (vus[vus.length - 1] !== e.chapitre) {
        expect(vus).not.toContain(e.chapitre);
        vus.push(e.chapitre);
      }
    }
    expect(vus.length).toBeGreaterThanOrEqual(4);
  });

  it("donne un identifiant unique à chaque étape", () => {
    expect(new Set(ETAPES.map((e) => e.id)).size).toBe(ETAPES.length);
  });
});
