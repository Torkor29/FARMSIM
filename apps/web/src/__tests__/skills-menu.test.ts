import fs from "node:fs";
import { SKILL_DEFS, SKILL_EFFECT_CAPS, type SkillEffectKind } from "@farmsim/shared";
import { EFFECT_META, effectCap, effectValue } from "../skill-effects";

/**
 * L'écran des compétences, tenu par sa structure.
 *
 * Il est né d'une capture d'écran : l'arbre logé dans un onglet du guide, ses
 * quatre branches écrasées dans 560 px, les cartes se chevauchant. Le contenu
 * n'était pas en cause — la boîte l'était. Rien n'empêche de l'y remettre par
 * mégarde à la prochaine refonte du guide : ces tests-là constatent l'endroit
 * où vivent les choses, pas leur apparence.
 */
const PLAY_GUIDE = fs.readFileSync("src/PlayGuide.tsx", "utf8");
const APP = fs.readFileSync("src/App.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");

describe("la porte des compétences", () => {
  it("n’est plus un onglet du guide de ferme", () => {
    // Le guide se consulte, l'arbre se suit : ce sont deux gestes différents,
    // et l'un ne doit plus se cacher dans l'autre.
    expect(PLAY_GUIDE).not.toMatch(/SkillTree/);
    expect(PLAY_GUIDE).not.toMatch(/label: "Compétences"/);
  });

  it("est un écran monté par l’application", () => {
    expect(APP).toMatch(/<SkillsScreen\b/);
    expect(APP).toMatch(/import \{ SkillsScreen/);
  });

  it("s’ouvre depuis le milieu du bandeau, entre la marque et les pastilles", () => {
    /*
     * « Il faut que ce soit tout en haut au milieu. » Le milieu n'est pas une
     * question de goût ici : c'est la seule place du bandeau qui n'appartient
     * à personne. Un test de position visuelle serait fragile ; l'ordre des
     * trois blocs dans le balisage, lui, ne ment pas.
     */
    const marque = APP.indexOf('className="brand-row"');
    const milieu = APP.indexOf('className="hud-center"');
    const pastilles = APP.indexOf('className="hud-stats"');
    expect(marque).toBeGreaterThan(-1);
    expect(milieu).toBeGreaterThan(marque);
    expect(pastilles).toBeGreaterThan(milieu);
    expect(APP).toMatch(/className=\{`skills-tab\$\{showSkills \? " on" : ""\}`\}/);
  });

  it("garde une cible atteignable au doigt", () => {
    // Charte §7.3 : quarante-quatre pixels. L'onglet se resserre à la souris,
    // jamais au doigt — et c'est le réglage tactile qu'on vérifie ici.
    const regle = CSS.match(/\n\.skills-tab \{([^}]*)\}/);
    expect(regle).not.toBeNull();
    expect(regle![1]).toMatch(/min-height:\s*44px/);
  });

  it("centre l’onglet sans jamais recouvrir ses voisins", () => {
    /*
     * Le piège du centrage absolu, mesuré au navigateur : sorti du flux à
     * `left: 50%`, l'onglet finissait à 869 px sur un écran de 1536, pour un
     * bloc de pastilles commençant à 843 — il se posait par-dessus le nom du
     * joueur. Les marges automatiques partagent la place restante à parts
     * égales : la collision devient structurellement impossible, quelle que
     * soit la longueur de ce nom.
     */
    const enFlux = CSS.match(/\n\.hud-center \{([^}]*)\}/);
    expect(enFlux).not.toBeNull();
    expect(enFlux![1]).toMatch(/margin-inline:\s*auto/);
    expect(CSS).not.toMatch(/\.hud-center \{[^}]*position:\s*absolute/);
  });

  it("reste un rectangle posé dans la ligne du bandeau", () => {
    /*
     * « Rectangle, bords légèrement arrondis, au milieu, un tout petit poil
     * écarté du haut mais pas trop pour ne pas empiéter sur les cours du
     * jour. » L'écart vient du remplissage de la barre — mesuré : 12 px sous
     * le bord de l'écran, 16 px au-dessus des cotations. Il est sûr par
     * construction tant que l'onglet reste une case de la ligne du bandeau :
     * les cotations sont la **rangée suivante** de `.hud-stack`, et seules une
     * sortie du flux ou une marge négative pourraient l'y faire descendre.
     */
    const regle = CSS.match(/\n\.skills-tab \{([^}]*)\}/);
    expect(regle).not.toBeNull();
    expect(regle![1]).toMatch(/border-radius:\s*var\(--r-md\)/);
    expect(regle![1]).not.toMatch(/position:\s*(absolute|fixed)/);
    expect(regle![1]).not.toMatch(/margin[\w-]*:\s*-/);
  });

  it("ne coûte pas une deuxième ligne au bandeau", () => {
    /*
     * L'onglet ajoute environ 200 px à une ligne qui n'en avait pas dix de
     * marge : mesuré, le bandeau se dédoublait dès 1440 px — 110 px de haut
     * au lieu de 58. Deux replis le rattrapent, et ils doivent rester là :
     * les pastilles décoratives s'effacent plus tôt qu'avant, et l'onglet
     * lui-même perd son libellé sur un bureau étroit.
     */
    expect(CSS).toMatch(/@media \(max-width: 1600px\) \{[^@]*\.mvp-badge \{ display: none; \}/);
    expect(CSS).toMatch(
      /@media \(max-width: 1240px\) \{[^@]*\.skills-tab-label \{ display: none; \}/,
    );
  });
});

describe("les avantages, tels qu’on les présente", () => {
  const LEVIERS = Object.keys(SKILL_EFFECT_CAPS) as SkillEffectKind[];

  it("nomment et situent chacun des treize leviers", () => {
    /*
     * Le type garantit qu'aucune clé ne manque ; il ne garantit pas qu'on ait
     * écrit autre chose qu'une chaîne vide. Or c'est la phrase `where` qui
     * fait tout le travail : devant « +3 % », un joueur demande *où ça se
     * voit*, et un titre seul ne le lui dit pas.
     */
    const muets = LEVIERS.filter(
      (k) => !EFFECT_META[k].title.trim() || EFFECT_META[k].where.trim().length < 20,
    );
    expect(muets).toEqual([]);
  });

  it("écrivent chaque levier dans son unité", () => {
    /*
     * Le stockage se compte en tonnes, tout le reste en fraction. Un levier
     * plafonné à 60 mais déclaré en pourcentage afficherait « +6000 % » —
     * personne ne le verrait dans une revue, tout le monde le verrait à
     * l'écran.
     */
    const faux = LEVIERS.filter((k) =>
      EFFECT_META[k].unit === "TONNES" ? SKILL_EFFECT_CAPS[k] <= 1 : SKILL_EFFECT_CAPS[k] > 1,
    );
    expect(faux).toEqual([]);
    expect(effectValue("STORAGE_GRAIN", 20)).toBe("20 t");
    expect(effectValue("CROP_YIELD", 0.05)).toBe("5 %");
    expect(effectCap("SALE_PRICE")).toBe("8 %");
  });

  it("ne montrent aucun levier que l’arbre ne pousse jamais", () => {
    // Une carte d'avantage sans compétence derrière serait une promesse que
    // rien ne tient : le joueur la verrait « en sommeil » pour toujours.
    const produits = new Set(SKILL_DEFS.flatMap((d) => d.effects.map((e) => e.kind)));
    const orphelins = LEVIERS.filter((k) => !produits.has(k));
    expect(orphelins).toEqual([]);
  });
});
