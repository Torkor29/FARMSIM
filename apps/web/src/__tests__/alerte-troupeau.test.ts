import { welfareReasons, MORTALITY, crowdingPenalty } from "@farmsim/shared";
import fs from "node:fs";

/**
 * L'alerte de mortalité doit nommer le bon geste.
 *
 * Signalé en jeu, et le message a coûté dix bêtes. Le troupeau avait une
 * mangeoire pleine — la route de distribution refusait d'en prendre plus — et
 * quatre-vingt-six tonnes de litière. L'alerte disait pourtant « distribuez
 * une ration sans attendre ». Le joueur a cherché du grain pendant que ses
 * vaches mouraient de serrement.
 */
const PANNEAU = fs.readFileSync("src/LivestockPanel.tsx", "utf8");

describe("un troupeau nourri peut mourir d’autre chose", () => {
  it("vingt et une bêtes pour dix-huit places se voient, sans mettre en danger", () => {
    /*
     * Le cas exact rapporté, et ce qu'il est devenu. La satisfaction part de 1
     * quand rien ne manque ; le dépassement en retire 0,027 pour dix-sept pour
     * cent de trop — assez pour se lire sur le lait et être nommé au joueur,
     * pas assez pour approcher de quoi que ce soit de grave. Et la mortalité
     * ne lit plus cette jauge : elle lit la santé, qui ne bouge que par la
     * cascade.
     */
    const serrement = 21 / 18;
    const penalite = crowdingPenalty(serrement);
    const satisfaction = 1 - penalite;
    expect(penalite).toBeGreaterThan(0);
    expect(satisfaction).toBeLessThan(1);
    // La marge restante est immense, et c'est le point : ce troupeau va bien.
    expect(satisfaction - MORTALITY.floor).toBeGreaterThan(0.6);
  });

  it("dix-neuf bêtes pour cinquante-cinq places ne se signalent pas du tout", () => {
    /*
     * La capture de Strea, et le test qui l'empêche de revenir. Ration servie
     * avec un jour d'avance, litière pleine, dix-neuf têtes dans une étable de
     * cinquante-cinq places — et « le troupeau dépérit, des bêtes vont mourir ·
     * sortez-les au pré », devant un pré à zéro tonne d'herbe et 10 °C dehors.
     */
    expect(crowdingPenalty(19 / 55)).toBe(0);
    expect(
      welfareReasons({ crowding: 19 / 55, hunger: 0, water: 1, bedding: 0 }),
    ).toEqual([]);
  });

  it("et la cause dominante est bien le serrement, pas la faim", () => {
    const causes = welfareReasons({
      crowding: 21 / 18,
      hunger: 0, // mangeoire pleine
      water: 1, // abreuvoir plein
      bedding: 0, // litière en abondance
    });
    const pire = [...causes].sort((a, b) => b.cout - a.cout)[0]!;
    expect(pire.code).toBe("SURPEUPLEMENT");
  });

  it("l’alerte lit la cause du serveur au lieu d’accuser la faim d’office", () => {
    // La phrase en dur était le défaut : elle désignait le mauvais geste et
    // occupait le joueur ailleurs pendant que le lot s'effondrait.
    expect(PANNEAU).not.toMatch(/ne tient plus — des bêtes peuvent mourir\. Distribuez une ration\s*\n\s*sans attendre\./);
    const bloc = PANNEAU.slice(PANNEAU.indexOf("herd.atRisk &&"));
    expect(bloc.slice(0, 2600)).toMatch(/herd\.welfareCauses/);
    expect(bloc.slice(0, 2600)).toMatch(/sort\(\s*\(a, b\) => b\.cout - a\.cout/);
  });

  it("garde une phrase de repli si le serveur n’envoie aucune cause", () => {
    // Une alerte muette serait pire que l'alerte fausse qu'on remplace.
    const bloc = PANNEAU.slice(PANNEAU.indexOf("herd.atRisk &&"));
    expect(bloc.slice(0, 2600)).toMatch(/Distribuez une ration sans attendre/);
  });

  it("quand la faim domine vraiment, elle est bien nommée", () => {
    const causes = welfareReasons({ crowding: 0.5, hunger: 0.4, water: 1, bedding: 0 });
    const pire = [...causes].sort((a, b) => b.cout - a.cout)[0]!;
    expect(pire.code).toBe("FAIM");
  });
});
