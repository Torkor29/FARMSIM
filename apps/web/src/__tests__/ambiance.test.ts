import { ambiance, elevationSoleil, heureDuJeu, lireForcages, COURSE, type Saison } from "../ambiance";

/**
 * L'ambiance : un jour qui tourne, des couchers orangés, une nuit bleue qui
 * reste lisible, une météo qui voile.
 */
const canaux = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const SAISONS: Saison[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

describe("la course du soleil", () => {
  it.each(SAISONS)("%s : se lève, culmine à midi, se couche, plonge la nuit", (s) => {
    const { lever, coucher, midi } = COURSE[s];
    expect(Math.abs(elevationSoleil(lever, s))).toBeLessThan(0.01);
    expect(Math.abs(elevationSoleil(coucher, s))).toBeLessThan(0.01);
    expect(elevationSoleil((lever + coucher) / 2, s)).toBeCloseTo(midi, 5);
    expect(elevationSoleil(0.5, s)).toBeLessThan(-20);
  });

  it("monte plus haut l'été que l'hiver", () => {
    expect(elevationSoleil(13.5, "SUMMER")).toBeGreaterThan(elevationSoleil(12.7, "WINTER") + 20);
  });
});

describe("les moments du jour", () => {
  it("le coucher est orangé, le midi presque blanc", () => {
    const soir = ambiance(COURSE.SUMMER.coucher - 0.1, "SUMMER");
    const midi = ambiance(13.5, "SUMMER");
    const [r, , b] = canaux(soir.astre.couleur);
    expect(r - b).toBeGreaterThan(100);
    const [mr, , mb] = canaux(midi.astre.couleur);
    expect(mr - mb).toBeLessThan(r - b);
    expect(soir.ciel.voile).toBeGreaterThan(0.5);
    expect(midi.ciel.voile).toBeLessThan(0.05);
  });

  it("l'aube est plus rose que le soir", () => {
    const aube = ambiance(COURSE.SPRING.lever + 0.05, "SPRING");
    const soir = ambiance(COURSE.SPRING.coucher - 0.05, "SPRING");
    expect(canaux(aube.astre.couleur)[2]).toBeGreaterThan(canaux(soir.astre.couleur)[2]);
  });

  it("la nuit : la lune éclaire, les lampes s'allument, la ferme reste lisible", () => {
    const n = ambiance(1, "AUTUMN");
    expect(n.astre.lune).toBe(true);
    expect(n.nuit).toBeGreaterThan(0.95);
    expect(n.lampes).toBe(1);
    expect(n.ciel.etoiles).toBeGreaterThan(0.9);
    // Assez de lumière pour lire ses champs : on ne plonge pas dans le noir.
    expect(n.hemi.intensite + n.ambiante.intensite).toBeGreaterThan(1.2);
    const [r, , b] = canaux(n.hemi.ciel);
    expect(b).toBeGreaterThan(r);
  });

  it("le soleil vient toujours du côté de la caméra à midi", () => {
    const [x, y, z] = ambiance(13.5, "SUMMER").astre.direction;
    expect(x).toBeGreaterThan(0);
    expect(z).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0.8);
  });

  it("ne rase jamais au point de projeter des ombres infinies", () => {
    for (let h = 0; h < 24; h += 0.25) expect(ambiance(h, "WINTER").astre.direction[1]).toBeGreaterThan(0.12);
  });
});

describe("la météo", () => {
  it("la pluie éteint le soleil, grise le ciel et rapproche la brume", () => {
    const beau = ambiance(12, "SPRING", "CLEAR");
    const pluie = ambiance(12, "SPRING", "RAIN");
    expect(pluie.astre.intensite).toBeLessThan(beau.astre.intensite * 0.5);
    expect(pluie.brume.proche).toBeLessThan(beau.brume.proche);
    expect(pluie.ciel.voile).toBeGreaterThan(0.4);
  });

  it("l'orage est plus sombre que la pluie, et allume les lampes en plein jour", () => {
    const pluie = ambiance(12, "SUMMER", "RAIN");
    const orage = ambiance(12, "SUMMER", "STORM");
    expect(orage.hemi.intensite).toBeLessThan(pluie.hemi.intensite);
    expect(orage.lampes).toBeGreaterThan(0.4);
  });
});

describe("l'horloge", () => {
  it("la journée prend les trois quarts du cycle réel", () => {
    const { lever, coucher } = COURSE.SUMMER;
    expect(heureDuJeu(0, "SUMMER")).toBeCloseTo(lever - 1, 5);
    expect(heureDuJeu(0.75, "SUMMER")).toBeCloseTo(coucher + 1, 5);
    let prec = heureDuJeu(0, "SUMMER");
    for (let f = 0.01; f < 0.75; f += 0.01) {
      const h = heureDuJeu(f, "SUMMER");
      expect(h).toBeGreaterThan(prec);
      prec = h;
    }
  });

  it("lit les forçages de l'URL", () => {
    expect(lireForcages("?heure=19.5&vitesse=60&meteo=rain")).toEqual({ heure: 19.5, vitesse: 60, meteo: "RAIN" });
    expect(lireForcages("?meteo=GRELE&vitesse=-1")).toEqual({});
  });
});
