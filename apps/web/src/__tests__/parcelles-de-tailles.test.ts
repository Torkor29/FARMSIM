/**
 * Des parcelles de tailles différentes, et qui se voient.
 *
 * ## Le signalement, en deux temps
 *
 * D'abord : « les parcelles ont toutes les mêmes tailles, il devrait y avoir
 * des tailles différentes, seule la parcelle de base qu'on a tous devrait
 * avoir une taille standard ». Puis, sur le plan proposé : « il faut le voir
 * visuellement aussi, qu'on ait des lots plus grands et plus petits à côté de
 * chez soi ».
 *
 * Le deuxième temps est celui qui a demandé le plus de travail, et c'est lui
 * que ce fichier garde. Une colonne `gridW` qui varie en base ne change rien à
 * ce que le joueur voit : le paysage posait chaque voisin à l'emprise de
 * **l'île du joueur**, quelle que soit sa grille. Un lot de seize cases sur
 * seize et un de huit sur huit s'y dessinaient identiques.
 *
 * Le second signalement du même lot est ici aussi : « il faudrait un
 * indicateur discret qui permette de repérer ses propres parcelles ».
 */

import { readFileSync } from "fs";

import { COTE_MAX, GRILLE_STANDARD } from "@farmsim/shared";

import {
  COTES_DECOR,
  LARGEUR_CHEMIN,
  TALUS_PARCELLE,
  coteDeGrille,
  empriseParcelle,
  parcelleSous,
  planCampagne,
  type OptionsPlan,
  type VoisinReel,
} from "../countryside-plan";

/** Le pas d'une case, tel que la vue le passe : celui de la grille du joueur. */
const PAS_CASE = 1.06;
const EMPRISE = GRILLE_STANDARD.w * PAS_CASE + TALUS_PARCELLE;

/** Une parcelle du cadastre, réduite à ce que le plan en lit. */
function voisin(col: number, rang: number, cote: number, statut: VoisinReel["statut"] = "PNJ"): VoisinReel {
  return {
    id: `p-${col}-${rang}`,
    label: `Lot ${col},${rang}`,
    col,
    rang,
    statut,
    gridW: cote,
    gridH: cote,
    proprietaire: statut === "LIBRE" ? null : "Voisin",
    exploitation: statut === "LIBRE" ? null : "Ferme voisine",
    culture: "WHEAT",
    stade: "GROWING",
    partCultivee: 1,
    fertility: 0.7,
    batiments: [],
    cheptel: [],
    prix: 1000,
    achetable: true,
    refus: null,
  };
}

const OPTIONS: OptionsPlan = {
  graine: "clos-d-orme",
  emprise: EMPRISE,
  pasCase: PAS_CASE,
  cour: { x: -11.5, z: 2.5, w: 6, d: 9 },
};

describe("le côté d’une parcelle", () => {
  it("se déduit de sa grille, comme l’île du joueur", () => {
    // La même formule des deux côtés : c'est elle qui garantit qu'un voisin de
    // douze cases a exactement la taille du joueur quand il en a douze.
    expect(coteDeGrille(GRILLE_STANDARD.w, GRILLE_STANDARD.h, PAS_CASE)).toBe(EMPRISE);
  });

  it("grandit et rapetisse avec le nombre de cases", () => {
    const petit = coteDeGrille(8, 8, PAS_CASE);
    const grand = coteDeGrille(COTE_MAX, COTE_MAX, PAS_CASE);
    expect(petit).toBeLessThan(EMPRISE);
    expect(grand).toBeGreaterThan(EMPRISE);
    // L'écart doit se voir d'un champ à l'autre, pas se deviner.
    expect(grand - petit).toBeGreaterThan(6);
  });
});

describe("le paysage, quand la commune a répondu", () => {
  const voisins: VoisinReel[] = [
    voisin(-1, 0, 8),
    voisin(1, 0, COTE_MAX),
    voisin(0, -1, GRILLE_STANDARD.w),
    voisin(0, 1, 10),
    voisin(-1, -1, 14),
    voisin(1, 1, 8),
    voisin(1, -1, COTE_MAX),
    voisin(-1, 1, 12),
  ];
  const plan = planCampagne({ ...OPTIONS, voisins });
  /*
   * Par identifiant, et jamais par case : `orientationTrame` fait pivoter la
   * commune d'un quart de tour pour que la ferme du joueur ne se retrouve pas
   * dos au cadre. La case posée n'est donc pas celle qu'on a donnée.
   */
  const par = (id: string) => plan.parcelles.find((p) => p.id === id);

  it("donne à chaque champ la taille de sa grille", () => {
    /*
     * Le cœur du correctif. Auparavant, ces huit parcelles sortaient toutes du
     * plan avec l'emprise du joueur : la base savait, le paysage non.
     */
    const tailles = plan.parcelles.map((p) => p.cote);
    expect(new Set(tailles).size).toBeGreaterThanOrEqual(3);
    for (const p of plan.parcelles) {
      const grille = voisins.find((v) => v.id === p.id)!;
      expect({ id: p.id, cote: p.cote }).toEqual({
        id: p.id,
        cote: coteDeGrille(grille.gridW!, grille.gridH!, PAS_CASE),
      });
    }
  });

  it("met un lot plus grand et un lot plus petit à côté de chez soi", () => {
    /*
     * La demande, dite en une assertion, sur les parcelles **mitoyennes** —
     * celles qui touchent la ferme, pas celles du fond.
     *
     * Elles ne sont jamais quatre : la lisière mange les cases d'amont et le
     * chemin en occupe une. C'était déjà vrai avant ce changement.
     */
    const mitoyennes = plan.parcelles.filter((p) => Math.abs(p.col) + Math.abs(p.rang) === 1);
    expect(mitoyennes.length).toBeGreaterThanOrEqual(2);
    expect(mitoyennes.some((p) => p.cote < EMPRISE)).toBe(true);
    expect(mitoyennes.some((p) => p.cote > EMPRISE)).toBe(true);
  });

  it("ne dépeuple pas la campagne en s’écartant", () => {
    /*
     * Le garde-fou du pas élargi. La trame loge maintenant le plus grand lot,
     * donc elle occupe plus de terrain, et la lisière est à distance fixe :
     * trop écarter viderait le paysage de ses champs du fond. Mesuré sur une
     * commune pleine, on passe de vingt-sept parcelles à vingt-cinq — les
     * champs sont plus grands, le pays est aussi rempli.
     */
    const sansEchelle = planCampagne({
      graine: OPTIONS.graine,
      emprise: EMPRISE,
      cour: OPTIONS.cour,
      voisins,
    });
    expect(plan.parcelles.length).toBeGreaterThanOrEqual(sansEchelle.parcelles.length - 3);
  });

  it("écarte la trame assez pour loger le plus grand lot", () => {
    /*
     * Le pas valait l'emprise du joueur plus un chemin. Un très grand lot posé
     * sur cette trame-là aurait mordu sur le chemin de son voisin, et deux
     * champs se seraient touchés sans séparation.
     */
    expect(plan.pas).toBe(coteDeGrille(COTE_MAX, COTE_MAX, PAS_CASE) + LARGEUR_CHEMIN);
    for (const p of plan.parcelles) {
      expect({ id: p.id, tient: p.cote + LARGEUR_CHEMIN <= plan.pas + 1e-9 }).toEqual({
        id: p.id,
        tient: true,
      });
    }
  });

  it("ne laisse jamais deux champs se chevaucher", () => {
    // Le garde-fou de l'autre côté : des tailles variables sur une trame fixe,
    // c'est exactement la manière dont deux parcelles finissent l'une dans
    // l'autre.
    for (const a of plan.parcelles) {
      for (const b of plan.parcelles) {
        if (a === b) continue;
        const chevauche =
          Math.abs(a.x - b.x) < (a.cote + b.cote) / 2 - 1e-9 &&
          Math.abs(a.z - b.z) < (a.cote + b.cote) / 2 - 1e-9;
        expect({ a: a.id, b: b.id, chevauche }).toEqual({ a: a.id, b: b.id, chevauche: false });
      }
    }
  });

  it("rend l’emprise de chaque parcelle, et non celle du joueur", () => {
    const grand = par("p-1-0")!;
    expect(empriseParcelle(grand, plan.emprise).w).toBe(grand.cote);
    expect(empriseParcelle(grand, plan.emprise).w).toBeGreaterThan(EMPRISE);
  });
});

describe("le clic sur un champ", () => {
  const voisins: VoisinReel[] = [
    voisin(-1, 0, 8),
    voisin(1, 0, COTE_MAX),
    voisin(0, -1, GRILLE_STANDARD.w),
    voisin(0, 1, 8),
    voisin(-1, -1, 14),
    voisin(1, 1, 8),
    voisin(1, -1, COTE_MAX),
    voisin(-1, 1, 12),
  ];
  const plan = planCampagne({ ...OPTIONS, voisins });
  /* Parmi celles réellement posées : la lisière en refuse toujours quelques
     unes, et laquelle dépend du quart de tour de la commune. */
  const tries = [...plan.parcelles].sort((a, b) => a.cote - b.cote);
  const petit = tries[0]!;
  const grand = tries[tries.length - 1]!;

  it("touche la parcelle qu’on vise", () => {
    for (const p of plan.parcelles) {
      expect({ id: p.id, touche: parcelleSous(plan, p.x, p.z)?.id }).toEqual({
        id: p.id,
        touche: p.id,
      });
    }
  });

  it("ne touche rien dans l’herbe qui borde un petit lot", () => {
    /*
     * Le défaut qu'un côté par parcelle referme. `parcelleSous` mesurait
     * l'écart au centre contre l'emprise du **joueur** : autour d'un petit
     * lot, tout le pourtour d'herbe ouvrait sa fiche, alors qu'on n'était pas
     * sur le champ.
     */
    expect(petit.cote).toBeLessThan(EMPRISE);
    const justeDehors = petit.cote / 2 + 0.3;
    expect(parcelleSous(plan, petit.x + justeDehors, petit.z)).toBeNull();
    // Mais l'intérieur du champ répond toujours.
    expect(parcelleSous(plan, petit.x + petit.cote / 2 - 0.3, petit.z)?.id).toBe(petit.id);
  });

  it("répond jusqu’au bord d’un grand lot", () => {
    expect(grand.cote).toBeGreaterThan(EMPRISE);
    // Ce point-là est hors de l'emprise du joueur, et pourtant dans le champ :
    // c'est précisément ce que l'ancienne mesure refusait.
    const bord = EMPRISE / 2 + 0.5;
    expect(bord).toBeLessThan(grand.cote / 2);
    expect(parcelleSous(plan, grand.x + bord, grand.z)?.id).toBe(grand.id);
  });
});

describe("le décor, le temps que la carte réponde", () => {
  it("tire ses tailles dans le catalogue du jeu, sans recopier ses poids", () => {
    // Déroulé du catalogue : une taille y figure autant de fois qu'elle pèse.
    // Le jour où un poids change, le décor suit sans qu'on y touche.
    expect(new Set(COTES_DECOR).size).toBeGreaterThanOrEqual(3);
    expect(COTES_DECOR).toContain(GRILLE_STANDARD.w);
    expect(COTES_DECOR).toContain(COTE_MAX);
  });

  it("varie lui aussi, pour qu’il n’y ait pas d’ouverture d’un coup", () => {
    /*
     * Un décor uniforme suivi d'un pays varié donnerait un clignotement au
     * moment où la route répond — pire que l'uniformité, parce qu'on le voit
     * arriver.
     */
    const plan = planCampagne(OPTIONS);
    expect(new Set(plan.parcelles.map((p) => p.cote)).size).toBeGreaterThanOrEqual(3);
  });
});

describe("l’indicateur de ses propres parcelles", () => {
  const CAMPAGNE = readFileSync("src/countryside.ts", "utf8");

  it("pose une borne sur les parcelles à soi, et sur elles seules", () => {
    /*
     * « Il faudrait un indicateur discret qui permette de repérer ses propres
     * parcelles. » Le paysage disait tout d'un voisin — sa culture, son bâti,
     * son cheptel — sauf la seule chose qu'on cherche en s'y promenant.
     */
    expect(CAMPAGNE).toContain('p.reel?.statut === "MOI"');
    expect(CAMPAGNE).toMatch(/borne de propriété/i);
  });

  it("ne repeint pas le champ — un blé à soi reste un blé", () => {
    // Une teinte de champ aurait été lisible, et fausse : on ne reconnaîtrait
    // plus ses cultures. C'est un objet posé dessus, pas une couleur.
    expect(CAMPAGNE).toContain("0xf0d27a");
    expect(CAMPAGNE).not.toMatch(/statut === "MOI"[^;]*couleurChamp/);
  });

  it("dessine le champ à la taille de sa grille", () => {
    // La ligne qui rend le parcellaire visible : tout le reste s'y réfère.
    expect(CAMPAGNE).toContain("const emprise = p.cote;");
    expect(CAMPAGNE).toContain("casesDe");
  });
});

describe("aller sur sa parcelle en cliquant dessus", () => {
  const APP = readFileSync("src/App.tsx", "utf8");
  const FICHE = readFileSync("src/ParcelleVoisineSheet.tsx", "utf8");

  it("emmène sur la parcelle au lieu d’ouvrir une fiche sans issue", () => {
    /*
     * « On est obligé de cliquer sur un bouton pour changer de parcelle »,
     * puis « aller sur sa parcelle en cliquant dessus ». Le geste existait :
     * il ouvrait une fiche dont tout le contenu était « Cette parcelle est
     * déjà la vôtre ».
     */
    expect(APP).toContain('if (v.statut === "MOI") setActiveParcelId(v.id);');
  });

  it("ferme l’impasse partout, pas seulement dans le paysage", () => {
    expect(FICHE).toContain("Aller sur cette parcelle");
    // Le texte subsiste dans le commentaire qui raconte l'impasse ; c'est la
    // ligne d'affichage qui doit avoir disparu.
    expect(FICHE).not.toContain('<p className="voisin-refus">Cette parcelle est déjà la vôtre.');
    expect(APP).toContain("onAller={(id) => {");
  });

  it("dit la surface du lot qu’on regarde", () => {
    // Depuis que les parcelles n'ont plus la même taille, le prix seul ne se
    // compare plus d'un lot à l'autre.
    expect(FICHE).toContain("hectaresDeGrille");
    expect(FICHE).toContain("libelleDeTaille");
  });

  it("dit la surface qu'on possède vraiment, lots achetés compris", () => {
    // La ferme grandit par lots : sa surface est celle de ses cases, plus
    // celle de sa grille d'origine.
    expect(APP).toContain("hectaresDeGrille(grid.length || gw * gh, 1)");
  });
});
