/**
 * Le tableau doit proposer la location, pas seulement refuser.
 *
 * ## Le parcours qu'on remplace
 *
 * Le parc de départ n'a ni moissonneuse ni épandeur. Une offre de moisson se
 * lisait avec son salaire, invitait à cliquer, et le serveur répondait « il
 * faut une moissonneuse-batteuse — passez au garage ». Le joueur n'apprenait
 * qu'après coup que la ligne ne le concernait pas, et rien ne lui disait
 * comment y arriver — alors que c'est justement par les contrats qu'un
 * débutant finance sa première moissonneuse.
 *
 * L'écran dit maintenant ce qui manque **avant** le clic, et met la sortie de
 * secours à côté avec son chiffre.
 *
 * ## Pourquoi lire le source
 *
 * Ce qui compte ici n'est pas un rendu mais un **branchement** : que l'écran
 * transmette bien le drapeau `rented` jusqu'à la requête. Un panneau qui
 * afficherait le bouton sans le passer serait indiscernable à l'œil et
 * ouvrirait un chantier au plein salaire — puis le refuserait.
 */

import { readFileSync } from "fs";

import {
  MISSION_RENTAL_SHARE,
  missionPayout,
  missionRentalFee,
  missionRentedPayout,
} from "@farmsim/shared";

const PANNEAU = readFileSync("src/OfficePanel.tsx", "utf8");
const APP = readFileSync("src/App.tsx", "utf8");
const MINIJEU = readFileSync("src/MissionPlay.tsx", "utf8");

describe("le tableau des voisins", () => {
  it("dit ce qui manque au lieu d’un bouton qui refusera", () => {
    expect(PANNEAU).toContain("manqueMachine");
    // Le bouton « Prendre » ne s'affiche que si rien ne manque : sinon on
    // reproduit le clic pour rien.
    expect(PANNEAU).toContain("{!ghostPick.manqueMachine && (");
  });

  it("propose la location avec son chiffre, pas seulement son principe", () => {
    expect(PANNEAU).toContain("ghostPick.location");
    expect(PANNEAU).toContain("location.materiel");
    expect(PANNEAU).toContain("location.salaire");
  });

  it("passe le drapeau jusqu’à la requête", () => {
    // Le point qui ne se voit pas à l'écran : sans lui, le bouton « Louer »
    // ouvrirait un chantier au plein salaire, que le serveur refuserait.
    expect(PANNEAU).toMatch(/onTakeGhost\(ghostPick\.id, true\)/);
    expect(PANNEAU).toMatch(/onTakeGhost: \(id: string, rented\?: boolean\) => void/);
    expect(APP).toMatch(/acceptContract\(id: string, rented = false\)/);
    expect(APP).toMatch(/JSON\.stringify\(\{ userId: player\.id, rented \}\)/);
    expect(APP).toMatch(/onTakeGhost=\{\(id, rented\) =>/);
  });

  it("ne parle plus d’un filet abandonné", () => {
    // Le panneau annonçait « Ancien filet — plus de nouveaux contrats
    // fantômes », ce qui était vrai tant que le générateur n'existait pas.
    expect(PANNEAU).not.toContain("Ancien filet");
  });
});

describe("le mini-jeu de chantier", () => {
  it("annonce ce qu’on encaissera vraiment, pas le salaire du tableau", () => {
    /*
     * Le bouton affichait `rewardCrd`. Sur un chantier loué ce n'est pas ce
     * qui tombe sur le compte : annoncer le brut puis verser le net est
     * l'écart qu'un joueur voit tout de suite.
     */
    expect(MINIJEU).toContain("contract.netCrd ?? contract.rewardCrd");
    expect(MINIJEU).toContain("Encaisser {aEncaisser} €");
    expect(MINIJEU).toContain("matériel loué");
    expect(MINIJEU).not.toContain("Encaisser {contract.rewardCrd} €");
  });

  it("retrouve son net après un rechargement de page", () => {
    // Le chantier en cours est relu depuis `/contracts` : sans ces champs, un
    // chantier loué repris après un F5 annoncerait le plein salaire.
    expect(APP).toContain("rented: c.active.rented");
    expect(APP).toContain("netCrd: c.active.netCrd");
  });
});

describe("l’avis de fin de chantier", () => {
  it("explique l’écart par la location quand il n’y a pas d’usure à montrer", () => {
    expect(APP).toContain("location −");
    expect(APP).toContain("r.rentalFee");
  });
});

describe("les chiffres annoncés", () => {
  it("sont ceux du paquet partagé, pas un second calcul", () => {
    // L'écran n'a aucun barème à lui : il affiche ce que le serveur envoie,
    // qui vient du même module que ce test interroge.
    for (const cells of [8, 16, 24]) {
      const brut = missionPayout("HARVEST", cells, "NPC");
      expect(missionRentalFee("HARVEST", cells, "NPC") + missionRentedPayout("HARVEST", cells, "NPC")).toBe(
        brut,
      );
    }
    expect(MISSION_RENTAL_SHARE).toBeGreaterThan(0);
    expect(MISSION_RENTAL_SHARE).toBeLessThan(1);
    // Et le panneau ne recopie nulle part le taux : il le lirait faux un jour.
    expect(PANNEAU).not.toContain("0.45");
    expect(PANNEAU).not.toContain("45 %");
  });
});
