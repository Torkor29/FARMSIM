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
  it("vingt et une bêtes pour dix-huit places se voient, sans mettre en danger", () => {
    /*
     * Le cas exact rapporté, et ce qu'il est devenu. Le plancher d'une bête
     * jamais sortie est 0,35, les pertes commencent à 0,15 : il reste 0,20 de
     * marge. La droite d'avant en mangeait les trois quarts pour dix-sept
     * pour cent de trop (0,146), si bien qu'un orage suffisait à achever le
     * lot. Le carré en mange un huitième (0,027) — assez pour se lire sur le
     * lait et être nommé au joueur, pas assez pour tuer quoi que ce soit.
     */
    const serrement = 21 / 18;
    const penalite = crowdingPenalty(serrement);
    const bienEtre = HAPPINESS.confinedFloor - penalite;
    expect(penalite).toBeGreaterThan(0);
    expect(bienEtre).toBeLessThan(HAPPINESS.confinedFloor);
    // La marge restante encaisse le pire hiver du jeu (0,225 pour la neige).
    expect(bienEtre - MORTALITY.floor).toBeGreaterThan(0.15);
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
