import fs from "node:fs";

/**
 * Un chantier n'appartient qu'à sa parcelle.
 *
 * Signalé en jeu, avec la vidéo : « quand tu changes de champs pendant que
 * t'as lancé un outil, ça fait ça ». Ce que ça faisait : le labour lancé sur
 * un champ se rejouait à l'identique sur celui qu'on venait d'ouvrir.
 *
 * La cause tient en une omission. `activeWork` portait les coordonnées des
 * cases — relatives à la parcelle — et **rien pour dire de quelle parcelle**.
 * Le tracteur, la poussière et les cases qui s'allument retrouvaient donc les
 * mêmes x et y sur le champ voisin, et le joueur voyait une culture intacte se
 * faire retourner sous ses yeux. Le serveur, lui, n'y touchait pas : rien
 * n'était perdu, mais rien ne le disait non plus.
 */
const VIEW = fs.readFileSync("src/IsoFarmView.tsx", "utf8");
const APP = fs.readFileSync("src/App.tsx", "utf8");
const VITRINE = fs.readFileSync("src/MachineShowcase.tsx", "utf8");

describe("le chantier reste sur son champ", () => {
  it("le type porte la parcelle, et elle n’est pas facultative", () => {
    // Facultative, l'omission serait repassée sans bruit à l'appel suivant.
    const bloc = VIEW.slice(VIEW.indexOf("export type ActiveWork"));
    expect(bloc.slice(0, 1400)).toMatch(/\n {2}parcelId: string;/);
  });

  it("la vue ignore un chantier qui n’est pas le sien", () => {
    expect(VIEW).toMatch(/activeWork && activeWork\.parcelId === parcelId \? activeWork : null/);
  });

  it("et l’ignore des deux côtés du ref, pas seulement à l’initialisation", () => {
    /*
     * `dataRef` est écrit deux fois : à la création, puis à chaque rendu. Ne
     * filtrer qu'à la création laisserait le chantier revenir au premier
     * rendu suivant — c'est-à-dire tout de suite, et le défaut serait intact.
     */
    const occurrences = VIEW.match(/activeWork: chantierIci/g) ?? [];
    expect(occurrences).toHaveLength(2);
    expect(VIEW).not.toMatch(/\n {4}activeWork,\n {4}grazing,/);
  });

  it("la parcelle est retenue au clic, pas à l’arrivée de l’engin", () => {
    /*
     * Le matériel met quelques secondes à arriver. Lire la parcelle courante
     * dans la minuterie enverrait l'engin sur celle qu'on regarde à ce
     * moment-là — le défaut d'origine, déplacé de quelques secondes.
     */
    const bloc = APP.slice(APP.indexOf("function flashWork"));
    const avantMinuterie = bloc.slice(0, bloc.indexOf("const partir ="));
    expect(avantMinuterie).toMatch(/const parcelleDuChantier = activeParcelId;/);
    expect(bloc).toMatch(/parcelId: parcelleDuChantier,/);
    expect(bloc).not.toMatch(/parcelId: activeParcelId,/);
  });

  it("la vitrine des engins déclare la sienne, sinon elle reste vide", () => {
    // Le filtre s'applique partout : la page atelier doit donner à sa vue le
    // même identifiant qu'à son chantier, sans quoi elle n'affiche plus rien.
    expect(VITRINE).toMatch(/parcelId: PARCELLE_VITRINE,/);
    expect(VITRINE).toMatch(/parcelId=\{PARCELLE_VITRINE\}/);
  });
});
