import {
  COURSE,
  bornesDeplacement,
  elastique,
  horsBornes,
  panPourGarderLePoint,
  pasRetour,
  ramener,
  retenir,
} from "../cadrage";

/**
 * Le cadrage de la vue.
 *
 * Le défaut mesuré : le déplacement était borné à `viewSpan × 0,9`, un
 * multiple de la taille de **l'île** — hérité de l'époque où il n'y avait rien
 * autour d'elle. Depuis qu'il y a un pays, la première couronne de parcelles
 * était atteignable et la deuxième non ; en descendant on cognait le mur avant
 * d'avoir vu le champ d'en bas.
 *
 * Ce fichier tient deux exigences : la borne vient du **monde rendu**, et elle
 * ne s'annonce pas par un arrêt franc.
 */

/** Une trame comme celle du jeu : parcelle de 14,12, chemin de 2,4. */
const EMPRISE = 14.12;
const PAS = EMPRISE + 2.4;

/** L'île, la cour, et les voisins de la trame. */
function mondeRendu() {
  const boites = [
    { x: 0, z: 0, w: EMPRISE, d: EMPRISE },
    { x: -9.8, z: 4, w: 9.5, d: 6 },
  ];
  for (let col = -2; col <= 2; col++) {
    for (let rang = -2; rang <= 2; rang++) {
      if (col + rang < 0 || (col === 0 && rang === 0)) continue;
      boites.push({ x: col * PAS, z: rang * PAS, w: EMPRISE, d: EMPRISE });
    }
  }
  return boites;
}

describe("les bornes viennent du monde, pas de l’île", () => {
  it("englobent toutes les parcelles rendues", () => {
    const boites = mondeRendu();
    const b = bornesDeplacement(boites, EMPRISE / 2);
    for (const p of boites) {
      expect(b.xMin).toBeLessThanOrEqual(p.x);
      expect(b.xMax).toBeGreaterThanOrEqual(p.x);
      expect(b.zMin).toBeLessThanOrEqual(p.z);
      expect(b.zMax).toBeGreaterThanOrEqual(p.z);
    }
  });

  it("laissent descendre jusqu’à la dernière parcelle du bas", () => {
    /*
     * Le reproche exact — « la vision bloque quand on descend ». L'ancienne
     * borne valait une vingtaine d'unités ; la deuxième couronne est à
     * trente-trois, et la vue s'arrêtait donc avant elle.
     */
    const b = bornesDeplacement(mondeRendu(), EMPRISE / 2);
    const derniere = 2 * PAS;
    expect(b.zMax).toBeGreaterThanOrEqual(derniere);
    expect(b.xMax).toBeGreaterThanOrEqual(derniere);
    // Et l'ancienne règle ne suffisait pas : c'est bien elle qu'on remplace.
    const ancienne = 22.9 * 0.9;
    expect(b.zMax).toBeGreaterThan(ancienne);
  });

  it("laissent centrer la parcelle la plus éloignée, pas seulement l’effleurer", () => {
    // Sans marge, on amènerait la dernière parcelle au bord du cadre sans
    // jamais pouvoir la regarder en face.
    const b = bornesDeplacement(mondeRendu(), EMPRISE / 2);
    expect(b.zMax).toBeGreaterThan(2 * PAS + EMPRISE / 4);
  });

  it("ne bornent rien quand il n’y a rien à rendre", () => {
    expect(bornesDeplacement([], 5)).toEqual({ xMin: 0, xMax: 0, zMin: 0, zMax: 0 });
  });
});

describe("la butée cède, puis rappelle", () => {
  it("ne change rien dans les bornes", () => {
    for (const v of [-10, -0.001, 0, 4.5, 10]) {
      expect(elastique(v, -10, 10)).toBe(v);
    }
  });

  it("laisse dépasser, de moins en moins", () => {
    const d = (v: number) => elastique(v, -10, 10);
    expect(d(11)).toBeGreaterThan(10);
    expect(d(14)).toBeGreaterThan(d(11));
    expect(d(40)).toBeGreaterThan(d(14));
    // À demande égale — une unité de doigt de plus — le gain fond à mesure
    // qu'on tire. C'est ça, la résistance.
    expect(d(21) - d(20)).toBeLessThan((d(11) - d(10)) / 2);
    expect(d(41) - d(40)).toBeLessThan((d(21) - d(20)) / 2);
  });

  it("ne laisse jamais s’échapper, si fort qu’on tire", () => {
    // C'est ce qui distingue une butée d'une absence de butée : le dépassement
    // tend vers la course sans jamais l'atteindre.
    for (const v of [30, 300, 3000, 1e9]) {
      expect(elastique(v, -10, 10)).toBeLessThan(10 + COURSE);
      expect(elastique(-v, -10, 10)).toBeGreaterThan(-10 - COURSE);
    }
  });

  it("est symétrique", () => {
    expect(elastique(17, -10, 10)).toBeCloseTo(-elastique(-17, -10, 10), 9);
  });

  it("retombe sur un simple écrêtage si on retire la course", () => {
    expect(elastique(40, -10, 10, 0)).toBe(10);
    expect(elastique(-40, -10, 10, 0)).toBe(-10);
  });
});

describe("la demande brute reste bridée", () => {
  it("ne garde pas en mémoire un glissement de mille unités", () => {
    /*
     * La compression a lieu à l'affichage : la demande, elle, s'accumule. Sans
     * bride, un glissement long stocke des centaines d'unités invisibles — et
     * au relâchement le retour part de si loin qu'il retraverse la campagne.
     */
    expect(retenir(1e6, -10, 10)).toBe(10 + 2 * COURSE);
    expect(retenir(-1e6, -10, 10)).toBe(-10 - 2 * COURSE);
    expect(retenir(3, -10, 10)).toBe(3);
  });
});

describe("le retour au bord", () => {
  it("ramène, et finit par accrocher la cible", () => {
    let v = 24;
    for (let i = 0; i < 400 && v !== 10; i++) v = pasRetour(v, 10, 16);
    expect(v).toBe(10);
  });

  it("va à la même vitesse quelle que soit la cadence de l’écran", () => {
    /*
     * Un retour en « dix pour cent par image » va deux fois plus vite à cent
     * vingt hertz qu'à soixante. Le jeu tourne sur les deux, et le geste doit
     * y durer le même temps.
     */
    const apres = (n: number, dt: number) => {
      let v = 30;
      for (let i = 0; i < n; i++) v = pasRetour(v, 0, dt);
      return v;
    };
    expect(apres(30, 16.7)).toBeCloseTo(apres(60, 8.35), 4);
  });

  it("ne dépasse jamais la cible", () => {
    let v = -40;
    for (let i = 0; i < 200; i++) {
      const suivant = pasRetour(v, 0, 16);
      expect(suivant).toBeLessThanOrEqual(0);
      v = suivant;
    }
  });

  it("ne bouge pas quand il n’y a rien à corriger", () => {
    expect(pasRetour(5, 5, 16)).toBe(5);
    expect(pasRetour(5, 5, 0)).toBe(5);
  });
});

describe("savoir si la vue est dehors", () => {
  const b = { xMin: -20, xMax: 30, zMin: -12, zMax: 45 };

  it("dit non, et ne propose rien, quand on est dedans", () => {
    const r = horsBornes(5, 5, b);
    expect(r.dehors).toBe(false);
    expect(r.cibleX).toBe(5);
    expect(r.cibleZ).toBe(5);
  });

  it("dit oui et donne le point le plus proche", () => {
    const r = horsBornes(60, -30, b);
    expect(r.dehors).toBe(true);
    expect(r.cibleX).toBe(30);
    expect(r.cibleZ).toBe(-12);
  });

  it("ne corrige que l’axe fautif", () => {
    const r = horsBornes(2, 90, b);
    expect(r.cibleX).toBe(2);
    expect(r.cibleZ).toBe(45);
  });
});

describe("garder le point sous le zoom", () => {
  it("décale le pan de ce que le sol a glissé à l’écran", () => {
    // Avant le zoom, le doigt visait (10, 4). Après, ce pixel regarde (6, 2) :
    // le champ a glissé. On pousse le pan de la différence, et (10, 4)
    // revient sous le doigt.
    const suivant = panPourGarderLePoint({ x: 3, z: 1 }, { x: 10, z: 4 }, { x: 6, z: 2 });
    expect(suivant).toEqual({ x: 7, z: 3 });
  });

  it("ne bouge pas si le pixel n’a pas changé de cible", () => {
    const p = { x: 2, z: -1 };
    expect(panPourGarderLePoint({ x: 5, z: 8 }, p, p)).toEqual({ x: 5, z: 8 });
  });
});

describe("ramener", () => {
  it("écrête des deux côtés", () => {
    expect(ramener(-5, 0, 10)).toBe(0);
    expect(ramener(15, 0, 10)).toBe(10);
    expect(ramener(7, 0, 10)).toBe(7);
  });
});
