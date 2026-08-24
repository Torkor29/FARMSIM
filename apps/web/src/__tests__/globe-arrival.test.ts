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
