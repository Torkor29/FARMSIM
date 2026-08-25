import { welfareReasons, HAPPINESS, MORTALITY, crowdingPenalty } from "@farmsim/shared";
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
  it("vingt et une bêtes pour dix-huit places suffisent à approcher le seuil", () => {
    /*
     * Le cas exact rapporté. Le plancher d'une bête jamais sortie est 0,35 et
     * les pertes commencent à 0,15 : il ne reste que 0,20 de marge, et le
     * seul serrement en mange les trois quarts. Nourrir n'y change rien.
     */
    const serrement = 21 / 18;
    const penalite = crowdingPenalty(serrement);
    const bienEtre = HAPPINESS.confinedFloor - penalite;
    expect(penalite).toBeGreaterThan(0.1);
    expect(bienEtre).toBeLessThan(HAPPINESS.confinedFloor);
    expect(bienEtre - MORTALITY.floor).toBeLessThan(0.1);
  });

  it("et la cause dominante est bien le serrement, pas la faim", () => {
    const causes = welfareReasons({
      hasPaddock: true,
      grazedRecentlyMs: Number.MAX_SAFE_INTEGER,
      crowding: 21 / 18,
      hunger: 0, // mangeoire pleine
      bedding: 0, // litière en abondance
    });
    const pire = [...causes].sort((a, b) => b.cout - a.cout)[0]!;
    expect(pire.code).not.toBe("FAIM");
    expect(["SORTIE", "SURPEUPLEMENT"]).toContain(pire.code);
  });

  it("l’alerte lit la cause du serveur au lieu d’accuser la faim d’office", () => {
    // La phrase en dur était le défaut : elle désignait le mauvais geste et
    // occupait le joueur ailleurs pendant que le lot s'effondrait.
    expect(PANNEAU).not.toMatch(/dépérit — des bêtes vont mourir\. Distribuez une ration\s*\n\s*sans attendre\./);
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
    const causes = welfareReasons({
      hasPaddock: true,
      grazedRecentlyMs: 0,
      crowding: 0.5,
      hunger: 0.4,
      bedding: 0,
    });
    const pire = [...causes].sort((a, b) => b.cout - a.cout)[0]!;
    expect(pire.code).toBe("FAIM");
  });
});
