/**
 * Vérification du jeu dans un vrai navigateur, sans personne au clavier.
 *
 * Les tests unitaires ne voient ni un écran qui clignote, ni un toucher qui ne
 * prend pas, ni une scène qui se reconstruit sous le doigt. Ce script joue ce
 * qu'un joueur joue — ouvrir sa ferme, toucher ses autres parcelles, choisir
 * des cases, lancer un semis — et rend un verdict ligne par ligne.
 *
 * Il crée son propre joueur (quatre parcelles), il faut donc un serveur avec
 * les outils de test (`FARMSIM_DEV_TOOLS=1`).
 *
 *   node scripts/verifier-jeu.mjs                         # API :3001, jeu :5173
 *   node scripts/verifier-jeu.mjs --jeu http://127.0.0.1:4173 --mobile
 *
 * Code de sortie 1 si une vérification échoue.
 */
import { mkdirSync } from "node:fs";

const arg = (nom, defaut) => {
  const i = process.argv.indexOf(nom);
  return i > 0 ? process.argv[i + 1] : defaut;
};
const API = arg("--api", "http://127.0.0.1:3001");
const JEU = arg("--jeu", "http://127.0.0.1:5173");
const MOBILE = process.argv.includes("--mobile");
const SORTIE = arg("--captures", "verifier-jeu-captures");
const W = MOBILE ? 390 : 1440;
const H = MOBILE ? 844 : 900;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import("/opt/node22/lib/node_modules/playwright/index.mjs"));
}

const verdicts = [];
const verifier = (nom, ok, detail = "") => {
  verdicts.push({ nom, ok });
  console.log(`${ok ? "✓" : "✗"} ${nom}${detail ? ` — ${detail}` : ""}`);
};

/* ---------- Un joueur à quatre parcelles ---------- */
const j = async (chemin, corps, jeton) => {
  const r = await fetch(API + chemin, {
    method: corps ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(jeton ? { authorization: `Bearer ${jeton}` } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  return [r.status, await r.json().catch(() => null)];
};
const [s, inscrit] = await j("/auth/register", {
  email: `verif${Date.now()}@test.fr`,
  displayName: "Vérificateur",
  accessCode: "verification-2026",
});
if (s >= 300) throw new Error(`inscription refusée : ${JSON.stringify(inscrit)}`);
const jeton = inscrit.token;
const joueur = inscrit.player.id;
const monde = (await j("/world/KOR"))[1];
// Une parcelle libre au milieu d'une région, pour avoir des voisines à acheter.
// On essaie jusqu'à ce que l'installation prenne : une autre vérification a pu
// prendre la même entre la lecture et la demande.
let siege = null;
const candidates = monde.regions
  .filter((r) => r.starterEligible)
  .flatMap((r) => r.parcels.filter((p) => !p.taken && !p.farmId && p.mapX > 0 && p.mapY > 0 && p.mapX < r.mapW - 1 && p.mapY < r.mapH - 1));
for (const p of candidates) {
  const [code] = await j("/world/claim", { parcelId: p.id, specialization: "CEREALIER" }, jeton);
  if (code < 300) {
    siege = p;
    break;
  }
}
if (!siege) throw new Error("aucune parcelle de départ n'a pu être prise");
await j("/dev/grant", { userId: joueur, crd: 5_000_000, level: 30 }, jeton);
const voisinage = (await j(`/parcels/${siege.id}/voisinage`, null, jeton))[1];
for (const p of voisinage.parcelles.filter((q) => q.achetable).slice(0, 3)) {
  await j(`/parcels/${p.id}/buy`, { userId: joueur }, jeton);
}

/* ---------- Le navigateur ---------- */
mkdirSync(SORTIE, { recursive: true });
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const ctx = await nav.newContext({ viewport: { width: W, height: H }, hasTouch: MOBILE, isMobile: MOBILE });
const page = await ctx.newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
page.on("response", (r) => {
  if (r.status() >= 500) erreurs.push(`${r.status()} ${r.url()}`);
});
await page.goto(JEU, { waitUntil: "domcontentloaded" });
await page.evaluate(([t, id]) => {
  localStorage.setItem("farmsim_token", t);
  localStorage.setItem(`farmsim_tutorial_v1:${id}`, "1");
}, [jeton, joueur]);
await page.reload({ waitUntil: "domcontentloaded" });
const debut = Date.now();
for (let i = 0; i < 400; i++) {
  const pret = await page.evaluate(() => typeof window.__caseEcran === "function" && window.__fermeComposee?.composee);
  if (pret) break;
  if (i % 3 === 0) await page.mouse.click(W / 2, 60).catch(() => {});
  for (const t of ["J'ai vu", "Continuer", "Plus tard"]) {
    const b = page.locator("button:visible", { hasText: t });
    if (await b.count()) await b.first().click().catch(() => {});
  }
  await page.waitForTimeout(500);
}
const etat = () => page.evaluate(() => ({ ...window.__fermeComposee, layouts: window.__layouts?.n ?? 0 }));
const e0 = await etat();
verifier("la ferme s'ouvre", e0.composee === true, `${((Date.now() - debut) / 1000).toFixed(0)} s`);
verifier("les quatre parcelles sont dessinées ensemble", (e0.morceaux ?? []).length === 4, `${e0.cases} cases`);
await page.screenshot({ path: `${SORTIE}/1-ferme.png` });

const ecran = async (x, y) => {
  // La vue doit être montée : si elle a disparu, c'est un défaut à montrer.
  for (let i = 0; i < 40 && !(await page.evaluate(() => typeof window.__caseEcran === "function")); i++) {
    if (i === 0) {
      await page.screenshot({ path: `${SORTIE}/vue-absente.png` });
      verifier("la vue 3D reste montée", false, (await page.evaluate(() => document.body.innerText.slice(0, 160))).replace(/\s+/g, " "));
    }
    await page.waitForTimeout(500);
  }
  return page.evaluate(([a, b]) => window.__caseEcran(a, b), [x, y]);
};
const toucher = async (x, y) => {
  const p = await ecran(x, y);
  if (MOBILE) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
};
const retenues = () =>
  page.evaluate(() => Number((document.body.innerText.match(/(\d+)\s*case[s]?\s*retenue/i) ?? [])[1] ?? (document.body.innerText.match(/Semer [^\n]*×(\d+)/) ?? [])[1] ?? 0));

/* ---------- Toucher ses autres parcelles : rien ne doit clignoter ---------- */
const autres = e0.morceaux.filter((m) => m.id !== e0.actif);
const ecr = await ctx.newCDPSession(page);
const images = [];
ecr.on("Page.screencastFrame", async (f) => {
  images.push(Buffer.from(f.data, "base64").length);
  await ecr.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await ecr.send("Page.startScreencast", { format: "jpeg", quality: 40, maxWidth: 360, maxHeight: 240 });
const L0 = e0.layouts;
let bascules = 0;
for (const m of [...autres, e0.morceaux[0]]) {
  const p = await ecran(m.dx + 3, m.dy + 3);
  if (p.x < 10 || p.x > W - 10 || p.y < 80 || p.y > H * 0.6) continue;
  if (MOBILE) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(1500);
  if ((await etat()).actif === m.id) bascules++;
}
await ecr.send("Page.stopScreencast").catch(() => {});
// Un écran qui change d'un coup change aussi de poids : un éclair se lit
// comme un saut de taille d'image qui revient aussitôt.
let eclairs = 0;
for (let i = 1; i + 1 < images.length; i++) {
  const a = images[i - 1], b = images[i], c = images[i + 1];
  if (Math.abs(b - a) / a > 0.25 && Math.abs(c - a) / a < 0.08) eclairs++;
}
verifier("toucher une parcelle la rend active", bascules > 0, `${bascules} bascule(s)`);
verifier("changer de parcelle ne reconstruit pas la scène", (await etat()).layouts === L0, `${(await etat()).layouts - L0} reconstruction(s)`);
verifier("aucun éclair à l'écran", eclairs === 0, `${images.length} images, ${eclairs} éclair(s)`);

/* ---------- Choisir des cases sur une autre parcelle ---------- */
const cible = autres.find((m) => m.w >= 10) ?? autres[0];
if (MOBILE) await page.locator("button:visible", { hasText: /^Semer$/ }).first().click().catch(() => {});
else await page.keyboard.press("2");
await page.waitForTimeout(400);
await toucher(cible.dx + 2, cible.dy + 2);
await page.waitForTimeout(1200);
const e1 = await etat();
verifier("le premier toucher retient la case", e1.actif === cible.id && (await retenues()) >= 1, `${await retenues()} case(s)`);
await page.screenshot({ path: `${SORTIE}/2-selection.png` });

verifier("aucune erreur dans la page ni côté serveur", erreurs.length === 0, erreurs.slice(0, 3).join(" | "));
await ctx.close();
await nav.close();
const echecs = verdicts.filter((v) => !v.ok).length;
console.log(`\n${verdicts.length - echecs}/${verdicts.length} vérifications passées — captures dans ${SORTIE}/`);
process.exit(echecs ? 1 : 0);
