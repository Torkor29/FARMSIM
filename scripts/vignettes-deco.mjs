/**
 * Rend les vignettes du catalogue de décoration
 * (`apps/web/public/assets/decor3d/vignettes/<CODE>.webp`) à partir des
 * modèles de la forge, sous une lumière proche de celle du jeu.
 *
 * Il faut le serveur de développement de la vue (`pnpm --filter web dev`,
 * port 5173) et Chromium (Playwright). Usage :
 *
 *     node scripts/vignettes-deco.mjs [http://localhost:5173]
 *
 * À relancer quand on ajoute un article au catalogue ou qu'on reconstruit
 * un modèle de la forge.
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const SORTIE = join(ICI, "../apps/web/public/assets/decor3d/vignettes");
const BASE = process.argv[2] ?? "http://localhost:5173";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
}

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
p.on("pageerror", (e) => console.error("page :", e.message));
await p.goto(`${BASE}/decor.html`);
await p.waitForTimeout(4000);

const images = await p.evaluate(async () => {
  const THREE = await import("/node_modules/.vite/deps/three.js");
  // `/@id/` : le préfixe par lequel Vite sert un module nommé par son paquet.
  const { DECO_CATALOGUE } = await import("/@id/@farmsim/shared");
  const { poserPiece } = await import("/src/modeles-decor.ts");
  const T = 192;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(T, T);
  r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const out = {};
  for (const a of DECO_CATALOGUE) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff6e0, 0x8fb070, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
    sun.position.set(4, 8, 6);
    scene.add(sun);
    const objet = await poserPiece(`/assets/decor3d/${a.asset}.glb`, a.piece, false);
    scene.add(objet);
    const box = new THREE.Box3().setFromObject(objet);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const rayon = Math.max(s.x, s.y, s.z) * 0.62;
    const cam = new THREE.OrthographicCamera(-rayon, rayon, rayon, -rayon, 0.01, 200);
    // La caméra du jeu : isométrique, côté (+x, +z).
    cam.position.set(c.x + 10, c.y + 8.5, c.z + 10);
    cam.lookAt(c);
    r.render(scene, cam);
    out[a.code] = r.domElement.toDataURL("image/webp", 0.9);
  }
  return out;
});
for (const [code, url] of Object.entries(images)) {
  writeFileSync(join(SORTIE, `${code}.webp`), Buffer.from(url.split(",")[1], "base64"));
}
console.log(`${Object.keys(images).length} vignettes → ${SORTIE}`);
await b.close();
