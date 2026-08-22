import * as THREE from "three";
import { createCountryside, faireVoiture, surLaRoute } from "../countryside";
import { planCampagne, type OptionsPlan } from "../countryside-plan";

/**
 * La campagne, en volumes.
 *
 * Le plan est de l'arithmétique et se vérifie ailleurs. Ici on mesure ce qui
 * sort de Trois : que le sol existe et couvre l'horizon, qu'un engin de voisin
 * reste dans son champ au lieu de labourer le pré, qu'une voiture suit la
 * route au lieu de rouler à côté, et que tout se libère quand la vue se
 * démonte.
 *
 * Le premier défaut trouvé ici ne se voyait pas au calcul : les quadrilatères
 * du sol étaient enroulés à l'envers, normales vers le bas. Le pays entier
 * était là, dans la bonne couleur, face cachée.
 */

const OPTIONS: OptionsPlan = {
  graine: "clos-d-orme",
  ileDemiLargeur: 7,
  ileDemiProfondeur: 7,
  portail: { x: -10.5, z: 3 },
  cour: { x: -11.5, z: 2.5, w: 6, d: 9 },
};

function boite(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

describe("le sol", () => {
  it("s’étend jusqu’à la brume, tout autour", () => {
    const c = createCountryside(OPTIONS);
    const b = boite(c.object);
    // Le brouillard de la scène s'épaissit jusqu'à 66 unités : en deçà de
    // cinquante, la lisière du monde se verrait en plein cadre.
    expect(b.min.x).toBeLessThan(-50);
    expect(b.max.x).toBeGreaterThan(50);
    expect(b.min.z).toBeLessThan(-50);
    expect(b.max.z).toBeGreaterThan(50);
    c.dispose();
  });

  it("regarde vers le ciel", () => {
    /*
     * Le défaut exact, et il ne se voyait qu'à l'écran : `a, b, c` puis
     * `a, c, d` donne des normales vers le bas. Le sol et les dix-neuf champs
     * étaient éliminés au rendu et éclairés par en dessous.
     */
    /*
     * On ne mesure que les nappes que ce module fabrique — sol, champs,
     * route. Première version : `traverse` sur tout le groupe, et les deux
     * modèles de tracteur, riches de milliers de sommets tournés dans toutes
     * les directions, noyaient les quelques centaines du sol. Le test
     * échouait sur un sol pourtant correct : la prémisse était fausse, pas le
     * code.
     */
    const c = createCountryside({ ...OPTIONS, sobre: true });
    const nappes: THREE.Mesh[] = [];
    c.object.traverse((o) => {
      if (o instanceof THREE.Mesh && o.name.startsWith("campagne-")) nappes.push(o);
    });
    expect(nappes.map((m) => m.name).sort()).toEqual([
      "campagne-champs-nappe",
      "campagne-route",
      "campagne-sol",
    ]);
    let sommets = 0;
    let versLeHaut = 0;
    for (const m of nappes) {
      const n = m.geometry.getAttribute("normal");
      if (!n) continue;
      for (let i = 0; i < n.count; i++) {
        sommets++;
        if (n.getY(i) > 0.5) versLeHaut++;
      }
    }
    expect(sommets).toBeGreaterThan(1000);
    expect(versLeHaut).toBe(sommets);
    c.dispose();
  });

  it("reste plat : rien ne dépasse du plan du sol", () => {
    const c = createCountryside({ ...OPTIONS, y: -0.46 });
    for (const enfant of c.object.children) {
      if (enfant.type !== "Mesh") continue;
      const b = boite(enfant);
      expect(b.max.y).toBeLessThan(-0.3);
      expect(b.min.y).toBeGreaterThan(-0.6);
    }
    c.dispose();
  });
});

describe("la route", () => {
  it("place un point et un cap à n’importe quelle abscisse", () => {
    const plan = planCampagne(OPTIONS);
    const pts = plan.route;
    const longueurs = [0];
    for (let i = 1; i < pts.length; i++) {
      longueurs.push(
        longueurs[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z),
      );
    }
    const total = longueurs[longueurs.length - 1]!;
    for (const s of [0, total / 3, total - 0.01, total * 2.5, -total * 1.5]) {
      const p = surLaRoute(pts, longueurs, s);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
      expect(Number.isFinite(p.cap)).toBe(true);
    }
  });

  it("boucle proprement : le tour complet ramène au départ", () => {
    // Les voitures avancent sans fin sur une abscisse qui croît. Sans repli
    // propre, elles disparaîtraient au bout de la polyligne.
    const plan = planCampagne(OPTIONS);
    const pts = plan.route;
    const longueurs = [0];
    for (let i = 1; i < pts.length; i++) {
      longueurs.push(
        longueurs[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z),
      );
    }
    const total = longueurs[longueurs.length - 1]!;
    const a = surLaRoute(pts, longueurs, 7);
    const b = surLaRoute(pts, longueurs, 7 + total);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-6);
  });
});

describe("les voitures", () => {
  it("roulent sur la chaussée, pas dans le pré", () => {
    const c = createCountryside(OPTIONS);
    const voitures = c.object.children.filter((o) => o.name === "campagne-voiture");
    expect(voitures.length).toBeGreaterThanOrEqual(2);
    for (const t of [0, 3, 11, 47, 300]) {
      c.update(t);
      for (const v of voitures) {
        const d = distanceALaPolyligne(v.position.x, v.position.z, c.plan.route);
        // Une voie et demie de large : au-delà d'un mètre de l'axe, la
        // voiture est sur le bas-côté.
        expect(d).toBeLessThan(1.1);
      }
    }
    c.dispose();
  });

  it("avancent vraiment", () => {
    const c = createCountryside(OPTIONS);
    const v = c.object.children.find((o) => o.name === "campagne-voiture")!;
    c.update(0);
    const depart = v.position.clone();
    c.update(5);
    expect(depart.distanceTo(v.position)).toBeGreaterThan(4);
    c.dispose();
  });

  it("tiennent debout, roues au sol", () => {
    const g = faireVoiture(0xd0563f, false);
    const b = boite(g);
    expect(b.min.y).toBeGreaterThanOrEqual(0);
    expect(b.max.y).toBeLessThan(0.7);
    // Plus longue que large : une voiture, pas une caisse.
    expect(b.max.z - b.min.z).toBeGreaterThan(b.max.x - b.min.x);
  });
});

describe("les engins des voisins", () => {
  it("labourent leur champ et pas le pré d’à côté", () => {
    const c = createCountryside({ ...OPTIONS, sobre: false });
    const actifs = c.plan.champs.filter((ch) => ch.travaille);
    expect(actifs.length).toBeGreaterThanOrEqual(1);
    // Les engins sont les seuls groupes profonds hors voitures : on les
    // retrouve par leur position, qui doit tomber dans un champ au travail.
    for (const t of [0, 2, 6, 13, 29, 120]) {
      c.update(t);
      for (const ch of actifs) {
        const dedans = c.object.children.filter(
          (o) =>
            o.name === "campagne-engin" &&
            Math.abs(o.position.x - ch.x) < ch.w / 2 + 1.5 &&
            Math.abs(o.position.z - ch.z) < ch.d / 2 + 1.5,
        );
        expect(dedans.length).toBeGreaterThanOrEqual(1);
      }
    }
    c.dispose();
  });

  it("se réduisent à un seul en réglage sobre, jamais à zéro", () => {
    /*
     * Un modèle complet de tracteur se paie en millisecondes par image sur un
     * rasteriseur logiciel — mais le réglage sobre s'enclenche précisément sur
     * les appareils modestes, c'est-à-dire chez la plupart des joueurs. Les
     * supprimer là, c'était supprimer le voisin au travail pour presque tout
     * le monde.
     */
    const riche = createCountryside({ ...OPTIONS, sobre: false });
    const sobre = createCountryside({ ...OPTIONS, sobre: true });
    const engins = (c: { object: THREE.Object3D }) =>
      c.object.children.filter((o) => o.name === "campagne-engin").length;
    expect(engins(riche)).toBe(2);
    expect(engins(sobre)).toBe(1);
    expect(sobre.plan.champs.length).toBeLessThan(riche.plan.champs.length);
    riche.dispose();
    sobre.dispose();
  });
});

describe("le jour qui passe", () => {
  it("redessine les champs quand la date change", () => {
    const c = createCountryside(OPTIONS);
    const compte = () => {
      let n = 0;
      c.object.traverse((o) => {
        if (o instanceof THREE.Mesh) n += o.geometry.getAttribute("position")?.count ?? 0;
      });
      return n;
    };
    c.setJour(0, "SUMMER");
    const ete = compte();
    c.setJour(0, "WINTER");
    // L'hiver change les couleurs, pas le nombre de sommets : ce qu'on vérifie
    // ici, c'est que le maillage a bien été refait sans fuir.
    expect(compte()).toBe(ete);
    c.dispose();
  });

  it("ne refait rien quand rien n’a changé", () => {
    const c = createCountryside(OPTIONS);
    c.setJour(4, "SPRING");
    const avant = c.object.getObjectByName("campagne-champs-nappe");
    c.setJour(4, "SPRING");
    expect(c.object.getObjectByName("campagne-champs-nappe")).toBe(avant);
    c.dispose();
  });
});

describe("le démontage", () => {
  it("ne laisse rien derrière lui", () => {
    const c = createCountryside(OPTIONS);
    c.dispose();
    expect(c.object.children.length).toBe(0);
  });
});

/** Distance d'un point à une polyligne, pour les assertions ci-dessus. */
function distanceALaPolyligne(
  x: number,
  z: number,
  pts: { x: number; z: number }[],
): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const l2 = dx * dx + dz * dz;
    const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - p.x) * dx + (z - p.z) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (p.x + t * dx), z - (p.z + t * dz)));
  }
  return best;
}

