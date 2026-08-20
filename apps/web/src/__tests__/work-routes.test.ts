/**
 * Tout travail de champ passe par un chantier.
 *
 * Régression trouvée en pilotant le jeu : « Tout récolter » appelait
 * `/harvest` **sans** ouvrir de chantier au préalable. Depuis que les travaux
 * passent par un sas, la route répondait « Il faut lancer le chantier avant de
 * le terminer » — le bouton ne pouvait plus aboutir, quel que soit l'état du
 * champ, et personne ne s'en était aperçu parce que rien ne le vérifiait.
 *
 * Le sas est côté serveur et bien testé ; ce qui manquait, c'est que l'écran
 * l'emprunte partout. C'est une propriété du **code source** — un appel à une
 * route de travail sans `jobId` est un défaut, qu'on peut lire sans exécuter
 * quoi que ce soit.
 */

import fs from "node:fs";

const SOURCE = fs.readFileSync("src/App.tsx", "utf8");

/** Les routes qui exigent un chantier ouvert, côté serveur. */
const ROUTES_DE_TRAVAIL = [
  "plant",
  "fertilize",
  "plow",
  "stubble",
  "harvest",
  "weed",
  "bale",
  "collect",
];

describe("les appels de travail", () => {
  for (const route of ROUTES_DE_TRAVAIL) {
    it(`/${route} n'est jamais appelée sans jobId`, () => {
      /*
       * On lit chaque appel visant la route, et le corps qui l'accompagne. Le
       * découpage est volontairement grossier : ce qui compte est qu'un
       * `jobId` figure dans la requête, pas la façon dont il y arrive.
       */
      const appels: string[] = [];
      // On ancre sur la parcelle : `/supplies/:id/collect` rentre une caisse
      // livrée, ce n'est pas un travail de champ et il n'a pas de chantier.
      const debut = "/parcels/${";
      let i = SOURCE.indexOf(debut);
      while (i !== -1) {
        const url = SOURCE.slice(i, SOURCE.indexOf("`", i));
        if (url.endsWith(`/${route}`)) {
          // Le corps de la requête suit l'URL, dans les ~600 caractères qui
          // viennent : assez pour couvrir un `body: JSON.stringify({...})`.
          appels.push(SOURCE.slice(i, i + 600));
        }
        i = SOURCE.indexOf(debut, i + 1);
      }
      expect(`/${route} appelée ${appels.length} fois`).toBe(
        `/${route} appelée ${appels.length} fois`,
      );
      expect(appels.length).toBeGreaterThan(0);
      const sansChantier = appels.filter((a) => !a.includes("jobId"));
      expect(`/${route} : ${sansChantier.length} appel(s) sans jobId`).toBe(
        `/${route} : 0 appel(s) sans jobId`,
      );
    });
  }

  it("le chantier s'ouvre avant le travail, jamais après", () => {
    // `ouvrirChantier` attend la durée du chantier puis rend son identifiant :
    // l'appeler après la route de travail annulerait tout l'intérêt du sas.
    expect(SOURCE).toContain("async function ouvrirChantier");
    expect(SOURCE).toContain("await ouvrirChantier(");
  });
});
