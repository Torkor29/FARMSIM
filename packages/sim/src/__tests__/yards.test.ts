/**
 * Les aires de sortie et leurs abris.
 *
 * Ce fichier existe à cause d'un rapport de joueur : « l'enclos à cochon je le
 * construis mais je peux pas en acheter et ils sont pas dedans ». Tout était
 * pourtant correctement câblé — une courette se colle à une porcherie, et
 * c'est la porcherie qui héberge. Ce qui manquait, c'était de le **dire** :
 * la courette posée seule était acceptée, débitée, invisible sur tous les
 * écrans, et l'achat de bêtes répondait « ce bâtiment n'héberge pas
 * d'animaux » sans nommer ce qu'il fallait construire.
 *
 * Les liens sont dérivés, jamais recopiés : le jour où l'on ajoute une espèce,
 * une liste tenue à la main mentirait exactement de cette façon-là.
 */

import {
  BUILDING_DEFS,
  SHELTER_BUILDINGS,
  YARD_BUILDINGS,
  ANIMAL_PLURAL,
  barnsForYard,
  buildingWithArticle,
  isPaddockAdjacent,
  kindForBarn,
  yardTypeForBarn,
  type BuildingType,
} from "@farmsim/shared";

describe("qui héberge quoi", () => {
  it("chaque espèce a un abri, et un seul", () => {
    for (const kind of Object.keys(ANIMAL_PLURAL) as (keyof typeof ANIMAL_PLURAL)[]) {
      const abris = SHELTER_BUILDINGS.filter((t) => kindForBarn(t) === kind);
      // Sans abri, on ne peut acheter l'espèce nulle part ; avec deux, le
      // joueur ne sait pas lequel construire.
      expect(`${kind} → ${abris.join(",") || "aucun"}`).toBe(`${kind} → ${abris[0] ?? "aucun"}`);
      expect(abris).toHaveLength(1);
    }
  });

  it("un abri déclare des places, une aire de sortie n'en déclare aucune", () => {
    for (const t of SHELTER_BUILDINGS) {
      const d = BUILDING_DEFS[t];
      const places =
        (d.cattleSlots ?? 0) + (d.pigSlots ?? 0) + (d.henSlots ?? 0) + (d.sheepSlots ?? 0);
      expect(`${t} places=${places}`).toBe(`${t} places=${places}`);
      expect(places).toBeGreaterThan(0);
    }
    for (const t of YARD_BUILDINGS) {
      const d = BUILDING_DEFS[t];
      // Une courette n'héberge pas : c'est ce qui rend la règle nécessaire.
      expect(`${t} héberge=${Boolean(d.pigSlots || d.henSlots || d.cattleSlots || d.sheepSlots)}`).toBe(
        `${t} héberge=false`,
      );
    }
  });

  it("aucun bâtiment n'est à la fois abri et aire de sortie", () => {
    const deux = SHELTER_BUILDINGS.filter((t) => YARD_BUILDINGS.includes(t));
    expect(deux).toEqual([]);
  });
});

describe("l'aire de sortie sait à quoi elle se colle", () => {
  it("chaque aire de sortie a au moins un abri qui la réclame", () => {
    // Une aire dont aucun abri ne veut serait invendable et impossible à
    // poser : c'est le bâtiment fantôme qu'on vient de supprimer.
    for (const y of YARD_BUILDINGS) {
      const abris = barnsForYard(y);
      expect(`${y} ← ${abris.join(",") || "aucun"}`).toBe(`${y} ← ${abris.join(",")}`);
      expect(abris.length).toBeGreaterThan(0);
    }
  });

  it("la correspondance est exactement réciproque", () => {
    for (const t of SHELTER_BUILDINGS) {
      const y = yardTypeForBarn(t) as BuildingType;
      expect(YARD_BUILDINGS).toContain(y);
      expect(barnsForYard(y)).toContain(t);
    }
  });

  it("chaque nom cité porte son article", () => {
    // « posez d'abord porcherie » ne se lit pas. Le genre est une propriété du
    // nom, il se déclare à côté de lui.
    for (const t of [...SHELTER_BUILDINGS, ...YARD_BUILDINGS]) {
      const phrase = buildingWithArticle(t);
      expect(`${t} : ${phrase}`).toBe(`${t} : ${phrase}`);
      expect(phrase).toMatch(/^une? /);
    }
    expect(buildingWithArticle("PIGSTY")).toBe("une porcherie");
    expect(buildingWithArticle("HENHOUSE")).toBe("un poulailler");
  });
});

describe("le voisinage", () => {
  const emprise = (t: BuildingType, x: number, y: number) => ({
    originX: x,
    originY: y,
    w: BUILDING_DEFS[t].w,
    h: BUILDING_DEFS[t].h,
  });

  it("deux emprises jointives se touchent, un interstice les sépare", () => {
    const abri = emprise("PIGSTY", 0, 0); // 2×3
    // Collée sur le flanc droit.
    expect(isPaddockAdjacent(abri, emprise("PIG_YARD", 2, 0))).toBe(true);
    // Une case d'écart, et c'est le cas que le joueur croyait valide.
    expect(isPaddockAdjacent(abri, emprise("PIG_YARD", 3, 0))).toBe(false);
    // En diagonale : les coins se touchent, pas les emprises.
    expect(isPaddockAdjacent(abri, emprise("PIG_YARD", 2, 3))).toBe(false);
  });

  it("un abri sans aire de sortie n'a simplement pas de dehors", () => {
    // Ce n'est pas une erreur : c'est l'état de départ de toute étable.
    expect(isPaddockAdjacent(emprise("CATTLE_BARN", 0, 0), emprise("PADDOCK", 8, 8))).toBe(false);
  });
});
