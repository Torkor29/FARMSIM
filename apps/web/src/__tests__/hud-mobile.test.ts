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

  it("porte la saison en icône ET en mot, et tient en une seule barre", () => {
    /*
     * Capture : logo, étoile, ∞ €, « Gris », voisin et ☰, chacun dans sa
     * pastille, et nulle part la saison. Un dessin suffit ; le mot « Gris »
     * n'ajoutait rien qu'un nuage ne dise. Deuxième capture : l'icône de
     * saison (une pousse) et l'étoile restaient muettes — on ajoute le mot.
     */
    expect(APP).toMatch(/<SeasonMark season=\{season\}/);
    expect(APP).toMatch(/saison-nom/);
    expect(APP).toMatch(/SEASON_SHORT\[season\]/);
    expect(APP).toMatch(/skills-tab-label court/);
    expect(APP).toMatch(/saison-btn/);
    expect(APP).toMatch(/<WeatherMark weather=\{localWeather\}/);
    expect(APP).not.toMatch(/weatherCourt/);
    expect(regle(".game-stage.mobile .hud-top")).toMatch(/border-radius:\s*16px/);
    expect(regle(".game-stage.mobile .hud-puce")).toMatch(/background:\s*transparent/);
    expect(regle(".game-stage.mobile .skills-tab-label.court")).toMatch(/display:\s*inline/);
    expect(regle(".game-stage.mobile .saison-nom")).toMatch(/display:\s*inline/);
  });

  it("laisse le guide joignable bien que le « ? » s’efface", () => {
    // Le « ? » ouvrait le même guide que le tiroir profil et que la puce
    // d'objectif. Il cède sa place — les deux autres portes restent.
    expect(CSS).toMatch(/\.game-stage\.mobile \.help-btn \{ display: none; \}/);
    expect(APP.match(/setShowGuide\(true\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("le plateau tactile", () => {
  const DOCK = fs.readFileSync("src/FieldDock.tsx", "utf8");

  it("offre Tout sélectionner, comme le bureau", () => {
    /*
     * Au doigt, prendre toutes les cases libres c'était glisser en évitant
     * le dock. Le bureau a Ctrl+A ; le téléphone n'avait que « Vider ».
     */
    expect(DOCK).toMatch(/onSelectAll/);
    expect(DOCK).toMatch(/Tout · \{eligibleCount\}/);
    expect(APP).toMatch(/onSelectAll=\{\(\) => \{/);
    expect(APP).toMatch(/eligibleCount=\{eligibleCells\(tool\)\.length\}/);
  });

  it("barre les graines hors saison, comme le rail de bureau", () => {
    // Sans cela on sélectionnait, on semait, et le refus arrivait après.
    expect(DOCK).toMatch(/o\.outOfSeason \? " out-of-season"/);
    expect(DOCK).toMatch(/horsSaison/);
    expect(regle(".chip.out-of-season")).toMatch(/line-through/);
  });

  it("n’offre plus Semis direct dans le menu, et Trace/Rectangle tient la place de Test", () => {
    /*
     * « Semis direct » ne disait rien au doigt — pas d'infobulle — et le
     * jeu le décide déjà : on sème dans les chaumes, c'est du direct.
     * Trace et rectangle vivaient dans chaque sous-menu ; Test occupait
     * le septième bouton du dock. Un tap au même endroit bascule le geste.
     */
    expect(DOCK).not.toMatch(/Semis direct/);
    expect(DOCK).toMatch(/\{dragRect \? "Rectangle" : "Trace"\}/);
    expect(DOCK).not.toMatch(/dock-label">Test/);
    expect(APP).toMatch(/directSeed: sowingDirect/);
  });

  it("écrit Ventes, le nom du menu, pas un tonnage", () => {
    /*
     * Capture : sac € + « 79 t ». On ne savait pas quel panneau ça ouvrait.
     * Le panneau s'intitule « Hôtel des ventes » ; le bouton porte le mot
     * qui s'y lit, et plus rien d'autre.
     */
    expect(fs.readFileSync("src/ui/tool-options.ts", "utf8")).toMatch(
      /id: "SELL", label: "Ventes"/,
    );
    expect(fs.readFileSync("src/MarketPanel.tsx", "utf8")).toMatch(/<h2>Hôtel des ventes<\/h2>/);
    expect(DOCK).toMatch(/className="dock-label">\{g\.label\}/);
    expect(DOCK).not.toMatch(/stockTons/);
    expect(DOCK).not.toMatch(/dock-badge stock/);
  });

  it("n’anime plus les menus depuis le bord de l’écran", () => {
    expect(CSS).not.toMatch(/rail-in-left/);
    expect(CSS).toMatch(/@keyframes panel-in/);
    expect(CSS).toMatch(/@keyframes tray-in/);
    expect(fs.readFileSync("src/ui/desktop/Window.tsx", "utf8")).toMatch(/createPortal/);
  });

  it("ne laisse pas Safari zoomer deux fois, ni sauter au doigt restant", () => {
    const VUE = fs.readFileSync("src/IsoFarmView.tsx", "utf8");
    expect(VUE).toMatch(/facteurMolette/);
    expect(VUE).toMatch(/pointer: coarse/);
    expect(VUE).toMatch(/doigtRestantApresPincement/);
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
