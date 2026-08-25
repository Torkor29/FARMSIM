import fs from "node:fs";

/**
 * Les réponses d'une parcelle qu'on ne regarde plus.
 *
 * Deuxième moitié du défaut filmé en jeu. La première — le chantier 3D rejoué
 * sur le champ affiché — est corrigée ailleurs ; celle-ci explique ce que la
 * vidéo montre vraiment.
 *
 * Les chargements écrivaient leur réponse **sans vérifier qu'elle concernait
 * encore la parcelle regardée**. Changer de champ pendant qu'une requête est
 * partie — ce qui arrive constamment quand un chantier tourne, puisque l'écran
 * se rafraîchit toutes les quelques secondes — faisait atterrir les données de
 * l'ancienne par-dessus la nouvelle.
 *
 * À l'écran la parcelle oscillait : le champ passait de labouré à cultivé, les
 * chiffres de « 52 cases en chaumes, 100 % » à « 130 cases perdues, 80 % », et
 * le compte à rebours du chantier **remontait** — 33 s, 31 s, 32 s, 30 s.
 * Le joueur croyait voir sa récolte détruite.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");

describe("une réponse tardive n’écrase pas la parcelle affichée", () => {
  it("garde la parcelle affichée dans une référence, lisible à l’arrivée", () => {
    /*
     * Une référence et non un état : le garde s'exécute **après** l'attente,
     * dans une closure créée avant le changement. Un état capturé y serait
     * celui d'avant, c'est-à-dire précisément la mauvaise valeur.
     */
    expect(APP).toMatch(/const parcelleAffichee = useRef<string \| null>\(null\);/);
    expect(APP).toMatch(/parcelleAffichee\.current = activeParcelId;/);
  });

  it("filtre les quatre écritures de parcelle", () => {
    // Parcelle, voisinage, élevage, et l'échec d'élevage — en oublier une
    // laisserait l'oscillation sur cette donnée-là.
    const gardes = APP.match(/parcelleAffichee\.current !== /g) ?? [];
    expect(gardes.length).toBeGreaterThanOrEqual(4);
  });

  it("ne vide pas les étables d’une parcelle à cause de l’échec d’une autre", () => {
    /*
     * Le `catch` remettait les étables à zéro sans regarder de quelle parcelle
     * venait l'échec : une requête abandonnée sur le champ qu'on vient de
     * quitter effaçait le troupeau de celui qu'on ouvre.
     */
    const bloc = APP.slice(APP.indexOf("const loadLivestock = useCallback"));
    const attrape = bloc.slice(bloc.indexOf("} catch {"), bloc.indexOf("} catch {") + 300);
    expect(attrape).toMatch(/parcelleAffichee\.current !== parcelId/);
  });

  it("le chantier dit sur quel champ il a lieu", () => {
    /*
     * La barre affichait le dernier chantier lancé quelle que soit la parcelle
     * regardée. On la garde visible — un chantier en cours ne doit pas
     * disparaître parce qu'on regarde ailleurs — mais elle nomme son champ.
     */
    expect(APP).toMatch(/\n {4}parcelId: string;/);
    expect(APP).toMatch(/chantier\.parcelId !== activeParcelId/);
    expect(APP).toMatch(/chantier-ailleurs/);
  });
});
