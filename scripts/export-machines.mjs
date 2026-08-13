#!/usr/bin/env node
/**
 * Produit un `.glb` par machine dans `apps/web/public/assets/models/`.
 *
 * Les engins sont construits en géométrie procédurale : le jeu n'a donc aucun
 * fichier de modèle à charger. Mais un asset qu'on ne peut pas ouvrir ailleurs
 * n'en est pas vraiment un — ce script produit les fichiers exploitables dans
 * Blender, dans un autre moteur, ou par un graphiste.
 *
 * Le rendu se fait dans un vrai navigateur (three.js exporte en glTF côté
 * client) : le script démarre le serveur de développement, ouvre la page
 * d'export et récupère les fichiers.
 *
 *   node scripts/export-machines.mjs
 *
 * Playwright est requis (présent dans l'image de développement).
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, "../apps/web");
// Hors de `public/` : ces fichiers sont des livrables pour l'extérieur, pas
// des ressources chargées par le jeu — inutile de les déployer.
const outDir = path.resolve(here, "../models");
const PORT = 5199;

const MACHINES = [
  ["TRACTOR", "tractor.glb"],
  ["HARVESTER", "harvester.glb"],
  ["SPREADER", "spreader.glb"],
  ["DISC_HARROW", "disc-harrow.glb"],
];

const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: webDir,
  stdio: "ignore",
});

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* le serveur n'écoute pas encore */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`serveur injoignable : ${url}`);
}

try {
  const url = `http://localhost:${PORT}/export-models.html`;
  await waitForServer(url);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("ERREUR page :", String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.exportMachine === "function");

  for (const [type, file] of MACHINES) {
    const base64 = await page.evaluate((t) => window.exportMachine(t), type);
    const bytes = Buffer.from(base64, "base64");
    await writeFile(path.join(outDir, file), bytes);
    console.log(`${file} — ${(bytes.length / 1024).toFixed(0)} kB`);
  }

  await browser.close();
} finally {
  server.kill();
}
