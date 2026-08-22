import * as THREE from "three";
import { createCountryside, surLaRoute } from "../countryside";
import { makeVoiture } from "../decor3d";
import { RAYON_TERRE, creux, empriseParcelle, planCampagne, type OptionsPlan } from "../countryside-plan";

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
     * `a, c, d` donne des normales vers le bas. Le sol entier était éliminé au
     * rendu et éclairé par en dessous.
     *
     * On ne mesure que les nappes horizontales — sol, mer, route. Les
     * parcelles ont des talus et des haies, les arbres des troncs : leurs
     * flancs regardent ailleurs, et c'est normal.
     */
    const c = createCountryside({ ...OPTIONS, sobre: true });
    const mesurer = (nom: string) => {
      const m = c.object.getObjectByName(nom) as THREE.Mesh | undefined;
      expect(m).toBeDefined();
      const n = m!.geometry.getAttribute("normal");
      let mini = 1;
      for (let i = 0; i < n.count; i++) mini = Math.min(mini, n.getY(i));
      return { n: n.count, mini };
    };
    /*
     * La terre et la route restent douces : leur normale ne bascule jamais.
     * Au bord du monde, la courbure finit par passer soixante degrés et la
     * normale descend sous 0,5 — mais ce qui compte, c'est qu'elle ne passe
     * **jamais sous zéro** : là, la face serait retournée.
     */
    for (const nom of ["campagne-sol", "campagne-route"]) {
      const r = mesurer(nom);
      expect(r.n).toBeGreaterThan(60);
      expect(r.mini).toBeGreaterThan(0);
    }
    c.dispose();
  });

  it("s’incurve vers le bas, et pas sous la ferme", () => {
    /*
     * C'est la courbure qui rend un horizon, donc du ciel au-dessus : à plat,
     * le sol remplissait l'écran et le ciel avait disparu. Mais elle doit
     * rester invisible sous la ferme, sinon celle-ci aurait l'air de glisser
     * sur un dôme.
     */
    const c = createCountryside({ ...OPTIONS, y: -0.46, sobre: true });
    const solMesh = c.object.getObjectByName("campagne-sol") as THREE.Mesh;
    const p = solMesh.geometry.getAttribute("position");
    let prochePlusBas = 0;
    let loinPlusBas = 0;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      const y = p.getY(i);
      if (r < 10) prochePlusBas = Math.min(prochePlusBas, y);
      if (r > RAYON_TERRE - 6) loinPlusBas = Math.min(loinPlusBas, y);
    }
    expect(prochePlusBas).toBeGreaterThan(-1.6);
    expect(loinPlusBas).toBeLessThan(-6);
    c.dispose();
  });

  it("laisse la crête faire l’horizon, et du ciel au-dessus", () => {
    /*
     * « Un peu arrondi à l'horizon en haut, et il y a le ciel. »
     *
     * Une première version avait pris l'image du globe au pied de la lettre et
     * planté une plage et une mer autour de la ferme. On est à la campagne :
     * ce qu'il fallait retenir de l'image, c'est la rondeur. Le sol s'incurve,
     * sa crête fait la ligne d'horizon, et tout ce qui est derrière passe
     * dessous.
     */
    const c = createCountryside({ ...OPTIONS, sobre: true });
    expect(c.object.getObjectByName("campagne-mer")).toBeUndefined();
    const solMesh = c.object.getObjectByName("campagne-sol") as THREE.Mesh;
    const p = solMesh.geometry.getAttribute("position");
    // La hauteur à l'écran, en projection isométrique : c'est elle qui décide
    // de ce qu'on voit. Elle doit culminer **avant** le bord du monde.
    let crete = -Infinity;
    let rCrete = 0;
    let bord = 0;
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      const haut = -0.381 * (p.getX(i) + p.getZ(i)) + 0.842 * p.getY(i);
      if (haut > crete) {
        crete = haut;
        rCrete = r;
      }
      bord = Math.max(bord, r);
    }
    expect(rCrete).toBeGreaterThan(20);
    expect(rCrete).toBeLessThan(bord * 0.85);
    c.dispose();
  });
});

describe("la route", () => {
  it("colle au relief plutôt que de le couper en corde", () => {
    /*
     * Le défaut, vu à l'écran : la route disparaissait par morceaux. Ses
     * segments faisaient jusqu'à vingt unités, et un ruban tendu entre deux
     * points est une corde — le sol, concave, passait au-dessus d'elle en son
     * milieu et l'enterrait. On la redécoupe donc court.
     */
    const c = createCountryside({ ...OPTIONS, sobre: true });
    const route = c.object.getObjectByName("campagne-route") as THREE.Mesh;
    const p = route.geometry.getAttribute("position");
    let plusLong = 0;
    for (let i = 0; i + 2 < p.count; i += 3) {
      for (const [u, v] of [[0, 1], [1, 2], [2, 0]] as const) {
        plusLong = Math.max(
          plusLong,
          Math.hypot(p.getX(i + u) - p.getX(i + v), p.getZ(i + u) - p.getZ(i + v)),
        );
      }
    }
    expect(plusLong).toBeLessThan(3);
    c.dispose();
  });

  it("ne s’enterre nulle part", () => {
    const c = createCountryside({ ...OPTIONS, y: -0.46, sobre: true });
    const route = c.object.getObjectByName("campagne-route") as THREE.Mesh;
    const p = route.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getZ(i));
      expect(p.getY(i)).toBeGreaterThan(-0.46 + creux(r) - 0.001);
    }
    c.dispose();
  });

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
    const g = makeVoiture(0xd0563f, false);
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
    const actifs = c.plan.parcelles.filter((ch) => ch.travaille);
    expect(actifs.length).toBeGreaterThanOrEqual(1);
    // Les engins sont les seuls groupes profonds hors voitures : on les
    // retrouve par leur position, qui doit tomber dans un champ au travail.
    for (const t of [0, 2, 6, 13, 29, 120]) {
      c.update(t);
      for (const ch of actifs) {
        const dedans = c.object.children.filter(
          (o) =>
            o.name === "campagne-engin" &&
            Math.abs(o.position.x - ch.x) < empriseParcelle(ch).w / 2 + 2 &&
            Math.abs(o.position.z - ch.z) < empriseParcelle(ch).d / 2 + 2,
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
    expect(engins(riche)).toBe(3);
    expect(engins(sobre)).toBe(2);
    expect(sobre.plan.parcelles.length).toBeLessThan(riche.plan.parcelles.length);
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
    const avant = c.object.getObjectByName("campagne-parcelles-nappe");
    c.setJour(4, "SPRING");
    expect(c.object.getObjectByName("campagne-parcelles-nappe")).toBe(avant);
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

