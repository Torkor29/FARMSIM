/**
 *   node apps/web/scripts/vignettes/rendre.mjs   (Vite lancé sur :5173)
 *
 * écrit `apps/web/public/assets/icons/catalogue/<id>.webp`.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = process.env.SORTIE ?? path.join(ICI, "..", "..", "public", "assets", "icons", "catalogue");
const IDS = process.env.IDS ? process.env.IDS.split(",") : [
  "champ", "pre", "etang", "berge", "surelever", "abaisser", "pont", "rampe", "boiser", "couper", "vocation", "chemin-terre", "chemin-gravier", "chemin-pave",
  "chene", "pommier", "sapin", "buisson", "fleurs", "rocher", "haie", "cloture",
  "banc", "lampadaire", "botte-foin", "puits",
];
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await nav.newPage();
page.on("pageerror", (e) => console.error(e.message));
await page.goto("http://127.0.0.1:5173/scripts/vignettes/");
await page.waitForFunction(() => document.title === "pret", null, { timeout: 120000 });
fs.mkdirSync(SORTIE, { recursive: true });
for (const id of IDS) {
  const url = await page.evaluate((i) => window.rendre(i), id);
  fs.writeFileSync(path.join(SORTIE, `${id}.webp`), Buffer.from(url.split(",")[1], "base64"));
  console.log(id);
}
await nav.close();
