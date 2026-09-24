import fs from "node:fs";
import path from "node:path";

/**
 * Tout voile modal sort du plateau, sinon son plan d'affichage ne vaut rien.
 *
 * Signalé plusieurs fois en jeu — « quand t'appuies sur acheter de la paille,
 * la popup s'ouvre derrière » — et jamais sur un seul bouton.
 *
 * La cause n'était pas un z-index mal réglé. Pendant une partie, la feuille de
 * style pose `html.playing .game-stage { position: fixed; inset: 0 }`, et
 * **`position: fixed` crée un contexte d'empilement**. Tout ce qui était rendu
 * dans le plateau s'y trouvait enfermé : ses z-index ne se comparaient plus à
 * ceux des fenêtres, que `Window` pose par portail dans `<body>`.
 *
 * Mesuré dans le navigateur avant correction, ordre de peinture réel :
 *
 *     .win-backdrop       z-index: 30   ← devant
 *     .tutorial-backdrop  z-index: 50
 *     .market-backdrop    z-index: 40   ← derrière
 *
 * Un 30 devant un 50 : la comparaison n'avait pas lieu. Après correction, le
 * marché passe bien devant la fenêtre Élevage — vérifié de la même façon.
 *
 * Ce test attrape le voile qu'on ajoutera demain sans portail. Il lit les
 * sources plutôt que de rendre les composants : c'est la convention de ce
 * dossier, et cela suffit — ce qui compte est qu'un portail soit là.
 */
const SRC = path.join(process.cwd(), "src");

/** Les fichiers qui posent un voile modal, et comment ils en sortent. */
function voiles(): { fichier: string; classe: string; texte: string }[] {
  const out: { fichier: string; classe: string; texte: string }[] = [];
  const parcourir = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "__tests__") parcourir(p);
        continue;
      }
      if (!e.name.endsWith(".tsx")) continue;
      const texte = fs.readFileSync(p, "utf8");
      const m = texte.match(/className=["'`][^"'`]*?([a-z-]+-backdrop)/);
      if (m) out.push({ fichier: path.relative(SRC, p), classe: m[1], texte });
    }
  };
  parcourir(SRC);
  return out;
}

describe("les voiles modaux sortent du plateau", () => {
  const tous = voiles();

  it("il y en a bien plusieurs — le test ne mesure pas le vide", () => {
    expect(tous.length).toBeGreaterThanOrEqual(12);
  });

  it.each(voiles().map((v) => [v.fichier, v.classe] as const))(
    "%s (.%s) se pose dans <body>",
    (fichier) => {
      const v = tous.find((x) => x.fichier === fichier)!;
      /*
       * Deux façons acceptables d'en sortir : le composant `Portail`, ou un
       * `createPortal` écrit à la main — `Window` et la fiche d'engin le
       * faisaient déjà avant que le helper existe.
       */
      const sort = /<Portail>/.test(v.texte) || /createPortal\(/.test(v.texte);
      expect(sort).toBe(true);
    },
  );
});

describe("l'échelle des plans reste lisible", () => {
  const CSS = fs.readFileSync(path.join(SRC, "styles.css"), "utf8");

  it("elle est écrite en un seul endroit", () => {
    // Sans elle, chaque voile reprend un nombre au hasard et l'ordre redevient
    // le fruit du hasard — ce qu'on vient de corriger.
    expect(CSS).toMatch(/L'ÉCHELLE DES PLANS/);
  });

  it("la confirmation passe devant tout le reste", () => {
    /*
     * Elle porte toujours sur quelque chose déjà ouvert. À 60 elle passait
     * derrière la fiche d'engin (90), d'où part pourtant « Reprise de … ? ».
     */
    const z = (classe: string) => {
      const bloc = CSS.slice(CSS.indexOf(`.${classe} {`));
      return Number(bloc.slice(0, 400).match(/z-index:\s*(\d+)/)?.[1] ?? 0);
    };
    const confirmation = z("confirm-backdrop");
    for (const autre of [
      "win-backdrop",
      "market-backdrop",
      "tutorial-backdrop",
      "care-backdrop",
      "voisin-backdrop",
      "skills-backdrop",
      "guide-backdrop",
      "machine-sheet-backdrop",
    ]) {
      expect(confirmation).toBeGreaterThan(z(autre));
    }
  });

  it("la notification passe devant les fenêtres, et sous la confirmation", () => {
    /*
     * « Quand on achète le foin, la notif d'achat passe derrière la fenêtre. »
     * Rendue dans le plateau, elle était enfermée dans son contexte
     * d'empilement : aucun z-index ne pouvait la faire passer devant le
     * marché. Elle sort par portail, et se range au-dessus de tout voile.
     */
    const z = (classe: string) => {
      const bloc = CSS.slice(CSS.indexOf(`.${classe} {`));
      return Number(bloc.slice(0, 1200).match(/z-index:\s*(\d+)/)?.[1] ?? 0);
    };
    const toast = z("toast");
    for (const voile of [
      "win-backdrop",
      "market-backdrop",
      "tutorial-backdrop",
      "care-backdrop",
      "voisin-backdrop",
      "skills-backdrop",
      "guide-backdrop",
      "machine-sheet-backdrop",
    ]) {
      expect(toast).toBeGreaterThan(z(voile));
    }
    expect(toast).toBeLessThan(z("confirm-backdrop"));
    const APP = fs.readFileSync(path.join(SRC, "App.tsx"), "utf8");
    expect(APP).toMatch(/<Portail>\s*<div key=\{toastTick\} className=\{`toast/);
  });
});
