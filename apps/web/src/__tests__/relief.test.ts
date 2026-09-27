import {
  accesEngins,
  bonusAmenagementCase,
  construireGrille,
  coteaux,
  defConstruction,
  forceHydraulique,
  hydrologie,
  rampeValide,
  validerPeinture,
  validerPose,
  type CaseRelief,
} from "@farmsim/shared";

/**
 * Le relief et l'eau qui coule : ce qu'ils changent au jeu.
 */
type C = CaseRelief & { sol: "CHAMP" | "PRE" | "EAU"; niveau: number };
function ferme(w: number, h: number, f: (x: number, y: number) => Partial<C> = () => ({})): C[] {
  const out: C[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push({ x, y, sol: "CHAMP", niveau: 0, ...f(x, y) });
  return out;
}
const bornes = { minX: -1, minY: -1, maxX: 12, maxY: 12 };

describe("l'accès des engins", () => {
  it("arrive par le bord, en plaine, et s'arrête à l'eau — sauf sur un pont", () => {
    // Un fossé nord-sud en x = 4 coupe la ferme ; l'est n'a pas de bord libre ?
    // Si : l'est touche le dehors. On l'enferme donc dans un lac en anneau.
    const cells = ferme(9, 9, (x, y) => {
      const bord = x === 2 || x === 6 || y === 2 || y === 6;
      const dedans = x > 2 && x < 6 && y > 2 && y < 6;
      return bord && x >= 2 && x <= 6 && y >= 2 && y <= 6 ? { sol: "EAU" } : dedans ? {} : {};
    });
    const sans = accesEngins(cells, []);
    expect(sans.has("0,0")).toBe(true);
    expect(sans.has("4,4")).toBe(false); // l'île au milieu du lac
    // Un pont en (2, 4), axe est-ouest : l'île est rejointe.
    const avec = accesEngins(cells, [{ type: "pont", originX: 2, originY: 4, rotation: 0 }]);
    expect(avec.has("4,4")).toBe(true);
    // Le même pont tourné nord-sud ne mène nulle part.
    const travers = accesEngins(cells, [{ type: "pont", originX: 2, originY: 4, rotation: 1 }]);
    expect(travers.has("4,4")).toBe(false);
  });

  it("ne monte sur une terrasse que par une rampe tournée vers le haut", () => {
    const cells = ferme(8, 8, (x, y) => (x >= 3 && x <= 5 && y >= 3 && y <= 5 ? { niveau: 1 } : {}));
    expect(accesEngins(cells, []).has("4,4")).toBe(false);
    expect(rampeValide(cells, 4, 2, 2)).toBe(true); // au nord de la terrasse, montant vers le sud
    expect(rampeValide(cells, 4, 2, 0)).toBe(false); // tournée à l'envers
    expect(accesEngins(cells, [{ type: "rampe", originX: 4, originY: 2, rotation: 2 }]).has("4,4")).toBe(true);
    expect(accesEngins(cells, [{ type: "rampe", originX: 4, originY: 2, rotation: 0 }]).has("4,4")).toBe(false);
  });

  it("une ferme toute plate est entièrement accessible, comme avant", () => {
    const cells = ferme(12, 12);
    expect(accesEngins(cells, []).size).toBe(144);
  });
});

describe("l'eau qui coule", () => {
  // Un bassin haut (niveau 1) de x 0 à 2 se déverse dans un lac bas en x 3 à 5.
  const cells = ferme(8, 3, (x, y) =>
    y === 1 && x <= 5 ? { sol: "EAU", niveau: x <= 2 ? 1 : 0 } : x <= 2 ? { niveau: 1 } : {},
  );
  const h = hydrologie(cells);

  it("tombe en cascade entre deux niveaux, et coule vers la chute", () => {
    expect(h.chutes).toEqual([{ x: 2, y: 1, dx: 1, dy: 0, haut: 1, bas: 0 }]);
    expect(h.courant.get("0,1")).toEqual([1, 0]);
    expect(h.courant.get("2,1")).toEqual([1, 0]);
    expect(h.courante.has("0,1")).toBe(true);
    // En bas, le lac dort — sauf au pied de la chute.
    expect(h.courante.has("3,1")).toBe(true);
    expect(h.courante.has("5,1")).toBe(false);
  });

  it("irrigue mieux qu'un lac, et fait tourner le moulin plus vite", () => {
    const eaux = cells.filter((c) => c.sol === "EAU").map((c) => ({ x: c.x, y: c.y, courante: h.courante.has(`${c.x},${c.y}`) }));
    const pres = bonusAmenagementCase({ objets: [], eaux }, 1, 0);
    expect(pres).toBeCloseTo(0.07, 5); // étang +3 % et rivière +4 %
    expect(forceHydraulique(cells, { originX: 6, originY: 0, w: 1, h: 1 }, h)).toBe(1);
    expect(forceHydraulique(cells, { originX: 0, originY: 2, w: 1, h: 1 }, h)).toBe(2);
    expect(forceHydraulique(cells, { originX: 3, originY: 2, w: 1, h: 1 }, h)).toBe(3);
  });
});

describe("le relief dans les règles de pose", () => {
  const cells = ferme(6, 6, (x) => (x >= 3 ? { niveau: 1, sol: "PRE" } : { sol: "PRE" }));
  const grille = construireGrille({ bornes, cells });

  it("se surélève jusqu'au sommet et s'abaisse jusqu'à la plaine — dans la campagne seulement", () => {
    const campagne = construireGrille({ bornes, cells, zone: "CAMPAGNE" });
    const monter = validerPeinture(campagne, defConstruction("surelever")!, [{ x: 0, y: 0 }, { x: 4, y: 0 }]);
    expect(monter.cases.every((c) => c.ok)).toBe(true);
    const descendre = validerPeinture(campagne, defConstruction("abaisser")!, [{ x: 0, y: 0 }]);
    expect(descendre.ok).toBe(false);
    expect(descendre.raison).toBe("PLAINE");
    // Sur la ferme, le relief se refuse.
    expect(validerPeinture(grille, defConstruction("surelever")!, [{ x: 0, y: 0 }]).raison).toBe("CAMPAGNE");
    // Et un champ ne se trace pas dans la campagne.
    expect(validerPeinture(campagne, defConstruction("champ")!, [{ x: 0, y: 0 }]).raison).toBe("SUR_LA_FERME");
  });

  it("pose un bâtiment en plaine seulement, et une rampe contre sa falaise", () => {
    expect(validerPose(grille, defConstruction("batiment:SILO")!, { x: 3, y: 0 }).raison).toBe("RELIEF");
    expect(validerPose(grille, defConstruction("rampe")!, { x: 2, y: 2, rotation: 1 }).ok).toBe(true);
    expect(validerPose(grille, defConstruction("rampe")!, { x: 2, y: 2, rotation: 3 }).raison).toBe("RAMPE");
    expect(validerPose(grille, defConstruction("pont")!, { x: 1, y: 1 }).ok).toBe(false);
  });

  it("fait d'une terrasse exposée au sud un coteau", () => {
    const t = ferme(4, 4, (_x, y) => (y <= 1 ? { niveau: 1 } : {}));
    const c = coteaux(t);
    expect(c.has("0,1")).toBe(true);
    expect(c.has("0,0")).toBe(false);
    expect(bonusAmenagementCase({ objets: [], eaux: [], coteaux: [{ x: 0, y: 1 }] }, 0, 1)).toBeCloseTo(0.02, 5);
  });
});
