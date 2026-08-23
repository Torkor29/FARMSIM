import fs from "node:fs";

/**
 * Ce que l'interface coûte au champ, sur téléphone.
 *
 * Mesuré sur un écran de 390 × 844 avant ce travail : vingt-trois pour cent de
 * la hauteur perdue en vue simple, trente-deux un outil en main. Deux bandeaux
 * pleine largeur y passaient l'essentiel de leur temps à ne rien dire —
 * trente pixels de cotations qu'on consulte avant de vendre, quarante-quatre
 * pour annoncer qu'un voisin est là.
 *
 * Rien n'a été retiré : les cotations se déplient d'un doigt, les voisins
 * ouvrent la même vue qu'avant, et le guide reste joignable par le tiroir et
 * par la puce d'objectif. Ce qui a changé, c'est le moment où on les montre.
 *
 * Ces assertions tiennent la structure, pas l'apparence — la mesure, elle, se
 * refait à l'écran.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");

/**
 * Tout ce que la feuille déclare pour un sélecteur, mis bout à bout.
 *
 * Première version : la première occurrence seulement. Elle rendait
 * `.meteo-puce { cursor: default }` en ignorant le `flex: none` déclaré plus
 * bas, et le test échouait sur une règle pourtant présente. Le CSS cascade —
 * une lecture qui s'arrête à la première déclaration lit autre chose que ce
 * que voit le navigateur.
 */
function regle(selecteur: string): string | null {
  const cle = selecteur + " {";
  const corps: string[] = [];
  for (let i = CSS.indexOf(cle); i >= 0; i = CSS.indexOf(cle, i + 1)) {
    corps.push(CSS.slice(i + cle.length, CSS.indexOf("}", i)));
  }
  return corps.length ? corps.join("\n") : null;
}

describe("les cotations", () => {
  const MARCHE = fs.readFileSync("src/MarketPanel.tsx", "utf8");

  it("ont quitté la ferme pour le marché", () => {
    /*
     * Un bandeau permanent en haut de l'écran — trente pixels de hauteur, sur
     * bureau comme au téléphone — pour une information qu'on consulte **avant
     * de vendre**, pas pendant qu'on laboure. Première correction : une puce
     * dépliable au doigt, mais le bandeau restait sur écran large, où il
     * mangeait autant de place pour la même raison. Elles sont maintenant là
     * où sert le prix : à côté du bouton qui vend.
     */
    expect(APP).not.toMatch(/className="market-ticker"/);
    expect(APP).not.toMatch(/cours-puce/);
    expect(MARCHE).toMatch(/className="cotations"/);
  });

  it("disent dans quel sens ça bouge", () => {
    // Un prix sans son écart ne dit pas s'il faut vendre aujourd'hui ou
    // attendre : c'est la moitié de l'information.
    expect(MARCHE).toMatch(/prevPrices/);
    expect(MARCHE).toMatch(/ecart > 0\.05 \? "up"/);
  });

  it("reçoivent bien les cours de la veille", () => {
    expect(APP).toMatch(/<MarketPanel\s+prevPrices=\{prevPrices\}/);
  });

  it("montrent toutes les denrées, pas une vedette", () => {
    // La puce n'en montrait qu'une, faute de place. Le panneau les a toutes.
    expect(MARCHE).toMatch(/marketPrices\.map\(\(m\) => \{/);
  });
});

describe("la présence", () => {
  it("est une pastille comptée au doigt, un bandeau à la souris", () => {
    expect(APP).toMatch(/\{!isMobile && onlinePlayers\.some/);
    expect(APP).toMatch(/className="hud-puce voisins-puce"/);
  });

  it("ne compte jamais le joueur lui-même", () => {
    expect(APP).toMatch(/const voisinsEnLigne = onlinePlayers\.filter\(\(p\) => p\.online && p\.id !== player\?\.id\)/);
  });
});

describe("le bandeau du haut", () => {
  it("peut descendre sous la largeur de son contenu", () => {
    /*
     * Le défaut exact, mesuré : `.hud-top` faisait 492 px de large dans un
     * écran de 390 et poussait le ☰ hors du cadre — un élément de grille
     * garde `min-width: auto` et refuse de se comprimer. Les puces avaient
     * beau être rétrécissables, la boîte qui les tient ne l'était pas.
     */
    const r = regle(".hud-top,\n.hud-stats");
    expect(r).not.toBeNull();
    expect(r).toMatch(/min-width:\s*0/);
  });

  it("garde ce qui ouvre une porte, rétrécit ce qui informe", () => {
    expect(regle(".game-stage.mobile .profile-btn,\n.game-stage.mobile .help-btn")).toMatch(
      /flex:\s*none/,
    );
    expect(regle(".meteo-puce")).toMatch(/flex:\s*none/);
    expect(regle(".cours-puce")).toMatch(/flex-shrink:\s*2/);
  });

  it("n’écrit pas une somme qu’il devra couper", () => {
    expect(APP).toMatch(/return hasUnlimitedFunds\(player\) \? "∞ €" : formatEurosCourt\(player\.crd\)/);
  });

  it("laisse le guide joignable bien que le « ? » s’efface", () => {
    // Le « ? » ouvrait le même guide que le tiroir profil et que la puce
    // d'objectif. Il cède sa place — les deux autres portes restent.
    expect(CSS).toMatch(/\.game-stage\.mobile \.help-btn \{ display: none; \}/);
    expect(APP.match(/setShowGuide\(true\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("le bas de l’écran", () => {
  it("resserre les cartes sans descendre sous le plancher tactile", () => {
    // Quarante-quatre pixels, charte §7.3. Ce qu'on récupère, c'est le
    // rembourrage autour du pictogramme — jamais la cible.
    const r = regle(".game-stage.mobile .dock-tool");
    expect(r).not.toBeNull();
    const min = /min-height:\s*(\d+)px/.exec(r!);
    expect(min).not.toBeNull();
    expect(Number(min![1])).toBeGreaterThanOrEqual(44);
  });

  it("colle les trois cartes plutôt que d’en supprimer une", () => {
    expect(regle(".game-stage.mobile .field-dock")).toMatch(/gap:\s*0\.2\d*rem/);
    for (const c of [".game-stage.mobile .quest-chip", ".game-stage.mobile .dock-tray", ".game-stage.mobile .dock-bar"]) {
      expect(regle(c)).not.toBeNull();
    }
  });
});
