import fs from "node:fs";

/**
 * Le globe d'arrivée : on doit voir la planète entière, pas un gros plan
 * de mer recadré par le zoom CSS.
 */
const GLOBE = fs.readFileSync("src/GlobeView.tsx", "utf8");
const ARRIVAL = fs.readFileSync("src/ArrivalTransition.tsx", "utf8");
const CSS = fs.readFileSync("src/auth.css", "utf8");

describe("le globe à la connexion", () => {
  it("s’ouvre en vue monde, sans focus sur un continent", () => {
    expect(ARRIVAL).not.toMatch(/\bfocus\b/);
    expect(ARRIVAL).not.toMatch(/selected=\{continentCode\}/);
  });

  it("cadre assez loin pour que le disque tienne dans l’image", () => {
    expect(GLOBE).toMatch(/DIST_WORLD = DIST_FIT \* 1\.58/);
    expect(GLOBE).toMatch(/DIST_FOCUS = DIST_FIT \* 1\.18/);
  });

  it("ne gonfle plus le globe hors cadre dès les premières images", () => {
    const zoom = CSS.slice(CSS.indexOf("@keyframes arrival-zoom"));
    expect(zoom).toMatch(/transform: scale\(0\.92\)/);
    expect(zoom).not.toMatch(/scale\(2\.6\)/);
    expect(zoom).not.toMatch(/scale\(6\)/);
  });
});

/**
 * La netteté du globe à l'arrivée.
 *
 * Le globe s'affichait en 256 × 128 étirés sur une sphère plein écran, et le
 * restait tant que la carte fine n'était pas **entièrement** peinte — près de
 * deux secondes, c'est-à-dire tout le temps où on le regarde. Ce n'était pas
 * un défaut de réglage, c'était l'ordre des opérations.
 */
describe("le globe est net tout de suite", () => {
  it("peint la carte fine par-dessus l’aperçu, au lieu d’attendre qu’elle soit finie", () => {
    // La graine : sans elle, les bandes non peintes seraient transparentes et
    // la planète se dévoilerait derrière une frontière descendant du pôle.
    expect(GLOBE).toMatch(/makePlanetPainter\(terrain, fields, TEX_W, TEX_H, apercu\)/);
    // Et on renvoie la toile en cours de route, sinon la graine ne sert à rien.
    expect(GLOBE).toMatch(/liveTex\.color\.needsUpdate = true/);
  });

  it("garde une carte des continents entière pour le clic", () => {
    /*
     * Le piège de cette correction : les toiles et la carte des continents
     * vivent dans le même objet, mais publier les deux d'un bloc rendrait le
     * globe net et **incliquable** pendant toute la peinture — la carte des
     * continents se remplit bande par bande, et une carte à moitié peinte se
     * lit comme de l'océan partout ailleurs.
     *
     * On n'échange donc `skin` qu'une fois la peinture terminée, alors que
     * `applySkin` a lieu dès la première image.
     */
    const bloc = GLOBE.slice(GLOBE.indexOf("const painter = makePlanetPainter(terrain, fields, TEX_W"));
    const avantFin = bloc.slice(0, bloc.indexOf("if (fini)"));
    expect(avantFin).toMatch(/applySkin\(painter\.skin\)/);
    expect(avantFin).not.toMatch(/\bskin = painter\.skin/);
    expect(bloc.slice(bloc.indexOf("if (fini)"))).toMatch(/skin = painter\.skin/);
  });

  it("filtre les trois cartes, pas seulement la couleur", () => {
    // L'anisotropie ne portait que sur la couleur ; au limbe et aux pôles, le
    // relief s'étire autant qu'elle.
    const bloc = GLOBE.slice(GLOBE.indexOf("for (const t of [colorTex, bumpTex, roughTex])"));
    expect(bloc.slice(0, 800)).toMatch(/t\.anisotropy = renderer\.capabilities\.getMaxAnisotropy\(\)/);
  });
});

describe("l’animation ne dépend pas de la cadence d’affichage", () => {
  it("n’avance plus d’une fraction fixe par image", () => {
    /*
     * « Avance de quinze pour cent du reste » — par image — va deux fois plus
     * vite à 120 Hz qu'à 60, et rampe à 30. Or le surveillant d'images bride
     * volontairement à 30 sur les machines lentes : le jeu ralentissait donc
     * ses animations là où elles ont le plus besoin de rester lisibles.
     */
    expect(GLOBE).toMatch(/function approche\(dt: number, k: number\)/);
    expect(GLOBE).not.toMatch(/scale\.lerp\(scaleTmp, 0\.15\)/);
    expect(GLOBE).not.toMatch(/uOpacity\.value \+= \(wantOpacity - uOpacity\.value\) \* 0\.14/);
    expect(GLOBE).not.toMatch(/velX \*= 0\.93/);
  });

  it("couvre le même chemin quelle que soit la cadence", () => {
    // La propriété elle-même, et pas seulement sa présence dans le source :
    // avancer d'un pas de 1/120 s deux fois doit valoir un pas de 1/60 s.
    const approche = (dt: number, k: number) => 1 - Math.exp(-k * dt);
    const unPas = approche(1 / 60, 9.75);
    const a = approche(1 / 120, 9.75);
    const deuxPas = a + (1 - a) * a;
    expect(deuxPas).toBeCloseTo(unPas, 12);
  });
});

describe("les repères dorés", () => {
  it("ne montrent plus leurs polygones", () => {
    // Vingt-six segments pour l'anneau et six pour la tige : invisible en vue
    // monde, un polygone et un prisme dès qu'on s'approche — et ce sont les
    // seuls objets qu'on vient cliquer.
    expect(GLOBE).not.toMatch(/RingGeometry\(0\.12, 0\.155, 26\)/);
    expect(GLOBE).not.toMatch(/CylinderGeometry\(0\.014, 0\.02, 0\.2, 6\)/);
    const ring = GLOBE.match(/RingGeometry\(0\.12, 0\.155, (\d+)\)/);
    expect(Number(ring?.[1])).toBeGreaterThanOrEqual(64);
  });

  it("gardent la pastille facettée — c’est une pierre, pas une bille", () => {
    // La tige devient lisse, la pastille reste taillée : c'est ce qui la fait
    // accrocher la lumière quand elle tourne.
    expect(GLOBE).toMatch(/OctahedronGeometry\(0\.075, 1\)/);
    expect(GLOBE).toMatch(/color: tone, flatShading: false/);
  });

  it("ne bougent pas pour qui a demandé moins d’animation", () => {
    const bloc = GLOBE.slice(GLOBE.indexOf("m.head.rotation.y") - 200);
    expect(bloc.slice(0, 400)).toMatch(/!reduced/);
  });
});
