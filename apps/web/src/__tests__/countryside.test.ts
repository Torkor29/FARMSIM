import * as THREE from "three";
import {
  CASE_EP,
  DALLE_HAUT,
  DEMI_TOUR,
  createCountryside,
  coteTravail,
  cycleTravail,
  graduation,
  marcheVoiture,
  surLaRoute,
} from "../countryside";
import { makeVoiture } from "../decor3d";
import {
  empriseParcelle,
  horizonPour,
  planCampagne,
  versEcranBas,
  versEcranDroite,
  type OptionsPlan,
} from "../countryside-plan";

/**
 * La campagne, en volumes.
 *
 * Le plan est de l'arithmétique et se vérifie ailleurs. Ici on mesure ce qui
 * sort de Trois : que le sol existe et regarde le ciel, qu'il s'arrête sur une
 * ligne droite **à l'écran** pour laisser une bande de ciel, qu'un engin de
 * voisin reste dans son champ au lieu de labourer le pré, et qu'une voiture
 * passe devant la ferme au lieu de tourner hors cadre.
 *
 * Le premier défaut trouvé ici ne se voyait pas au calcul : les quadrilatères
 * du sol étaient enroulés à l'envers, normales vers le bas. Le pays entier
 * était là, dans la bonne couleur, face cachée — et l'on voyait le ciel entre
 * les parcelles.
 */

const EMPRISE = 14.12;

const OPTIONS: OptionsPlan = {
  graine: "clos-d-orme",
  emprise: EMPRISE,
  cour: { x: -11.5, z: 2.5, w: 6, d: 9 },
};

function boite(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

/** La hauteur d'un point à l'écran, en projection isométrique. */
function hautEcran(x: number, y: number, z: number): number {
  return -0.381 * (x + z) + 0.842 * y;
}

describe("le sol", () => {
  it("dépasse le cadre de tous les côtés sauf en amont", () => {
    /*
     * Trois bords sur quatre doivent rester hors champ au zoom le plus large,
     * sans quoi on verrait la tranche du monde. Le quatrième — l'amont — est
     * précisément celui qu'on veut voir : c'est l'horizon.
     */
    const c = createCountryside(OPTIONS);
    const b = boite(c.object);
    expect(b.min.x).toBeLessThan(-60);
    expect(b.max.x).toBeGreaterThan(60);
    expect(b.min.z).toBeLessThan(-60);
    expect(b.max.z).toBeGreaterThan(60);
    c.dispose();
  });

  it("regarde vers le ciel", () => {
    /*
     * Le défaut exact, et il ne se voyait qu'à l'écran : `a, b, c` puis
     * `a, c, d` donne des normales vers le bas. Ici il s'était reproduit d'une
     * autre façon — le passage du repère de l'écran (u, v) à celui du monde
     * renverse l'orientation, si bien qu'un quadrilatère écrit dans le bon
     * ordre en sortait retourné.
     *
     * On ne mesure que les nappes horizontales — sol, route. Les parcelles ont
     * des talus et des haies, les arbres des troncs : leurs flancs regardent
     * ailleurs, et c'est normal.
     */
    const c = createCountryside({ ...OPTIONS, sobre: true });
    for (const nom of ["campagne-sol", "campagne-route"]) {
      const m = c.object.getObjectByName(nom) as THREE.Mesh | undefined;
      expect(m).toBeDefined();
      const n = m!.geometry.getAttribute("normal");
      expect(n.count).toBeGreaterThan(60);
      let mini = 1;
      for (let i = 0; i < n.count; i++) mini = Math.min(mini, n.getY(i));
      expect(mini).toBeGreaterThan(0.99);
    }
    c.dispose();
  });

  it("est plat : plus de globe", () => {
    // La vue est isométrique ; un sol bombé y fait une bosse et non un globe.
    const c = createCountryside({ ...OPTIONS, y: -0.46, sobre: true });
    const p = (c.object.getObjectByName("campagne-sol") as THREE.Mesh).geometry.getAttribute(
      "position",
    );
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeCloseTo(-0.46, 6);
    c.dispose();
  });

  it("s’arrête sur une horizontale à l’écran, et laisse du ciel au-dessus", () => {
    /*
     * Le cœur de la refonte. Une emprise rectangulaire en x/z donnait un coin
     * de terre en haut d'un côté du cadre et du ciel de l'autre : le monde
     * s'arrêtait en diagonale. Le sol est un losange, donc un rectangle à
     * l'écran, et son bord amont est droit.
     *
     * Le seuil : la lisière doit rester sous le haut du cadre, qui tient à
     * dix-huit unités monde au cadrage par défaut.
     */
    const c = createCountryside({ ...OPTIONS, sobre: true });
    const p = (c.object.getObjectByName("campagne-sol") as THREE.Mesh).geometry.getAttribute(
      "position",
    );
    let hautMax = -Infinity;
    let vMin = Infinity;
    let vMax = -Infinity;
    for (let i = 0; i < p.count; i++) {
      hautMax = Math.max(hautMax, hautEcran(p.getX(i), p.getY(i), p.getZ(i)));
    }
    /*
     * Le bord amont est une ligne de `u` constant, et le sol est plat : tous
     * ses sommets sont donc exactement à la même hauteur d'écran, et ils
     * couvrent toute la largeur. C'est cette seconde moitié qui compte — une
     * emprise rectangulaire en x/z aurait bien un point le plus haut, mais un
     * seul : le coin.
     */
    let auBord = 0;
    for (let i = 0; i < p.count; i++) {
      if (hautEcran(p.getX(i), p.getY(i), p.getZ(i)) < hautMax - 1e-4) continue;
      auBord++;
      const v = versEcranDroite(p.getX(i), p.getZ(i));
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
      expect(versEcranBas(p.getX(i), p.getZ(i))).toBeCloseTo(c.plan.sol.uMin, 3);
    }
    expect(auBord).toBeGreaterThan(20);
    expect(vMax - vMin).toBeGreaterThan(150);
    // Et cette ligne reste dans le cadre, ciel compris.
    expect(hautMax).toBeGreaterThan(8);
    expect(hautMax).toBeLessThan(15);
    c.dispose();
  });

  it("gradue sa maille : fine sous la ferme, large au loin", () => {
    /*
     * Le sol s'étend à cent cinquante unités pour ne jamais montrer son bord.
     * Pavé régulier à quatre unités, il ferait des dizaines de milliers de
     * quadrilatères pour du pré que personne ne regarde.
     */
    const g = graduation(-30, 150, 4.2);
    expect(g[0]).toBe(-30);
    expect(g[g.length - 1]).toBe(150);
    expect(g).toContain(0);
    for (let i = 1; i < g.length; i++) expect(g[i]!).toBeGreaterThan(g[i - 1]!);
    const pres = g.filter((x) => Math.abs(x) < 12);
    const loin = g.filter((x) => x > 100);
    expect(pres.length).toBeGreaterThan(loin.length);
    expect(g.length).toBeLessThan(50);
  });
});

describe("la route", () => {
  it("longe la cour sans la couper", () => {
    /*
     * « La route coupe le parking » : elle se calait sur l'île sans regarder
     * la cour, qui déborde à l'ouest. Elle suit maintenant un couloir de la
     * trame, et un couloir est vide par construction.
     */
    const plan = planCampagne(OPTIONS);
    const cour = OPTIONS.cour;
    expect(plan.routeZ).toBeGreaterThan(cour.z + cour.d / 2);
    for (const p of plan.route) {
      expect(Math.abs(p.z - cour.z) - cour.d / 2).toBeGreaterThan(0);
    }
    // Et elle ne traverse aucune parcelle voisine.
    for (const p of plan.parcelles) {
      expect(Math.abs(p.z - plan.routeZ)).toBeGreaterThan(plan.emprise / 2);
    }
  });

  it("part de la cour, sans détour", () => {
    // La desserte relie la sortie de la cour au chemin : deux points, tout
    // droit. Une amorce qui longe l'île avant de descendre se lit comme une
    // erreur de tracé.
    const plan = planCampagne(OPTIONS);
    expect(plan.desserte).toHaveLength(2);
    expect(plan.desserte[0]!.x).toBeCloseTo(OPTIONS.cour.x, 6);
    expect(plan.desserte[1]!.x).toBeCloseTo(OPTIONS.cour.x, 6);
    expect(plan.desserte[1]!.z).toBeCloseTo(plan.routeZ, 6);
  });

  it("ne s’arrête jamais dans le cadre", () => {
    // Un ruban qui se termine en plein pré se voit ; la route va donc d'un
    // bord du sol à l'autre.
    const plan = planCampagne(OPTIONS);
    for (const p of plan.route) {
      const dedans =
        Math.abs(versEcranDroite(p.x, p.z)) < plan.sol.vMax - 0.01 &&
        versEcranBas(p.x, p.z) > plan.sol.uMin + 0.01 &&
        versEcranBas(p.x, p.z) < plan.sol.uMax - 0.01;
      expect(dedans).toBe(false);
    }
  });

  it("place un point et un cap à n’importe quelle abscisse", () => {
    const plan = planCampagne(OPTIONS);
    const pts = plan.route;
    const longueurs = [0, Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.z - pts[0]!.z)];
    const total = longueurs[1]!;
    for (const s of [0, total / 3, total - 0.01, total * 2.5, -total * 1.5]) {
      const p = surLaRoute(pts, longueurs, s);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.z)).toBe(true);
      expect(Number.isFinite(p.cap)).toBe(true);
    }
  });

  it("boucle proprement : le tour complet ramène au départ", () => {
    const plan = planCampagne(OPTIONS);
    const pts = plan.route;
    const total = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.z - pts[0]!.z);
    const longueurs = [0, total];
    const a = surLaRoute(pts, longueurs, 7);
    const b = surLaRoute(pts, longueurs, 7 + total);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1e-6);
  });
});

describe("les voitures", () => {
  /** Les voitures visibles à un instant donné, avec leur position. */
  function passage(c: ReturnType<typeof createCountryside>, t: number): THREE.Object3D[] {
    c.update(t);
    return c.object.children.filter((o) => o.name === "campagne-voiture" && o.visible);
  }

  it("roulent sur la chaussée, pas dans le pré", () => {
    const c = createCountryside(OPTIONS);
    for (let t = 0; t < 200; t += 1.7) {
      for (const v of passage(c, t)) {
        expect(Math.abs(v.position.z - c.plan.routeZ)).toBeLessThan(1.1);
      }
    }
    c.dispose();
  });

  it("passent devant la ferme, et non au bout du monde", () => {
    /*
     * Défaut mesuré en jeu : la route traverse tout le sol — cent soixante
     * unités — et les voitures réparties dessus passaient l'essentiel de leur
     * temps hors cadre. Six captures d'affilée n'en montraient aucune. Elles
     * bouclent maintenant sur la portion qui peut être à l'écran.
     */
    const c = createCountryside(OPTIONS);
    let devant = 0;
    for (let t = 0; t < 400; t += 1.5) {
      if (passage(c, t).some((v) => Math.abs(v.position.x) < 25)) devant++;
    }
    expect(devant).toBeGreaterThan(60);
    c.dispose();
  });

  it("laissent la route vide la moitié du temps", () => {
    /*
     * « Moins de voitures doivent passer sur la route. » Cinq voitures en file
     * continue faisaient un périphérique. Une départementale de commune est
     * vide la plupart du temps, et c'est le vide qui rend le passage
     * remarquable — le nombre de véhicules compte moins que le silence entre
     * deux.
     */
    const c = createCountryside(OPTIONS);
    const total = c.object.children.filter((o) => o.name === "campagne-voiture").length;
    expect(total).toBe(2);

    let vide = 0;
    let pas = 0;
    for (let t = 0; t < 600; t += 1) {
      pas++;
      if (passage(c, t).length === 0) vide++;
    }
    expect(vide / pas).toBeGreaterThan(0.25);
    // Mais pas déserte non plus : une route où il ne passe jamais rien ne vit
    // pas davantage qu'une file ininterrompue.
    expect(vide / pas).toBeLessThan(0.8);
    c.dispose();
  });

  it("ne restent jamais à l’arrêt sur la chaussée", () => {
    // Entre deux passages, la voiture n'attend pas au bout de la fenêtre :
    // elle n'est plus là. Garée, elle se verrait au dézoom.
    const c = createCountryside(OPTIONS);
    const suivi = new Map<THREE.Object3D, THREE.Vector3>();
    for (let t = 0; t < 300; t += 0.5) {
      for (const v of passage(c, t)) {
        const avant = suivi.get(v);
        if (avant) expect(avant.distanceTo(v.position)).toBeGreaterThan(0.2);
        suivi.set(v, v.position.clone());
      }
      for (const v of c.object.children) {
        if (v.name === "campagne-voiture" && !v.visible) suivi.delete(v);
      }
    }
    c.dispose();
  });

  it("ralentissent devant la ferme et reprennent après", () => {
    /*
     * La rampe linéaire est ce qui faisait « mauvais et pas beau », bien plus
     * que le nombre de polygones : une voiture qui traverse le cadre à vitesse
     * rigoureusement constante se lit comme un objet tiré par une ficelle.
     */
    const marche = marcheVoiture(0.5);
    const pas = 0.02;
    const vitesse = (q: number) => (marche(q + pas) - marche(q)) / pas;
    expect(vitesse(0.49)).toBeLessThan(vitesse(0.05) * 0.8);
    expect(vitesse(0.49)).toBeLessThan(vitesse(0.93) * 0.8);
    // Et jamais d'arrêt ni de marche arrière : la marche reste croissante.
    let precedent = -1;
    for (let q = 0; q <= 1.0001; q += 0.01) {
      const x = marche(q);
      expect(x).toBeGreaterThan(precedent);
      precedent = x;
    }
    expect(marche(0)).toBeCloseTo(0, 6);
    expect(marche(1)).toBeCloseTo(1, 6);
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
    const engins = c.object.children.filter((o) => o.name === "campagne-engin");
    expect(engins.length).toBeGreaterThanOrEqual(1);
    for (const t of [0, 2, 6, 13, 29, 120]) {
      c.update(t);
      for (const e of engins) {
        // Chaque engin doit tomber dans **une** parcelle au travail : c'est ce
        // qui manquait quand ils faisaient des allers-retours d'un bout à
        // l'autre de la campagne.
        const chez = actifs.filter((ch) => {
          const b = empriseParcelle(ch, c.plan.emprise);
          return (
            Math.abs(e.position.x - b.x) < b.w / 2 && Math.abs(e.position.z - b.z) < b.d / 2
          );
        });
        expect(chez).toHaveLength(1);
      }
    }
    c.dispose();
  });

  it("tournent en fourrière plutôt que de repartir en arrière", () => {
    /*
     * Le défaut, et c'est lui que « les animations sont mauvaises » visait :
     * l'engin faisait un aller-retour sur une onde triangulaire. Il arrivait
     * au bout du champ, s'arrêtait net, et repartait sur exactement la même
     * ligne, outil posé. Un tracteur ne fait pas ça — il relève, il tourne, il
     * redescend sur la ligne d'à côté.
     */
    const o = { cote: coteTravail(EMPRISE), rangs: 6, largeur: 1.8, vitesse: 1.8 };
    const tPasse = o.cote / o.vitesse;

    // En passe : outil posé, cap tenu, pas de braquage.
    const enPasse = cycleTravail(tPasse * 0.5, o);
    expect(enPasse.travaille).toBe(true);
    expect(enPasse.braquage).toBe(0);
    expect(Math.abs(enPasse.cap)).toBeCloseTo(Math.PI / 2, 6);

    // En fourrière : outil relevé, et l'on braque.
    const enTour = cycleTravail(tPasse + DEMI_TOUR / 2, o);
    expect(enTour.travaille).toBe(false);
    expect(Math.abs(enTour.braquage)).toBeGreaterThan(0.5);
  });

  it("changent de ligne à chaque passe, sans jamais reprendre la même", () => {
    const o = { cote: coteTravail(EMPRISE), rangs: 6, largeur: 1.8, vitesse: 1.8 };
    const parPasse = o.cote / o.vitesse + DEMI_TOUR;
    const lignes = new Set<string>();
    for (let k = 0; k < o.rangs; k++) {
      lignes.add(cycleTravail(k * parPasse + 0.5, o).z.toFixed(3));
    }
    expect(lignes.size).toBe(o.rangs);
  });

  it("repartent dans l’autre sens après le demi-tour", () => {
    // Sans quoi il y aurait un retour à vide au bout de chaque ligne, ce qui
    // n'est pas ainsi qu'on travaille un champ.
    const o = { cote: coteTravail(EMPRISE), rangs: 6, largeur: 1.8, vitesse: 1.8 };
    const parPasse = o.cote / o.vitesse + DEMI_TOUR;
    expect(cycleTravail(0.5, o).cap).toBeCloseTo(Math.PI / 2, 6);
    expect(cycleTravail(parPasse + 0.5, o).cap).toBeCloseTo(-Math.PI / 2, 6);
  });

  it("ne sautent jamais : la trajectoire reste continue", () => {
    /*
     * C'est le vrai test du demi-tour. Une manœuvre écrite de travers se voit
     * comme une téléportation d'un bout du champ à l'autre — et c'est
     * exactement ce que faisait l'onde triangulaire au changement de rang.
     */
    const o = { cote: coteTravail(EMPRISE), rangs: 6, largeur: 1.8, vitesse: 1.8 };
    const dt = 0.05;
    let avant = cycleTravail(0, o);
    for (let t = dt; t < 200; t += dt) {
      const p = cycleTravail(t, o);
      const bond = Math.hypot(p.x - avant.x, p.z - avant.z);
      // À deux unités par seconde, un pas de cinquante millisecondes fait dix
      // centimètres. Le double laisse la place au demi-tour, pas à un saut.
      expect(bond).toBeLessThan(0.25);
      avant = p;
    }
  });

  it("ne sortent jamais de leur parcelle", () => {
    /*
     * La borne qui compte. Les manœuvres débordent du bout des passes — la
     * fourrière, et un peu plus quand l'engin s'écarte pour se réaligner —
     * mais jamais de la parcelle : un tracteur de voisin qui traverse le champ
     * d'à côté ou le chemin défait toute la trame.
     */
    const o = { cote: coteTravail(EMPRISE), rangs: 6, largeur: 1.8, vitesse: 1.8 };
    const demi = EMPRISE / 2;
    for (let t = 0; t < 400; t += 0.11) {
      const p = cycleTravail(t, o);
      expect(Math.abs(p.x)).toBeLessThan(demi);
      expect(Math.abs(p.z)).toBeLessThan(demi);
    }
  });

  it("relèvent l’outil dès qu’ils quittent la ligne", () => {
    // Un outil qui reste posé pendant la manœuvre laboure la fourrière en
    // travers, et le demi-tour ne se lit plus comme une manœuvre.
    const o = { cote: coteTravail(EMPRISE), rangs: 6, largeur: 1.8, vitesse: 1.8 };
    for (let t = 0; t < 400; t += 0.11) {
      const p = cycleTravail(t, o);
      if (!p.travaille) continue;
      // En travail, il est exactement sur une ligne de la trame.
      const ligne = (p.z + ((o.rangs - 1) * o.largeur) / 2) / o.largeur;
      expect(Math.abs(ligne - Math.round(ligne))).toBeLessThan(1e-6);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(o.cote / 2 + 1e-9);
    }
  });

  it("avancent toujours, et bouclent proprement", () => {
    const o = { cote: coteTravail(EMPRISE), rangs: 6, largeur: 1.8, vitesse: 1.8 };
    const parPasse = o.cote / o.vitesse + DEMI_TOUR;
    let precedent = -1;
    for (let t = 0; t < o.rangs * parPasse - 0.01; t += 0.3) {
      const a = cycleTravail(t, o).avancement;
      expect(a).toBeGreaterThanOrEqual(precedent - 1e-9);
      expect(a).toBeLessThanOrEqual(1);
      precedent = a;
    }
    expect(cycleTravail(0, o).avancement).toBe(0);
  });

  it("laissent la terre travaillée derrière eux", () => {
    /*
     * « Un tracteur qui laboure sans que rien ne change ne travaille pas, il
     * fait les cent pas. » Les bandes sont bâties d'avance et dévoilées au fur
     * et à mesure : régler une plage de dessin ne coûte rien.
     */
    const c = createCountryside({ ...OPTIONS, sobre: false });
    const sillons = c.object.children.filter((o) => o.name === "campagne-sillons");
    expect(sillons.length).toBeGreaterThanOrEqual(1);
    const geo = (sillons[0] as THREE.Mesh).geometry;
    const total = geo.getAttribute("position").count;

    /*
     * Chaque engin part avec sa propre phase — deux voisins qui laboureraient
     * au même instant se verraient. On balaie donc le cycle plutôt que de
     * regarder un instant précis.
     */
    // Rien de fait tant que rien n'a roulé.
    expect(geo.drawRange.count).toBe(0);
    const vus = new Set<number>();
    let avant = 0;
    for (let t = 0; t < 400; t += 2) {
      c.update(t);
      const n = geo.drawRange.count;
      expect(n).toBeLessThanOrEqual(total);
      // Une bande entière ou rien : jamais un triangle esseulé.
      expect(n % 6).toBe(0);
      /*
       * Et jamais en arrière. L'avancement, lui, redescend à zéro quand
       * l'engin repart de la première ligne : la plage de dessin le suivait,
       * et tout le champ labouré s'effaçait **en une image**, une fois par
       * cycle. Une terre qui se délaboure toute seule se lit comme un défaut
       * d'affichage. Le labour est un état du champ, pas une étape de la
       * boucle.
       */
      expect(n).toBeGreaterThanOrEqual(avant);
      avant = n;
      vus.add(n);
    }
    // La terre change vraiment derrière lui — et le champ finit par être fait.
    expect(vus.size).toBeGreaterThan(8);
    expect(Math.max(...vus)).toBe(total);

    // Jour neuf, terre neuve : c'est le seul moment où le labour s'efface,
    // et il s'efface avec la parcelle qu'on redessine.
    c.setJour(1, "AUTUMN");
    expect(geo.drawRange.count).toBe(0);
    c.dispose();
  });

  it("se réduisent en réglage sobre, jamais à zéro", () => {
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
    expect(sobre.plan.parcelles.length).toBeLessThan(riche.plan.parcelles.length);
    riche.dispose();
    sobre.dispose();
  });

  /**
   * Le nez dans le sens de la marche.
   *
   * Le reproche : « les animations des tracteurs des champs buggent alors que
   * nos animations sont bien ». Elles l'étaient : l'engin suivait la bonne
   * trajectoire, avec les bons demi-tours, mais **en crabe** — le capot vers
   * le rang d'à côté pendant qu'il descendait la ligne. Deux conventions de
   * cap se croisaient sans le dire. La route et les voitures portent un
   * relèvement (`atan2(dx, dz)`, carrosserie bâtie vers les Z), les machines
   * sont bâties vers les X : un quart de tour d'écart, invisible au calcul
   * puisque la position, elle, était juste.
   *
   * On ne teste donc pas le cap rendu — on teste ce qui se voit : que l'axe
   * du modèle et le déplacement pointent du même côté.
   */
  function alignement(c: ReturnType<typeof createCountryside>, t: number, dt: number) {
    const avant = new THREE.Vector3();
    c.update(t);
    const engin = c.object.children.find((o) => o.name === "campagne-engin")!;
    avant.copy(engin.position);
    const nez = new THREE.Vector3(1, 0, 0).applyQuaternion(engin.quaternion).setY(0);
    c.update(t + dt);
    const pas = engin.position.clone().sub(avant).setY(0);
    const long = pas.length();
    return { cos: long < 1e-6 ? 1 : nez.normalize().dot(pas.normalize()), long };
  }

  it("roulent le nez en avant, et non en crabe", () => {
    const c = createCountryside(OPTIONS);
    for (let t = 0; t < 240; t += 0.7) {
      const { cos, long } = alignement(c, t, 0.05);
      // On tolère le braquage d'un demi-tour, pas un quart de tour d'écart.
      expect(cos).toBeGreaterThan(0.6);
      expect(long).toBeLessThan(0.4);
    }
    c.dispose();
  });

  it("roulent sur la terre, sans y être enfoncés", () => {
    /*
     * Le dessus des cases est monté quand on leur a donné du volume ; l'engin,
     * lui, est resté à son ancienne altitude et labourait à mi-roue dans la
     * terre. Même règle que sur la parcelle du joueur : les pneus mordent d'un
     * centimètre dans la dalle, pas davantage — pile au sommet, il flotte.
     */
    const y0 = -0.46;
    const c = createCountryside({ ...OPTIONS, y: y0 });
    const dessus = y0 + CASE_EP / 2;
    c.update(3);
    for (const e of c.object.children.filter((o) => o.name === "campagne-engin")) {
      expect(dessus - e.position.y).toBeGreaterThan(0);
      expect(dessus - e.position.y).toBeLessThan(0.02);
    }
    c.dispose();
  });

  it("font tourner les roues à la vitesse du sol", () => {
    /*
     * La distance passée au modèle entraîne roues, disques et rabatteur. Elle
     * valait `t × vitesse` : une horloge, pas un odomètre. Or l'engin ne roule
     * pas à vitesse constante — il ralentit dans les manœuvres, et le retour à
     * la première ligne traverse tout le champ en prenant son temps. Les roues
     * tournaient donc au régime de travail pendant que le sol défilait à une
     * autre allure : un patinage, et c'est justement le moment où l'engin
     * traverse le cadre entier.
     *
     * On mesure la seule chose qui se voit : ce que la roue a déroulé contre
     * ce que le sol a défilé.
     */
    const c = createCountryside(OPTIONS);
    const engin = c.object.children.find((o) => o.name === "campagne-engin")!;
    let roue: THREE.Object3D | null = null;
    engin.traverse((o) => {
      if (!roue && typeof o.userData.radius === "number") roue = o;
    });
    expect(roue).not.toBeNull();
    const r = (roue as unknown as THREE.Object3D).userData.radius as number;

    c.update(0);
    let sol = engin.position.clone();
    let angle = (roue as unknown as THREE.Object3D).rotation.z;
    let deroule = 0;
    let parcouru = 0;
    const fenetre: [number, number][] = [];
    for (let t = 0.05; t < 90; t += 0.05) {
      c.update(t);
      const p = engin.position;
      parcouru += Math.hypot(p.x - sol.x, p.z - sol.z);
      sol = p.clone();
      const a = (roue as unknown as THREE.Object3D).rotation.z;
      deroule += Math.abs(a - angle) * r;
      angle = a;
      /*
       * Fenêtre glissante d'une demi-seconde, et non cumul depuis le départ :
       * c'est **pendant** la manœuvre que la roue s'emballe, et une moyenne
       * sur tout le cycle noie ces trois secondes dans les vingt autres. Le
       * défaut, mesuré ainsi : deux fois et demie trop vite en fourrière.
       */
      fenetre.push([parcouru, deroule]);
      if (fenetre.length > 10) fenetre.shift();
      if (fenetre.length === 10) {
        const sol = parcouru - fenetre[0]![0];
        const roule = deroule - fenetre[0]![1];
        if (sol > 0.05) expect(Math.abs(roule - sol) / sol).toBeLessThan(0.2);
      }
    }
    expect(parcouru).toBeGreaterThan(10);
    c.dispose();
  });
});

describe("les parcelles voisines", () => {
  it("ont le damier en volume, comme celui du joueur", () => {
    /*
     * Le reproche, dit trois fois : « ça doit ressembler à la nôtre, les cases
     * doivent être semblables ». Il tenait à un seul chiffre — la dalle
     * culminait deux centimètres **au-dessus** des cases, et le damier entier
     * était enterré dans le talus. On ne voyait qu'un aplat de terre, là où le
     * joueur a cent quarante-quatre pavés dont la tranche dessine la grille.
     *
     * Ce test compte ces pavés. Un aplat n'en a pas.
     */
    const y0 = -0.46;
    const c = createCountryside({ ...OPTIONS, y: y0 });
    const nappe = c.object.getObjectByName("campagne-parcelles-nappe") as THREE.Mesh;
    const p = nappe.geometry.getAttribute("position");
    // Hauteurs distinctes trouvées dans la nappe : un damier plat n'en a
    // qu'une pour ses cases, un damier en volume en a deux — dessus, dessous.
    const niveaux = new Set<string>();
    for (let i = 0; i < p.count; i++) niveaux.add(p.getY(i).toFixed(3));
    expect(niveaux.size).toBeGreaterThan(4);

    /*
     * Et l'invariant qui avait cédé : le dessus des cases doit dominer le
     * dessus de la dalle. Deux centimètres dans l'autre sens, et tout le
     * damier disparaît sous la terre.
     */
    expect(CASE_EP / 2).toBeGreaterThan(DALLE_HAUT);
    const dessusCase = y0 + CASE_EP / 2;
    let auDessus = 0;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(p.getY(i) - dessusCase) < 1e-3) auDessus++;
    }
    // Quatre sommets par case au moins, sur des dizaines de parcelles.
    expect(auDessus).toBeGreaterThan(1000);
    c.dispose();
  });

  it("tiennent dans un budget de sommets, et en un seul maillage", () => {
    /*
     * Le damier en volume multiplie les sommets par six. Mesuré : cent
     * quarante-cinq mille pour vingt-sept parcelles, dans **un** appel de
     * rendu — ce qu'une carte encaisse sans broncher. Ce garde-fou est là pour
     * que ça reste vrai : c'est le genre de chiffre qui triple sans qu'on s'en
     * aperçoive, et le premier à en souffrir est le téléphone.
     */
    const riche = createCountryside(OPTIONS);
    const nappe = riche.object.getObjectByName("campagne-parcelles-nappe") as THREE.Mesh;
    expect(nappe.geometry.getAttribute("position").count).toBeLessThan(220_000);
    riche.dispose();

    // En réglage sobre, on retombe sur des aplats : dix fois moins.
    const sobre = createCountryside({ ...OPTIONS, sobre: true });
    const plate = sobre.object.getObjectByName("campagne-parcelles-nappe") as THREE.Mesh;
    expect(plate.geometry.getAttribute("position").count).toBeLessThan(30_000);
    sobre.dispose();
  });

  it("sont bâties comme celle du joueur, à sa taille", () => {
    /*
     * « Les parcelles des PNJ doivent être sous la même forme que nous et
     * collées, de la même taille. » Ce sont les parcelles qu'on pourra
     * racheter : elles doivent déjà être à la bonne échelle.
     */
    const c = createCountryside(OPTIONS);
    expect(c.plan.emprise).toBe(EMPRISE);
    for (const p of c.plan.parcelles) {
      expect(p.x).toBeCloseTo(p.col * c.plan.pas, 6);
      expect(p.z).toBeCloseTo(p.rang * c.plan.pas, 6);
    }
    c.dispose();
  });

  it("tiennent entièrement sur la terre ferme", () => {
    const c = createCountryside(OPTIONS);
    for (const p of c.plan.parcelles) {
      expect(versEcranBas(p.x, p.z) - c.plan.emprise).toBeGreaterThanOrEqual(c.plan.sol.uMin);
    }
    c.dispose();
  });

  it("laissent l’amont au pré : c’est là qu’est le ciel", () => {
    // Un rang de voisins en amont pousserait la lisière hors du cadre.
    const plan = planCampagne(OPTIONS);
    expect(plan.sol.uMin).toBe(-horizonPour(EMPRISE));
    for (const p of plan.parcelles) expect(p.col + p.rang).toBeGreaterThanOrEqual(0);
    // Mais il y en a bien de chaque côté et en aval.
    expect(plan.parcelles.some((p) => p.col > 0)).toBe(true);
    expect(plan.parcelles.some((p) => p.rang > 0)).toBe(true);
    expect(plan.parcelles.some((p) => p.col < 0)).toBe(true);
    expect(plan.parcelles.some((p) => p.rang < 0)).toBe(true);
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
