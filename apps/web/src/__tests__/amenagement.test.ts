import {
  BONUS_AMENAGEMENT_MAX,
  MARGE_DOMAINE,
  bonusAmenagementCase,
  bornesDomaine,
  catalogueConstruction,
  champsDe,
  charmeDe,
  construireGrille,
  defConstruction,
  empriseOrientee,
  etatLot,
  lotsDuDomaine,
  masqueVoisins,
  niveauPourLot,
  prixLot,
  rectangleCases,
  validerPeinture,
  validerPose,
  BUILDING_DEFS,
  type CaseSource,
} from "@farmsim/shared";

/**
 * Les règles de la ferme libre.
 *
 * Ce sont elles que lisent à la fois le serveur (qui refuse) et le jeu (qui
 * peint le fantôme) : les tester ici, c'est tester les deux.
 */

/** Une ferme de 12×12 toute en champ, comme celles d'avant la ferme libre. */
function fermeClassique(): CaseSource[] {
  const cells: CaseSource[] = [];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) cells.push({ x, y, sol: "CHAMP", kind: "EMPTY" });
  return cells;
}

const bornes = bornesDomaine(12, 12, MARGE_DOMAINE);
const def = (id: string) => defConstruction(id)!;

describe("le catalogue", () => {
  it("décrit chaque entrée par des données, bâtiments du jeu compris", () => {
    const cat = catalogueConstruction();
    const ids = new Set(cat.map((d) => d.id));
    expect(ids.size).toBe(cat.length);
    // Tous les bâtiments du jeu y sont, sans liste recopiée à la main.
    for (const t of Object.keys(BUILDING_DEFS)) expect(ids.has(`batiment:${t}`)).toBe(true);
    // Au moins dix objets et terrains propres à la ferme libre.
    expect(cat.filter((d) => d.pose !== "BATIMENT").length).toBeGreaterThanOrEqual(10);
    for (const d of cat) {
      expect(d.prix).toBeGreaterThanOrEqual(0);
      expect(d.rotations.length).toBeGreaterThan(0);
      expect(d.nom.length).toBeGreaterThan(0);
    }
  });

  it("permute largeur et profondeur aux quarts impairs", () => {
    const grange = def("batiment:MACHINE_SHED");
    expect(empriseOrientee(grange, 0)).toEqual({ w: 3, h: 2 });
    expect(empriseOrientee(grange, 1)).toEqual({ w: 2, h: 3 });
    expect(empriseOrientee(grange, 2)).toEqual({ w: 3, h: 2 });
  });
});

describe("la pose", () => {
  it("accepte un bâtiment sur du pré, et sur un champ nu qu'il rend au pré", () => {
    const cells = fermeClassique();
    const grille = construireGrille({ bornes, cells });
    expect(validerPose(grille, def("batiment:SILO"), { x: 0, y: 0 }).ok).toBe(true);
  });

  it("refuse hors de la propriété, en friche comme hors domaine", () => {
    const grille = construireGrille({ bornes, cells: fermeClassique() });
    const friche = validerPose(grille, def("chene"), { x: -2, y: 3 });
    expect(friche.ok).toBe(false);
    expect(friche.raison).toBe("FRICHE");
    expect(validerPose(grille, def("chene"), { x: -40, y: 3 }).raison).toBe("HORS_DOMAINE");
    // Un bâtiment qui déborde en friche est refusé, même à moitié dedans.
    expect(validerPose(grille, def("batiment:SILO"), { x: 11, y: 0 }).raison).toBe("FRICHE");
  });

  it("refuse une case occupée, et dit par quoi", () => {
    const cells = fermeClassique();
    cells[0] = { ...cells[0]!, kind: "BUILDING", buildingId: "b1", sol: "PRE" };
    cells[1] = { ...cells[1]!, kind: "CROP", crop: "WHEAT" };
    const grille = construireGrille({
      bornes,
      cells,
      amenagements: [{ id: "a1", type: "chene", originX: 5, originY: 5, rotation: 0 }],
    });
    expect(validerPose(grille, def("banc"), { x: 0, y: 0 }).raison).toBe("BATIMENT");
    expect(validerPose(grille, def("banc"), { x: 1, y: 0 }).raison).toBe("CULTURE");
    expect(validerPose(grille, def("banc"), { x: 5, y: 5 }).raison).toBe("OBJET");
  });

  it("tourne l'emprise avant de valider", () => {
    const cells = fermeClassique();
    // Un chêne en (2,0) : le hangar 3×2 à plat le touche, tourné 2×3 non.
    const grille = construireGrille({
      bornes,
      cells,
      amenagements: [{ id: "a1", type: "chene", originX: 2, originY: 0, rotation: 0 }],
    });
    const hangar = def("batiment:MACHINE_SHED");
    expect(validerPose(grille, hangar, { x: 0, y: 0, rotation: 0 }).ok).toBe(false);
    expect(validerPose(grille, hangar, { x: 0, y: 0, rotation: 1 }).ok).toBe(true);
  });

  it("laisse un objet déplacé chevaucher sa propre place", () => {
    const grille = construireGrille({
      bornes,
      cells: fermeClassique(),
      amenagements: [{ id: "a1", type: "banc", originX: 4, originY: 4, rotation: 0 }],
    });
    expect(validerPose(grille, def("banc"), { x: 4, y: 4 }).ok).toBe(false);
    expect(validerPose(grille, def("banc"), { x: 4, y: 4 }, "a1").ok).toBe(true);
  });
});

describe("le terrain", () => {
  it("peint ce qui peut l'être, saute le reste, et compte ce qui change", () => {
    const cells = fermeClassique().map((c) => ({ ...c, sol: "PRE" as const }));
    cells[2] = { ...cells[2]!, kind: "BUILDING", buildingId: "b1" };
    const grille = construireGrille({ bornes, cells });
    const v = validerPeinture(grille, def("champ"), rectangleCases({ x: 0, y: 0 }, { x: 3, y: 0 }));
    expect(v.ok).toBe(true);
    expect(v.cases.filter((c) => c.ok).length).toBe(3);
    expect(v.cout).toBe(3 * def("champ").prix);
  });

  it("ne pose pas un étang sous une culture, ni un champ dans l'eau", () => {
    const cells = fermeClassique();
    cells[0] = { ...cells[0]!, kind: "CROP", crop: "WHEAT" };
    cells[1] = { ...cells[1]!, sol: "EAU" };
    const grille = construireGrille({ bornes, cells });
    expect(validerPeinture(grille, def("etang"), [{ x: 0, y: 0 }]).raison).toBe("CULTURE");
    expect(validerPeinture(grille, def("champ"), [{ x: 1, y: 0 }]).raison).toBe("EAU");
  });

  it("fait payer le remblai quand on rend un étang au pré", () => {
    const cells = fermeClassique();
    cells[0] = { ...cells[0]!, sol: "EAU" };
    const grille = construireGrille({ bornes, cells });
    const v = validerPeinture(grille, def("pre"), [{ x: 0, y: 0 }]);
    expect(v.ok).toBe(true);
    expect(v.cout).toBe(8);
  });

  it("raccorde les chemins à leurs voisins", () => {
    const presents = new Set(["1,0", "0,1", "2,1", "1,1"]);
    // Le carrefour (1,1) touche nord, est et ouest.
    expect(masqueVoisins(presents, 1, 1)).toBe(1 | 2 | 8);
  });
});

describe("les champs", () => {
  it("se déduisent des cases de champ contiguës", () => {
    const cells: CaseSource[] = [
      { x: 0, y: 0, sol: "CHAMP", crop: "WHEAT" },
      { x: 1, y: 0, sol: "CHAMP" },
      { x: 3, y: 0, sol: "CHAMP" },
      { x: 2, y: 0, sol: "PRE" },
    ];
    const champs = champsDe(cells);
    expect(champs).toHaveLength(2);
    expect(champs[0]!.surface).toBe(2);
    expect(champs[0]!.cultures.WHEAT).toBe(1);
    expect(champs[0]!.nues).toBe(1);
  });
});

describe("les lots de terrain", () => {
  it("découpent le domaine, et seul un lot mitoyen s'achète", () => {
    const lots = lotsDuDomaine(bornes);
    expect(lots).toHaveLength(16);
    const possedees = new Set(fermeClassique().map((c) => `${c.x},${c.y}`));
    const coin = lots.find((l) => l.i === 0 && l.j === 0)!;
    const bord = lots.find((l) => l.i === 1 && l.j === 0)!;
    const centre = lots.find((l) => l.i === 1 && l.j === 1)!;
    expect(etatLot(centre, possedees).etat).toBe("POSSEDE");
    expect(etatLot(bord, possedees)).toEqual({ etat: "ACHETABLE", aAcheter: 36 });
    // Le coin ne touche la ferme que par un angle : il faudra passer par un côté.
    expect(etatLot(coin, possedees).etat).toBe("ENCLAVE");
  });

  it("coûtent de plus en plus, sans mur de niveau", () => {
    const p1 = prixLot({ cases: 36, lotsAchetes: 0 });
    const p6 = prixLot({ cases: 36, lotsAchetes: 5 });
    const p12 = prixLot({ cases: 36, lotsAchetes: 11 });
    // Le premier lot vaut un petit bâtiment, le douzième une étable et plus.
    expect(p1).toBeGreaterThan(5000);
    expect(p1).toBeLessThan(12000);
    expect(p6).toBeGreaterThan(p1 * 2);
    expect(p12).toBeGreaterThan(BUILDING_DEFS.CATTLE_BARN.cost);
    expect(niveauPourLot(1)).toBe(1);
    expect(niveauPourLot(12)).toBeLessThanOrEqual(15);
  });
});

describe("les effets du décor", () => {
  it("restent petits, lisibles et plafonnés", () => {
    const sources = {
      objets: [
        { type: "haie", originX: 0, originY: 0 },
        { type: "haie", originX: 1, originY: 0 },
        { type: "chene", originX: 0, originY: 1 },
      ],
      eaux: [{ x: 2, y: 2 }],
    };
    // Deux haies ne font pas +4 % : une seule compte, plus l'étang.
    expect(bonusAmenagementCase(sources, 1, 1)).toBeCloseTo(0.05);
    expect(bonusAmenagementCase(sources, 1, 1)).toBeLessThanOrEqual(BONUS_AMENAGEMENT_MAX);
    expect(bonusAmenagementCase(sources, 30, 30)).toBe(0);
  });

  it("font le charme d'une ferme, sans rien lui retirer", () => {
    expect(charmeDe({ cells: fermeClassique(), amenagements: [] })).toBe(0);
    expect(
      charmeDe({ cells: [{ x: 0, y: 0, sol: "EAU" }], amenagements: [{ type: "chene" }, { type: "puits" }] }),
    ).toBe(8);
  });
});
