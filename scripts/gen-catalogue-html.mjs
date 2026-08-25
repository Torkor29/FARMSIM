#!/usr/bin/env node
/**
 * Génère docs/catalogue-refs-t1-t5.html depuis le catalogue source.
 * À relancer après chaque recale T1–T5.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MACHINE_CATALOG,
  MACHINE_DEFS,
  MACHINE_TIERS,
  TELEHANDLER_CATALOG,
  TIER_ROLE_LABELS,
  machineOverhaulCost,
} from "../packages/shared/dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function euros(n) {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function row(tier, fiche, kind) {
  const stats = [];
  if (fiche.powerHp) stats.push(`${fiche.powerHp} ch`);
  if (fiche.requiredHp) stats.push(`${fiche.requiredHp} ch requis`);
  if (fiche.widthM) stats.push(`${fiche.widthM} m`);
  if (fiche.capacityL) stats.push(`${fiche.capacityL.toLocaleString("fr-FR")} L`);
  stats.push(`${fiche.speedKmh} km/h`);
  stats.push(`${fiche.fuelLPerHour} L/h`);
  const jeu = `${euros(fiche.cost)} · rév. ${euros(machineOverhaulCost(fiche.cost))}`;
  return `<tr>
      <td>T${tier}<br><span class="muted">${TIER_ROLE_LABELS[tier]}</span></td>
      <td>${fiche.inspiredBy}<br><span class="muted">${fiche.maker}</span></td>
      <td>${stats.join(" · ")}<br><span class="muted">${fiche.copy}</span></td>
      <td>${euros(fiche.realPriceApprox)}</td>
      <td>${jeu}</td>
      <td>${fiche.bonus}<br><span class="muted">${fiche.constraints}</span></td>
    </tr>`;
}

function section(title, blurb, variants, kind) {
  const body = MACHINE_TIERS.map((t) => row(t, variants[t], kind)).join("\n");
  return `
    <section>
      <h2>${title}</h2>
      <p class="blurb">${blurb}</p>
      <table>
        <thead><tr>
          <th>Palier</th>
          <th>Référence réelle</th>
          <th>Copié dans le jeu</th>
          <th>Marché ~neuf HT</th>
          <th>Prix jeu</th>
          <th>Bonus / contraintes</th>
        </tr></thead>
        <tbody>
${body}
        </tbody>
      </table>
    </section>`;
}

const familles = [
  ["Tracteur", "T5 = John Deere 9RX 830 (830 ch, 4 chenilles) — sommet du marché, pas un 1050.", MACHINE_CATALOG.TRACTOR, MACHINE_DEFS.TRACTOR.kind],
  ["Moissonneuse", "T5 = New Holland CR11 : 20 000 L, coupe 15,2 m, 775 ch.", MACHINE_CATALOG.HARVESTER, MACHINE_DEFS.HARVESTER.kind],
  ["Ensileuse", "T5 = John Deere 9900 (~970 ch, 9 m). La Jaguar 990 est le T4.", MACHINE_CATALOG.FORAGE_HARVESTER, MACHINE_DEFS.FORAGE_HARVESTER.kind],
  ["Charrue", "Une charrue ne fait pas 18 m. T5 = 12 corps, 7 m, 420 ch — seul le 830 la tire.", MACHINE_CATALOG.PLOUGH, MACHINE_DEFS.PLOUGH.kind],
  ["Semoir", "La largeur est le palier. T5 = Bourgault 3420-80, 24,4 m.", MACHINE_CATALOG.SEEDER, MACHINE_DEFS.SEEDER.kind],
  ["Épandeur", "T5 = Amazone ZG-TS 10 000 L, nappe 48 m.", MACHINE_CATALOG.SPREADER, MACHINE_DEFS.SPREADER.kind],
  ["Déchaumeur", "T5 = Horsch Joker 12 RT, 12,25 m, 400 ch.", MACHINE_CATALOG.DISC_HARROW, MACHINE_DEFS.DISC_HARROW.kind],
  ["Faucheuse", "T5 = CLAAS Disco 1100 C, 10,7 m papillon.", MACHINE_CATALOG.MOWER, MACHINE_DEFS.MOWER.kind],
  ["Pulvérisateur", "T1 porté 15 m → T2 traîné 24 m → T3+ automoteur jusqu’à 48 m (Leeb PT).", MACHINE_CATALOG.SPRAYER, MACHINE_DEFS.SPRAYER.kind],
  ["Presse", "T5 = Krone Big Pack 1290 HDP, balle cubique, débit industriel.", MACHINE_CATALOG.BALER, MACHINE_DEFS.BALER.kind],
  ["Remorque", "T5 = Fliegl ASW 391, 70 m³, tridem.", MACHINE_CATALOG.TRAILER, MACHINE_DEFS.TRAILER.kind],
];

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FARMSIM — Catalogue T1 à T5</title>
  <style>
    :root { --green: #2d5a2a; --row: #f4f8f2; --ink: #1e1e1e; --muted: #555; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, "Times New Roman", serif; margin: 0; color: var(--ink); background: #f7f5ef; }
    header { background: var(--green); color: #fff; padding: 1.4rem 1.5rem 1.1rem; }
    header h1 { margin: 0 0 .35rem; font-size: 1.55rem; font-family: system-ui, sans-serif; }
    header p { margin: 0; opacity: .9; font-size: .95rem; }
    main { max-width: 1280px; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
    .notes { background: #fff; border: 1px solid #dbe3d6; border-radius: 8px; padding: 1rem 1.15rem; margin-bottom: 1.5rem; }
    .notes h2 { margin: 0 0 .6rem; font-size: 1.05rem; font-family: system-ui, sans-serif; color: var(--green); }
    .notes ul { margin: 0; padding-left: 1.2rem; }
    .notes li { margin: .35rem 0; font-size: .92rem; line-height: 1.4; }
    section { margin: 1.6rem 0; }
    section h2 { margin: 0; font-family: system-ui, sans-serif; color: var(--green); font-size: 1.2rem; }
    section .blurb { color: var(--muted); font-size: .88rem; margin: .25rem 0 .55rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; font-size: .78rem; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    th { background: var(--green); color: #fff; text-align: left; padding: .45rem .5rem; font-family: system-ui, sans-serif; font-weight: 600; }
    td { padding: .4rem .5rem; vertical-align: top; border-bottom: 1px solid #e4eadf; }
    tr:nth-child(even) td { background: var(--row); }
    td:first-child, td:nth-child(5) { font-weight: 700; font-family: system-ui, sans-serif; white-space: nowrap; }
    .muted { font-weight: 400; color: var(--muted); font-size: .84em; }
    footer { color: #777; font-size: .8rem; margin-top: 2rem; }
    a { color: var(--green); }
  </style>
</head>
<body>
  <header>
    <h1>FARMSIM — Catalogue T1 à T5</h1>
    <p>Références réelles (SKU) · prix de jeu · T5 = sommet du marché</p>
  </header>
  <main>
    <div class="notes">
      <h2>Comment lire ce document</h2>
      <ul>
        <li>Les SKU servent à la silhouette 3D, aux chevaux, largeurs, capacités. Les marques ne s’affichent pas au joueur (<code>inspiredBy</code> interne).</li>
        <li>Les prix de jeu collent aux fourchettes du neuf 2024–2026, un cran en dessous. Un T5 coûte ce qu’il coûte dans le vrai monde.</li>
        <li>Le T5 n’est pas « un gros T4 » : 9RX 830, CR11 20 000 L, 9900 ~970 ch, rampe 48 m, semoir 24 m.</li>
        <li>Révision complète = 22 % du neuf. Un T5 se paie aussi à la cuve et à l’atelier — trop gros pour 14 ha.</li>
        <li>Le chargeur télescopique est documenté (cour) mais n’est pas un engin de champ : un travail = un outil.</li>
      </ul>
    </div>
${familles.map(([t, b, v, k]) => section(t, b, v, k)).join("\n")}
${section(
  "Chargeur télescopique (cour, hors champ)",
  "Manitou / JCB / CLAAS / Merlo. T5 = MLT 961, 6 t / 9 m. Pas achetable en jeu — ancre 3D et économie future.",
  TELEHANDLER_CATALOG,
  "TRACTOR",
)}
    <footer>
      Source : <code>packages/shared/src/machine-catalog.ts</code>.
      Généré par <code>node scripts/gen-catalogue-html.mjs</code>.
      PDF : <a href="catalogue-refs-t1-t5.pdf">catalogue-refs-t1-t5.pdf</a>
    </footer>
  </main>
</body>
</html>
`;

writeFileSync(join(root, "docs/catalogue-refs-t1-t5.html"), html);
console.log("wrote docs/catalogue-refs-t1-t5.html");
