/**
 * La qualité de rendu n'emporte plus les effets avec elle, et le joueur décide.
 *
 * ## Ce qui s'est passé
 *
 * Le jeu déclasse son rendu quand il observe des images trop lentes. Cette
 * prudence est juste — un téléphone d'entrée de gamme reste la cible — mais
 * elle avait trois défauts qui se sont payés ensemble, signalés en jouant le
 * 28 août : « il n'y a plus d'animation douce quand il tourne ni les petits
 * trucs de terre en animation qui étaient sympas ».
 *
 *  - **Un seul interrupteur pour deux choses sans rapport.** Les gerbes de
 *    terre, de grain et d'engrais étaient accrochées aux ombres. Or une passe
 *    d'ombres redessine toute la scène à chaque image, là où ces gerbes sont
 *    quelques dizaines de quadrilatères instanciés lancés toutes les
 *    quarante-cinq millisecondes. Le déclassement jetait le plaisir avec le
 *    coût.
 *  - **Muet.** Rien ne disait au joueur que le rendu avait changé ; il a cru
 *    à une régression du jeu.
 *  - **Sans recours.** Aucun réglage ne permettait de le contredire, et la
 *    lenteur observée pouvait n'être qu'un mauvais moment — les serveurs ont
 *    ramé toute la matinée du 28.
 *
 * Ces tests tiennent la séparation et le choix. Ils lisent la source pour
 * l'accrochage dans la vue de ferme : ce qui compte là-bas est *quelle*
 * variable garde la porte, et aucun rendu hors navigateur ne le dirait.
 */

import fs from "node:fs";
import {
  initialQuality,
  qualityChoice,
  setQualityChoice,
  type QualityChoice,
} from "../render-quality";

/*
 * Ces tests tournent hors navigateur : `localStorage` n'existe pas. On pose
 * le strict minimum que le réglage emploie — et cela vaut description du
 * contrat : trois méthodes, rien d'autre. Le code enveloppe déjà chaque accès
 * dans un `try`, pour la navigation privée et les navigateurs qui refusent le
 * stockage ; ce qui est testé ici, c'est le cas où il répond.
 */
const memoire = new Map<string, string>();
(globalThis as unknown as { localStorage: Partial<Storage> }).localStorage = {
  getItem: (k: string) => memoire.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memoire.set(k, String(v));
  },
  removeItem: (k: string) => {
    memoire.delete(k);
  },
};

const ISO = fs.readFileSync("src/IsoFarmView.tsx", "utf8");
const PROFILE = fs.readFileSync("src/ProfilePanel.tsx", "utf8");
const APP = fs.readFileSync("src/App.tsx", "utf8");

describe("les effets de chantier survivent au mode sobre", () => {
  // Le choix est global et persistant : un test qui en pose un le retire.
  afterEach(() => setQualityChoice("auto"));

  it("ne sont plus commandés par les ombres", () => {
    // La porte des projections est `projections`, pas `rich` : c'est
    // exactement la ligne qui faisait disparaître la terre.
    expect(ISO).toMatch(/const projections = quality\.sprays;/);
    expect(ISO).toMatch(/if \(working && projections && emitClock > 0\.045\)/);
    expect(ISO).not.toMatch(/working && rich && emitClock/);
  });

  it("restent allumés quand le rendu s'allège", () => {
    setQualityChoice("reduced");
    const sobre = initialQuality();
    expect(sobre.shadows).toBe(false);
    expect(sobre.sprays).toBe(true);
  });
});

describe("le joueur a le dernier mot sur la qualité", () => {
  afterEach(() => setQualityChoice("auto"));

  it("retient son choix, et retombe sur l'automatique quand il le retire", () => {
    expect(qualityChoice()).toBe("auto");
    for (const choix of ["full", "reduced"] as QualityChoice[]) {
      setQualityChoice(choix);
      expect(qualityChoice()).toBe(choix);
    }
    setQualityChoice("auto");
    expect(qualityChoice()).toBe("auto");
  });

  it("obtient tout ce qu'il demande en « Élevée »", () => {
    setQualityChoice("full");
    const tout = initialQuality();
    expect(tout.shadows).toBe(true);
    expect(tout.sprays).toBe(true);
    expect(tout.antialias).toBe(true);
    // Zéro : aucune bride. Le mode sobre plafonne à trente images par
    // seconde, et c'est ce plafond qui se lit comme « moins fluide ».
    expect(tout.maxFps).toBe(0);
  });

  it("trouve le réglage dans son menu, avec les trois choix", () => {
    expect(PROFILE).toMatch(/>Qualité graphique</);
    expect(PROFILE).toMatch(/onOpen\("graphics"\)/);
    for (const nom of ["Automatique", "Élevée", "Sobre"]) {
      expect(PROFILE).toContain(nom);
    }
  });

  it("voit l'écran changer tout de suite", () => {
    /*
     * Les réglages du rendu se fixent à la création du contexte WebGL. Sans
     * remontage, choisir « Élevée » ne changerait rien à l'image et le
     * réglage passerait pour cassé.
     */
    expect(PROFILE).toMatch(/onChange\?\.\(\)/);
    expect(APP).toMatch(/onQualityChange=\{\(\) => setQualiteVue\(/);
    expect(APP).toMatch(/key=\{`qualite-\$\{qualiteVue\}`\}/);
  });
});
