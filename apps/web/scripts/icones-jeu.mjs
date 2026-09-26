/**
 * Le jeu d'icônes du jeu, en un seul style : l'« autocollant » des jeux de
 * ferme sur téléphone.
 *
 * Chaque icône est dessinée ici, avec les mêmes briques — un contour brun
 * épais aux angles ronds, des aplats vifs, un reflet blanc en haut à gauche,
 * une ombre posée au sol. C'est ce qui les fait aller ensemble : les icônes
 * d'avant venaient de trois séries différentes, et les emoji du catalogue
 * d'une quatrième, celle du téléphone de chacun.
 *
 *   node apps/web/scripts/icones-jeu.mjs
 *
 * écrit `apps/web/public/assets/icons/jeu/*.svg`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, "..", "public", "assets", "icons", "jeu");

/* La palette : peu de teintes, toutes saturées, chacune avec son ombre. */
const C = {
  trait: "#4a2c16",
  herbe: "#7cd04e",
  herbeO: "#3f9a2c",
  feuille: "#58b53d",
  feuilleO: "#2f7d25",
  soleil: "#ffd23f",
  soleilO: "#e39b00",
  rouge: "#f0584a",
  rougeO: "#b8342a",
  ciel: "#5bbcf2",
  cielO: "#2a7fc0",
  eau: "#63c5f5",
  bois: "#cf8f50",
  boisO: "#94592b",
  terre: "#9a6337",
  terreO: "#6b3f1e",
  creme: "#fff4d8",
  cremeO: "#e8cf9a",
  pierre: "#c3c8cc",
  pierreO: "#8d959b",
  rose: "#ff8fb1",
  violet: "#9b7be0",
  blanc: "#ffffff",
  peau: "#f5c49b",
};

/** Le contour : un seul attribut `stroke-width` par élément, sinon le SVG est invalide. */
const T = (w = 3) => `stroke="${C.trait}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const ombre = (rx = 18, cy = 58) => `<ellipse cx="32" cy="${cy}" rx="${rx}" ry="3.6" fill="#2b1a0c" opacity=".18"/>`;
const reflet = (d) => `<path d="${d}" fill="#fff" opacity=".42"/>`;
const svg = (corps) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">${corps}</svg>\n`;

/* Des formes qui reviennent. */
const arbreRond = (cx, cy, r, f = C.feuille, fo = C.feuilleO) =>
  `<rect x="${cx - 3}" y="${cy + r - 6}" width="6" height="14" rx="2" fill="${C.bois}" ${T()}/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${T()}/>` +
  `<path d="M${cx - r * 0.55} ${cy + r * 0.45} a${r} ${r} 0 0 0 ${r * 1.4} ${r * 0.2}" fill="none" stroke="${fo}" stroke-width="3" stroke-linecap="round" opacity=".55"/>` +
  reflet(`M${cx - r * 0.6} ${cy - r * 0.2} a${r * 0.7} ${r * 0.7} 0 0 1 ${r * 0.7} ${-r * 0.55} a${r * 0.25} ${r * 0.25} 0 0 1 0 ${r * 0.4} a${r * 0.4} ${r * 0.4} 0 0 0 ${-r * 0.4} ${r * 0.35} a${r * 0.2} ${r * 0.2} 0 0 1 ${-r * 0.3} ${-r * 0.2}z`);

const piece = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.soleil}" ${T()}/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="none" stroke="${C.soleilO}" stroke-width="2.4"/>` +
  `<text x="${cx}" y="${cy + r * 0.36}" font-family="Baloo 2, Arial Black, sans-serif" font-weight="800" font-size="${r * 1.05}" text-anchor="middle" fill="${C.soleilO}">€</text>` +
  reflet(`M${cx - r * 0.7} ${cy - r * 0.1} a${r * 0.75} ${r * 0.75} 0 0 1 ${r * 0.55} ${-r * 0.6} a${r * 0.12} ${r * 0.12} 0 0 1 ${r * 0.15} ${r * 0.22} a${r * 0.55} ${r * 0.55} 0 0 0 ${-r * 0.42} ${r * 0.46}z`);

const etoile = (cx, cy, r, f = C.soleil) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.48 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${f}" ${T()}/>` + reflet(`M${cx - r * 0.25} ${cy - r * 0.55} l${r * 0.2} ${-r * 0.3} l${r * 0.08} ${r * 0.42}z`);
};

const epi = (x, y, h, rot = 0) => {
  let s = `<g transform="rotate(${rot} ${x} ${y + h})"><path d="M${x} ${y + h} V${y + 6}" stroke="${C.soleilO}" stroke-width="3" stroke-linecap="round"/>`;
  for (let k = 0; k < 4; k++) {
    const yy = y + 4 + k * 5;
    s += `<ellipse cx="${x - 3.2}" cy="${yy}" rx="3" ry="4.4" transform="rotate(-28 ${x - 3.2} ${yy})" fill="${C.soleil}" ${T(2)}/>`;
    s += `<ellipse cx="${x + 3.2}" cy="${yy}" rx="3" ry="4.4" transform="rotate(28 ${x + 3.2} ${yy})" fill="${C.soleil}" ${T(2)}/>`;
  }
  s += `<ellipse cx="${x}" cy="${y + 1}" rx="2.6" ry="4.2" fill="${C.soleil}" ${T(2)}/></g>`;
  return s;
};

const ICONES = {
  /* —— Navigation —— */
  construire: svg(
    ombre() +
      `<path d="M12 30 32 14l20 16v22a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3z" fill="${C.rouge}" ${T()}/>` +
      `<path d="M8 32 32 12l24 20" fill="none" ${T(4)}/>` +
      `<rect x="26" y="38" width="12" height="17" rx="2" fill="${C.creme}" ${T()}/>` +
      `<path d="M18 32h8v6h-8z" fill="${C.creme}" ${T()}/>` +
      reflet("M16 29 30 18.5v4L16 33z") +
      `<g transform="rotate(35 48 16)"><rect x="45" y="6" width="6" height="22" rx="2" fill="${C.bois}" ${T()}/><rect x="39" y="3" width="18" height="8" rx="2.5" fill="${C.pierre}" ${T()}/></g>`,
  ),
  ventes: svg(
    ombre() +
      `<path d="M10 26h44l-4 26a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="${C.bois}" ${T()}/>` +
      `<path d="M14 36h36M15 45h34" stroke="${C.boisO}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M8 18h48v10H8z" fill="${C.rouge}" ${T()}/>` +
      `<path d="M16 18v10M24 18v10M32 18v10M40 18v10M48 18v10" stroke="${C.creme}" stroke-width="4"/>` +
      `<path d="M8 18h48v10H8z" fill="none" ${T()}/>` +
      piece(46, 44, 10),
  ),
  garage: svg(
    ombre(22) +
      `<path d="M12 40V28a4 4 0 0 1 4-4h14l4 10h12a4 4 0 0 1 4 4v6z" fill="${C.feuille}" ${T()}/>` +
      `<path d="M18 24v-8h11l4 18" fill="${C.ciel}" ${T()}/>` +
      reflet("M20 18h7l2 9h-9z") +
      `<circle cx="20" cy="45" r="10" fill="${C.trait}" /><circle cx="20" cy="45" r="7.5" fill="#6b5a4a"/><circle cx="20" cy="45" r="3.4" fill="${C.soleil}" ${T(2)}/>` +
      `<circle cx="46" cy="48" r="7" fill="${C.trait}" /><circle cx="46" cy="48" r="4.6" fill="#6b5a4a"/><circle cx="46" cy="48" r="2.2" fill="${C.soleil}"/>` +
      `<rect x="44" y="20" width="4" height="14" rx="1.5" fill="${C.pierre}" ${T(2.4)}/>`,
  ),
  bureau: svg(
    ombre(16) +
      `<rect x="14" y="10" width="36" height="46" rx="4" fill="${C.bois}" ${T()}/>` +
      `<rect x="18" y="16" width="28" height="36" rx="2" fill="${C.creme}" ${T(2.4)}/>` +
      `<rect x="24" y="6" width="16" height="9" rx="3" fill="${C.pierre}" ${T()}/>` +
      `<path d="M23 26h18M23 33h18M23 40h11" stroke="${C.cremeO}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M36 44l4 4 8-10" fill="none" stroke="${C.herbeO}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  personnel: svg(
    ombre(16) +
      `<path d="M14 56c0-12 8-18 18-18s18 6 18 18z" fill="${C.ciel}" ${T()}/>` +
      `<path d="M26 40l6 8 6-8" fill="${C.creme}" ${T(2.4)}/>` +
      `<circle cx="32" cy="27" r="11" fill="${C.peau}" ${T()}/>` +
      `<path d="M18 22c2-9 26-9 28 0z" fill="${C.soleil}" ${T()}/><path d="M14 23h36" ${T(3.4)}/>` +
      `<circle cx="28" cy="28" r="1.6" fill="${C.trait}"/><circle cx="36" cy="28" r="1.6" fill="${C.trait}"/>` +
      `<path d="M28 33q4 3 8 0" fill="none" stroke="${C.trait}" stroke-width="2" stroke-linecap="round"/>`,
  ),
  elevage: svg(
    ombre(16) +
      `<path d="M10 20c4-6 10-6 12-2M54 20c-4-6-10-6-12-2" fill="${C.creme}" ${T()}/>` +
      `<path d="M18 22c0-8 28-8 28 0v14c0 10-6 16-14 16s-14-6-14-16z" fill="${C.blanc}" ${T()}/>` +
      `<path d="M22 20c4 0 6 4 4 8s-6 2-6-2" fill="${C.trait}"/>` +
      `<ellipse cx="32" cy="44" rx="11" ry="8" fill="${C.rose}" ${T()}/>` +
      `<circle cx="28" cy="44" r="1.8" fill="${C.trait}"/><circle cx="36" cy="44" r="1.8" fill="${C.trait}"/>` +
      `<circle cx="25" cy="31" r="2" fill="${C.trait}"/><circle cx="39" cy="31" r="2" fill="${C.trait}"/>` +
      `<path d="M16 14l-2-6M48 14l2-6" stroke="${C.cremeO}" stroke-width="4" stroke-linecap="round"/>`,
  ),
  parcelle: svg(
    ombre(22) +
      `<path d="M6 40 32 26l26 14-26 14z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M14 40l18-10M20 43l18-10M26 46l18-10M32 49l18-10" stroke="${C.herbeO}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M32 38V10" ${T()}/><path d="M32 10l14 5-14 6z" fill="${C.rouge}" ${T()}/>`,
  ),
  competences: svg(
    ombre(14) +
      `<path d="M20 38 12 58l8-3 5 6 6-18zM44 38l8 20-8-3-5 6-6-18z" fill="${C.ciel}" ${T()}/>` +
      `<circle cx="32" cy="28" r="20" fill="${C.soleil}" ${T()}/>` +
      `<circle cx="32" cy="28" r="14" fill="none" stroke="${C.soleilO}" stroke-width="2.4"/>` +
      etoile(32, 28, 10, C.blanc),
  ),
  guide: svg(
    ombre(18) +
      `<path d="M10 14c8-3 16-3 22 2v40c-6-5-14-5-22-2z" fill="${C.ciel}" ${T()}/>` +
      `<path d="M54 14c-8-3-16-3-22 2v40c6-5 14-5 22-2z" fill="${C.cielO}" ${T()}/>` +
      `<path d="M15 23c4-1 8-1 12 1M15 31c4-1 8-1 12 1M37 24c4-2 8-2 12-1M37 32c4-2 8-2 12-1" stroke="${C.creme}" stroke-width="2.4" stroke-linecap="round"/>`,
  ),
  test: svg(
    ombre(14) +
      `<path d="M40 8a12 12 0 0 0-10 16L10 44a5 5 0 0 0 7 7l20-20a12 12 0 0 0 16-10l-7 3-5-5 3-7a12 12 0 0 0-4-4z" fill="${C.pierre}" ${T()}/>`,
  ),
  reglages: svg(
    ombre(16) +
      (() => {
        let d = "";
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          d += `<rect x="28" y="6" width="8" height="12" rx="2.5" transform="rotate(${(a * 180) / Math.PI} 32 30)" fill="${C.pierre}" ${T()}/>`;
        }
        return d;
      })() +
      `<circle cx="32" cy="30" r="17" fill="${C.pierre}" ${T()}/>` +
      `<circle cx="32" cy="30" r="7" fill="${C.creme}" ${T()}/>` +
      reflet("M20 26a13 13 0 0 1 8-8l1 3a10 10 0 0 0-6 6z"),
  ),
  plus: svg(
    `<rect x="10" y="10" width="19" height="19" rx="6" fill="${C.herbe}" ${T()}/><rect x="35" y="10" width="19" height="19" rx="6" fill="${C.soleil}" ${T()}/>` +
      `<rect x="10" y="35" width="19" height="19" rx="6" fill="${C.ciel}" ${T()}/><rect x="35" y="35" width="19" height="19" rx="6" fill="${C.rouge}" ${T()}/>`,
  ),
  fermer: svg(`<circle cx="32" cy="32" r="22" fill="${C.rouge}" ${T()}/><path d="M24 24l16 16M40 24 24 40" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/>` + reflet("M16 26a17 17 0 0 1 12-12l1 4a13 13 0 0 0-9 9z")),
  trace: svg(
    ombre(16) +
      `<path d="M10 50c10-14 20 4 30-10" fill="none" stroke="${C.terre}" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 7"/>` +
      `<g transform="rotate(45 40 24)"><rect x="35" y="4" width="10" height="34" rx="2" fill="${C.soleil}" ${T()}/><path d="M35 38h10l-5 9z" fill="${C.peau}" ${T()}/><rect x="35" y="4" width="10" height="7" rx="2" fill="${C.rose}" ${T()}/></g>`,
  ),
  rectangle: svg(
    ombre(18) +
      `<rect x="12" y="14" width="40" height="36" rx="4" fill="${C.herbe}" ${T()} stroke-dasharray="7 5"/>` +
      `<rect x="8" y="10" width="9" height="9" rx="2" fill="${C.blanc}" ${T()}/><rect x="47" y="45" width="9" height="9" rx="2" fill="${C.blanc}" ${T()}/>`,
  ),
  calendrier: svg(
    ombre(18) +
      `<rect x="10" y="12" width="44" height="42" rx="6" fill="${C.creme}" ${T()}/>` +
      `<path d="M10 18a6 6 0 0 1 6-6h32a6 6 0 0 1 6 6v8H10z" fill="${C.rouge}" ${T()}/>` +
      `<path d="M20 8v8M44 8v8" ${T(4)}/>` +
      `<circle cx="22" cy="36" r="3" fill="${C.herbeO}"/><circle cx="32" cy="36" r="3" fill="${C.soleilO}"/><circle cx="42" cy="36" r="3" fill="${C.cielO}"/><circle cx="22" cy="46" r="3" fill="${C.soleilO}"/><circle cx="32" cy="46" r="3" fill="${C.herbeO}"/>`,
  ),

  /* —— Outils des champs —— */
  voir: svg(
    ombre(16) +
      `<circle cx="27" cy="27" r="15" fill="${C.ciel}" ${T()}/><circle cx="27" cy="27" r="9.5" fill="#dff3ff" ${T(2.4)}/>` +
      reflet("M20 24a8 8 0 0 1 6-6l1 3a5 5 0 0 0-4 4z") +
      `<path d="M38 38l14 14" stroke="${C.trait}" stroke-width="10" stroke-linecap="round"/><path d="M38 38l14 14" stroke="${C.bois}" stroke-width="5" stroke-linecap="round"/>`,
  ),
  semer: svg(
    ombre(18) +
      `<path d="M16 28c0-4 4-6 16-6s16 2 16 6l2 22c0 4-6 6-18 6s-18-2-18-6z" fill="${C.cremeO}" ${T()}/>` +
      `<path d="M20 22c2-4 22-4 24 0" fill="none" ${T()}/>` +
      `<path d="M32 22V8" stroke="${C.feuilleO}" stroke-width="3.4" stroke-linecap="round"/>` +
      `<path d="M32 14c-8 0-12-4-12-9 7 0 12 3 12 9z" fill="${C.herbe}" ${T(2.4)}/>` +
      `<path d="M32 12c7-1 11-5 11-10-7 0-11 4-11 10z" fill="${C.feuille}" ${T(2.4)}/>` +
      `<circle cx="27" cy="40" r="2.4" fill="${C.terre}"/><circle cx="35" cy="37" r="2.4" fill="${C.terre}"/><circle cx="33" cy="46" r="2.4" fill="${C.terre}"/>`,
  ),
  sol: svg(
    ombre(22) +
      `<path d="M6 46c6-10 46-10 52 0v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="${C.terre}" ${T()}/>` +
      `<path d="M12 48c5-3 10-3 14 0M30 47c5-3 10-3 14 0M46 49c3-2 6-2 8 0" stroke="${C.terreO}" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
      `<g transform="rotate(-24 36 26)"><rect x="33" y="4" width="6" height="30" rx="2" fill="${C.bois}" ${T()}/><rect x="29" y="2" width="14" height="6" rx="3" fill="${C.bois}" ${T()}/>` +
      `<path d="M27 32h18v8a9 9 0 0 1-18 0z" fill="${C.pierre}" ${T()}/>` +
      reflet("M30 34h4v6a4 4 0 0 1-3-2z") + `</g>`,
  ),
  recolte: svg(
    ombre(18) +
      epi(24, 10, 40, -12) +
      epi(32, 6, 44, 0) +
      epi(40, 10, 40, 12) +
      `<path d="M18 42h28" stroke="${C.rouge}" stroke-width="7" stroke-linecap="round"/><path d="M18 42h28" ${T(2)} fill="none" opacity=".5"/>`,
  ),

  /* —— HUD —— */
  piece: svg(ombre(14) + piece(32, 31, 22)),
  etoile: svg(ombre(14) + etoile(32, 31, 24)),

  /* —— Catégories de construction —— */
  terrain: svg(
    ombre(22) +
      `<path d="M6 36 32 22l26 14-26 14z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M32 22l26 14-26 14z" fill="${C.terre}" ${T()}/>` +
      `<path d="M40 30l10 5M36 34l10 5M32 38l10 5" stroke="${C.terreO}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M6 36v6l26 14 26-14v-6" fill="none" ${T()}/><path d="M6 36v6l26 14v-6z" fill="${C.herbeO}" ${T()}/><path d="M58 36v6L32 56v-6z" fill="${C.terreO}" ${T()}/>`,
  ),
  agriculture: svg(ombre(18) + epi(20, 12, 40, -18) + epi(32, 6, 46, 0) + epi(44, 12, 40, 18)),
  batiments: svg(
    ombre(22) +
      `<path d="M10 30 32 14l22 16v24H10z" fill="${C.rouge}" ${T()}/>` +
      `<path d="M6 32 32 12l26 20" fill="none" ${T(4.4)}/>` +
      `<path d="M24 54V38h16v16" fill="${C.creme}" ${T()}/><path d="M24 38l16 16M40 38 24 54" stroke="${C.rougeO}" stroke-width="2.4"/>` +
      `<circle cx="32" cy="28" r="4.5" fill="${C.creme}" ${T(2.4)}/>` +
      reflet("M14 30 30 18v4L14 34z"),
  ),
  nature: svg(ombre(16) + arbreRond(32, 26, 17)),
  chemins: svg(
    ombre(22) +
      `<path d="M6 40 32 26l26 14-26 14z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M20 47c6-4 4-9 12-12s10-6 8-9h8c2 5-2 9-10 12s-6 8-10 12z" fill="${C.cremeO}" ${T(2.4)}/>` +
      `<ellipse cx="26" cy="44.5" rx="3.2" ry="1.8" fill="${C.pierre}" ${T(1.8)}/><ellipse cx="34" cy="37.5" rx="3.2" ry="1.8" fill="${C.pierre}" ${T(1.8)}/><ellipse cx="43" cy="31" rx="3" ry="1.7" fill="${C.pierre}" ${T(1.8)}/>`,
  ),
  decoration: svg(
    ombre(16) +
      `<path d="M18 38h28l-4 16a3 3 0 0 1-3 2H25a3 3 0 0 1-3-2z" fill="#e0754a" ${T()}/>` +
      `<rect x="15" y="34" width="34" height="7" rx="3" fill="#f08a5d" ${T()}/>` +
      `<path d="M26 34V22M32 34V14M38 34V22" stroke="${C.feuilleO}" stroke-width="3" stroke-linecap="round"/>` +
      [[26, 20, C.rose], [32, 12, C.soleil], [38, 20, C.violet]]
        .map(([x, y, f]) => [0, 90, 180, 270].map((a) => `<ellipse cx="${x}" cy="${y - 4}" rx="3" ry="4.2" transform="rotate(${a} ${x} ${y})" fill="${f}" ${T(1.8)}/>`).join("") + `<circle cx="${x}" cy="${y}" r="2.6" fill="${C.soleilO}" ${T(1.8)}/>`)
        .join("") +
      reflet("M20 36h12v2H20z"),
  ),

  /* —— Le catalogue —— */
  champ: svg(
    ombre(22) +
      `<path d="M6 38 32 24l26 14-26 14z" fill="${C.terre}" ${T()}/>` +
      `<path d="M14 38l18-10M20 41l18-10M26 44l18-10M32 47l18-10" stroke="${C.terreO}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M22 32v-6M30 28v-6M38 32v-6" stroke="${C.feuilleO}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<circle cx="22" cy="24" r="3.4" fill="${C.herbe}" ${T(2)}/><circle cx="30" cy="20" r="3.4" fill="${C.herbe}" ${T(2)}/><circle cx="38" cy="24" r="3.4" fill="${C.herbe}" ${T(2)}/>`,
  ),
  pre: svg(
    ombre(22) +
      `<path d="M6 38 32 24l26 14-26 14z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M18 38l2-6 2 6M30 42l2-7 2 7M40 36l2-6 2 6M26 32l2-5 2 5" stroke="${C.herbeO}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="36" cy="44" r="2.4" fill="${C.blanc}" ${T(1.6)}/><circle cx="22" cy="42" r="2.4" fill="${C.soleil}" ${T(1.6)}/>`,
  ),
  etang: svg(
    ombre(22) +
      `<path d="M8 38c0-8 12-14 24-14s24 6 24 14-12 14-24 14S8 46 8 38z" fill="${C.terre}" ${T()}/>` +
      `<path d="M13 38c0-6 9-10 19-10s19 4 19 10-9 10-19 10-19-4-19-10z" fill="${C.eau}" ${T(2.4)}/>` +
      `<path d="M20 36q6-4 12 0M32 42q6-4 12 0" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>` +
      `<path d="M50 30V16M46 32V20" stroke="${C.feuilleO}" stroke-width="2.6" stroke-linecap="round"/><rect x="48" y="12" width="4" height="8" rx="2" fill="${C.terre}" ${T(2)}/>`,
  ),
  "chemin-terre": svg(
    ombre(22) +
      `<path d="M6 38 32 24l26 14-26 14z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M14 42 40 28l10 5-26 14z" fill="${C.cremeO}" ${T(2.4)}/>` +
      `<path d="M22 41l14-7M27 44l14-7" stroke="${C.terre}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`,
  ),
  "chemin-gravier": svg(
    ombre(22) +
      `<path d="M6 38 32 24l26 14-26 14z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M14 42 40 28l10 5-26 14z" fill="#dcd6ca" ${T(2.4)}/>` +
      `<circle cx="24" cy="41" r="1.6" fill="${C.pierreO}"/><circle cx="30" cy="38" r="1.6" fill="${C.pierreO}"/><circle cx="36" cy="36" r="1.6" fill="${C.pierreO}"/><circle cx="29" cy="43" r="1.6" fill="${C.pierreO}"/><circle cx="41" cy="33" r="1.6" fill="${C.pierreO}"/>`,
  ),
  "chemin-pave": svg(
    ombre(22) +
      `<path d="M6 38 32 24l26 14-26 14z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M14 42 40 28l10 5-26 14z" fill="${C.pierre}" ${T(2.4)}/>` +
      `<path d="M19 44.5l26-14M22 38l5 3M28 35l5 3M34 32l5 3M26 42l5 3M32 39l5 3" stroke="${C.pierreO}" stroke-width="1.8" stroke-linecap="round"/>`,
  ),
  chene: svg(
    ombre(18) +
      `<path d="M28 42h8l2 14H26z" fill="${C.bois}" ${T()}/>` +
      `<path d="M16 38c-8 0-10-12-2-14-2-10 10-16 18-10 6-8 20-4 20 6 8 2 8 16-2 18-2 6-12 8-18 4-6 4-14 2-16-4z" fill="#3f9a45" ${T()}/>` +
      `<path d="M22 34c4 3 10 3 14 0M34 28c3 2 7 2 10 0" stroke="${C.feuilleO}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      reflet("M18 26c0-5 5-8 9-6-4 1-6 4-6 7z"),
  ),
  pommier: svg(
    ombre(16) +
      arbreRond(32, 25, 18, C.herbe, C.feuilleO) +
      `<circle cx="24" cy="24" r="3.2" fill="${C.rouge}" ${T(1.8)}/><circle cx="38" cy="20" r="3.2" fill="${C.rouge}" ${T(1.8)}/><circle cx="36" cy="33" r="3.2" fill="${C.rouge}" ${T(1.8)}/><circle cx="27" cy="34" r="3.2" fill="${C.rouge}" ${T(1.8)}/>`,
  ),
  sapin: svg(
    ombre(14) +
      `<rect x="29" y="46" width="6" height="10" rx="2" fill="${C.bois}" ${T()}/>` +
      `<path d="M32 6 18 26h7l-10 12h8l-9 11h36l-9-11h8L39 26h7z" fill="#3fa05a" ${T()}/>` +
      reflet("M31 12l-8 12h4z"),
  ),
  buisson: svg(
    ombre(20) +
      `<path d="M12 50c-6 0-6-10 0-12-2-8 8-12 12-6 2-8 16-8 16 0 4-6 14-2 12 6 6 2 6 12 0 12z" fill="${C.feuille}" ${T()}/>` +
      reflet("M18 40c0-4 4-6 8-4-4 0-6 2-8 4z"),
  ),
  fleurs: svg(
    ombre(18) +
      `<path d="M20 54V36M32 54V28M44 54V38" stroke="${C.feuilleO}" stroke-width="3" stroke-linecap="round"/>` +
      [[20, 34, C.rose], [32, 24, C.soleil], [44, 36, C.violet]]
        .map(
          ([x, y, f]) =>
            [0, 72, 144, 216, 288]
              .map((a) => `<ellipse cx="${x}" cy="${y - 5}" rx="3.4" ry="5" transform="rotate(${a} ${x} ${y})" fill="${f}" ${T(2)}/>`)
              .join("") + `<circle cx="${x}" cy="${y}" r="3.2" fill="${C.soleilO}" ${T(2)}/>`,
        )
        .join("") +
      `<path d="M14 54c4-6 8-6 10 0M38 54c4-6 8-6 10 0" fill="${C.herbe}" ${T(2.4)}/>`,
  ),
  rocher: svg(
    ombre(20) +
      `<path d="M10 52 16 30l14-12 16 6 10 16-2 12z" fill="${C.pierre}" ${T()}/>` +
      `<path d="M30 18 34 36l20 4M34 36 22 52" fill="none" stroke="${C.pierreO}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      reflet("M18 32 29 22l2 5-10 8z"),
  ),
  haie: svg(
    ombre(24) +
      `<rect x="6" y="26" width="52" height="26" rx="12" fill="${C.feuille}" ${T()}/>` +
      `<path d="M14 36c3-3 6-3 8 0M28 34c3-3 6-3 8 0M42 36c3-3 6-3 8 0M20 44c3-3 6-3 8 0M36 44c3-3 6-3 8 0" stroke="${C.feuilleO}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      reflet("M12 30h20v3H12z"),
  ),
  cloture: svg(
    ombre(24) +
      `<rect x="6" y="26" width="52" height="6" rx="2" fill="${C.bois}" ${T()}/><rect x="6" y="38" width="52" height="6" rx="2" fill="${C.bois}" ${T()}/>` +
      [12, 32, 52].map((x) => `<path d="M${x - 4} 54V20l4-5 4 5v34z" fill="${C.creme}" ${T()}/>`).join(""),
  ),
  banc: svg(
    ombre(20) +
      `<rect x="10" y="32" width="44" height="7" rx="3" fill="${C.bois}" ${T()}/>` +
      `<rect x="12" y="20" width="40" height="8" rx="3" fill="${C.bois}" ${T()}/>` +
      `<path d="M16 39v14M48 39v14M18 28v4M46 28v4" ${T(4)}/>`,
  ),
  lampadaire: svg(
    ombre(12) +
      `<path d="M32 22v32" ${T(5)}/><path d="M26 56h12" ${T(5)}/>` +
      `<circle cx="32" cy="17" r="11" fill="${C.soleil}" opacity=".35"/>` +
      `<path d="M24 12h16l-3 12H27z" fill="#fff6c8" ${T()}/><path d="M22 12h20l-10-6z" fill="${C.trait}" ${T()}/>`,
  ),
  "botte-foin": svg(
    ombre(20) +
      `<rect x="10" y="22" width="44" height="30" rx="6" fill="${C.soleil}" ${T()}/>` +
      `<path d="M16 30h32M16 38h32M16 46h32" stroke="${C.soleilO}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M24 22v30M40 22v30" stroke="${C.rouge}" stroke-width="3.4"/>` +
      reflet("M14 25h24v3H14z"),
  ),
  puits: svg(
    ombre(18) +
      `<path d="M14 38h36v14a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="${C.pierre}" ${T()}/>` +
      `<path d="M14 44h36M24 38v6M38 44v8M28 50h0" stroke="${C.pierreO}" stroke-width="2.4"/>` +
      `<path d="M18 38V18M46 38V18" ${T(4)}/>` +
      `<path d="M10 20 32 8l22 12z" fill="${C.rouge}" ${T()}/>` +
      `<path d="M22 26h20" ${T(3)}/><path d="M32 26v6" ${T(2)}/><rect x="28" y="31" width="8" height="6" rx="1.5" fill="${C.bois}" ${T(2)}/>`,
  ),
};


/* —— Les marchandises (écrites dans `goods/`, mêmes noms qu'avant) —— */
const epiCouleur = (x, y, h, rot, f, fo, barbes = false) => {
  let g = `<g transform="rotate(${rot} ${x} ${y + h})"><path d="M${x} ${y + h} V${y + 6}" stroke="${fo}" stroke-width="3" stroke-linecap="round"/>`;
  for (let k = 0; k < 4; k++) {
    const yy = y + 4 + k * 5;
    for (const sgn of [-1, 1]) {
      g += `<ellipse cx="${x + sgn * 3.2}" cy="${yy}" rx="3" ry="4.4" transform="rotate(${sgn * 28} ${x + sgn * 3.2} ${yy})" fill="${f}" ${T(2)}/>`;
      if (barbes) g += `<path d="M${x + sgn * 4} ${yy - 3} l${sgn * 6} -8" stroke="${fo}" stroke-width="1.6" stroke-linecap="round"/>`;
    }
  }
  return g + `<ellipse cx="${x}" cy="${y + 1}" rx="2.6" ry="4.2" fill="${f}" ${T(2)}/></g>`;
};
const MARCHANDISES = {
  wheat: svg(ombre(16) + epiCouleur(26, 10, 42, -12, C.soleil, C.soleilO) + epiCouleur(38, 10, 42, 12, C.soleil, C.soleilO)),
  barley: svg(ombre(16) + epiCouleur(26, 12, 40, -12, "#f3dc8a", "#c9a23a", true) + epiCouleur(38, 12, 40, 12, "#f3dc8a", "#c9a23a", true)),
  maize: svg(
    ombre(14) +
      `<ellipse cx="32" cy="28" rx="10" ry="20" fill="${C.soleil}" ${T()}/>` +
      Array.from({ length: 5 }, (_, i) => `<path d="M24 ${16 + i * 6}h16" stroke="${C.soleilO}" stroke-width="2" stroke-linecap="round"/>`).join("") +
      `<path d="M32 12v34" stroke="${C.soleilO}" stroke-width="2"/>` +
      `<path d="M32 56c-10-4-16-14-14-30 6 6 10 16 14 30z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M32 56c10-4 16-14 14-30-6 6-10 16-14 30z" fill="${C.feuille}" ${T()}/>`,
  ),
  rape: svg(
    ombre(14) +
      `<path d="M32 56V26M32 40l-10-8M32 36l10-8" stroke="${C.feuilleO}" stroke-width="3" stroke-linecap="round"/>` +
      [[32, 18], [22, 28], [42, 26], [27, 10], [38, 12]]
        .map(([x, y]) => [0, 90, 180, 270].map((a) => `<ellipse cx="${x}" cy="${y - 3.4}" rx="2.6" ry="3.6" transform="rotate(${a} ${x} ${y})" fill="${C.soleil}" ${T(1.6)}/>`).join("") + `<circle cx="${x}" cy="${y}" r="2" fill="${C.soleilO}"/>`)
        .join(""),
  ),
  pea: svg(
    ombre(18) +
      `<path d="M8 36c8-16 40-16 48 0-8 10-40 10-48 0z" fill="${C.herbe}" ${T()}/>` +
      `<circle cx="20" cy="34" r="5" fill="${C.feuille}" ${T(2)}/><circle cx="32" cy="32" r="5.4" fill="${C.feuille}" ${T(2)}/><circle cx="44" cy="34" r="5" fill="${C.feuille}" ${T(2)}/>` +
      reflet("M18 32a2 2 0 0 1 3-1v2zM30 30a2 2 0 0 1 3-1v2zM42 32a2 2 0 0 1 3-1v2z") +
      `<path d="M56 36c2-4 2-8 0-12" stroke="${C.feuilleO}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  ),
  mesclun: svg(
    ombre(18) +
      `<path d="M16 26c-4-10 8-14 12-6 2-10 16-8 14 2 8-4 14 6 6 10z" fill="${C.herbe}" ${T()}/>` +
      `<path d="M26 28c-2-8 10-10 10-2" fill="#c0395a" ${T(2)}/>` +
      `<path d="M8 32h48c0 14-10 22-24 22S8 46 8 32z" fill="${C.creme}" ${T()}/>` +
      `<path d="M14 38h36" stroke="${C.cremeO}" stroke-width="2.4" stroke-linecap="round"/>`,
  ),
  radish: svg(
    ombre(12) +
      `<path d="M32 22c-6-8-14-10-16-6 4 2 10 4 16 6zM32 22c6-8 14-10 16-6-4 2-10 4-16 6zM32 22c0-10 2-14 6-16 0 6-2 12-6 16z" fill="${C.feuille}" ${T(2.4)}/>` +
      `<path d="M32 22c10 0 14 8 12 16-2 8-8 12-12 18-4-6-10-10-12-18-2-8 2-16 12-16z" fill="#e8436b" ${T()}/>` +
      reflet("M24 30c1-4 4-6 8-6-3 2-5 4-6 8z"),
  ),
  spinach: svg(
    ombre(16) +
      `<path d="M32 56 20 30c-4-10 4-20 12-22 8 2 16 12 12 22z" fill="#2f8f3a" ${T()}/>` +
      `<path d="M32 56V14M32 30l-7-6M32 38l8-7" stroke="#1f6127" stroke-width="2.4" stroke-linecap="round"/>` +
      reflet("M24 26c0-6 4-11 8-13-2 4-4 8-4 13z"),
  ),
  lettuce: svg(
    ombre(18) +
      `<circle cx="32" cy="34" r="20" fill="${C.herbe}" ${T()}/>` +
      `<path d="M20 30c4-10 20-10 24 0M18 40c6-6 22-6 28 0M26 24c2-6 10-6 12 0" stroke="${C.herbeO}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      reflet("M18 30a15 15 0 0 1 8-10l1 3a12 12 0 0 0-6 8z"),
  ),
  potato: svg(
    ombre(20) +
      `<ellipse cx="24" cy="38" rx="14" ry="11" transform="rotate(-15 24 38)" fill="#c8955a" ${T()}/>` +
      `<ellipse cx="42" cy="34" rx="11" ry="9" transform="rotate(20 42 34)" fill="#d8a86c" ${T()}/>` +
      `<circle cx="20" cy="36" r="1.4" fill="${C.terreO}"/><circle cx="27" cy="42" r="1.4" fill="${C.terreO}"/><circle cx="42" cy="32" r="1.4" fill="${C.terreO}"/><circle cx="46" cy="37" r="1.4" fill="${C.terreO}"/>`,
  ),
  hay: svg(
    ombre(22) +
      `<path d="M8 52c2-18 12-30 24-30s22 12 24 30z" fill="#d6c257" ${T()}/>` +
      `<path d="M16 48c2-8 6-14 10-18M28 50c0-8 2-16 6-22M40 50c-1-8-2-12-4-18M48 48c-2-6-4-10-8-14" stroke="#a8932c" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
      reflet("M16 40c2-8 8-14 14-16-4 4-8 10-10 16z"),
  ),
  milk: svg(
    ombre(12) +
      `<path d="M24 16h16v6l4 8v22a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V30l4-8z" fill="${C.blanc}" ${T()}/>` +
      `<rect x="23" y="10" width="18" height="7" rx="2.5" fill="${C.ciel}" ${T()}/>` +
      `<path d="M20 36h24v10H20z" fill="${C.ciel}" ${T(2.4)}/>` +
      reflet("M25 30h3v18h-3z"),
  ),
  meat: svg(
    ombre(18) +
      `<path d="M14 24c6-12 26-14 34-4 8 10 2 26-12 28-12 2-26-10-22-24z" fill="#e0604f" ${T()}/>` +
      `<path d="M20 28c6-8 20-8 24 0" stroke="${C.creme}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="30" cy="36" rx="4" ry="3" fill="${C.creme}" ${T(2)}/>` +
      reflet("M18 24c3-5 8-8 13-8-4 2-8 5-10 9z"),
  ),
  eggs: svg(
    ombre(20) +
      `<ellipse cx="24" cy="30" rx="8" ry="10" fill="${C.creme}" ${T()}/><ellipse cx="40" cy="30" rx="8" ry="10" fill="#f1d4ad" ${T()}/><ellipse cx="32" cy="26" rx="8" ry="10" fill="${C.blanc}" ${T()}/>` +
      `<path d="M10 34h44l-4 16a4 4 0 0 1-4 3H18a4 4 0 0 1-4-3z" fill="${C.bois}" ${T()}/>` +
      `<path d="M16 40h32M17 46h30" stroke="${C.boisO}" stroke-width="2.2" stroke-linecap="round"/>`,
  ),
  wool: svg(
    ombre(18) +
      `<circle cx="32" cy="32" r="20" fill="#f3efe6" ${T()}/>` +
      `<path d="M16 24c10 4 22 4 32 0M14 34c12 6 24 6 36 0M20 46c8-6 16-8 26-6M26 14c-4 10-4 26 2 36" stroke="#cfc6b3" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M50 44c6 4 8 10 4 14" stroke="${C.trait}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  ),
  manure: svg(
    ombre(20) +
      `<path d="M12 52c-4-6 2-12 8-12-2-6 4-12 10-10 2-8 14-8 14 2 8 0 12 10 6 16 4 4 0 8-4 8H16c-2 0-4-2-4-4z" fill="#7a4a24" ${T()}/>` +
      `<path d="M22 44c4 2 10 2 14 0M30 36c3 2 7 2 10 0" stroke="#4e2c12" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<path d="M22 22c-2-4 2-6 0-10M32 18c-2-4 2-6 0-10M42 22c-2-4 2-6 0-10" stroke="${C.pierreO}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".8"/>`,
  ),
  straw: svg(
    ombre(18) +
      `<path d="M18 54 26 10M24 54l6-44M30 54l4-44M36 54V10M42 54 38 10M46 54l-4-44" stroke="#e8cf73" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M18 54 26 10M24 54l6-44M30 54l4-44M36 54V10M42 54 38 10M46 54l-4-44" stroke="${C.trait}" stroke-width="1" stroke-linecap="round" opacity=".35"/>` +
      `<path d="M20 32h26" stroke="${C.rouge}" stroke-width="5" stroke-linecap="round"/>`,
  ),
  "straw-bale": svg(
    ombre(20) +
      `<rect x="10" y="22" width="44" height="30" rx="6" fill="#efd97e" ${T()}/>` +
      `<path d="M16 30h32M16 38h32M16 46h32" stroke="#c9ab3e" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M24 22v30M40 22v30" stroke="${C.boisO}" stroke-width="3.4"/>` +
      reflet("M14 25h24v3H14z"),
  ),
  silage: svg(
    ombre(22) +
      `<ellipse cx="32" cy="36" rx="22" ry="16" fill="#eef3ea" ${T()}/>` +
      `<ellipse cx="18" cy="36" rx="6" ry="15" fill="#d9e4d2" ${T(2.4)}/>` +
      `<path d="M26 22c2 10 2 18 0 28M36 21c2 10 2 20 0 30M46 24c2 8 2 16 0 24" stroke="#b8c7ae" stroke-width="2.4" fill="none"/>` +
      reflet("M26 24h16v3H26z"),
  ),
  cheese: svg(
    ombre(20) +
      `<path d="M8 40 40 18l16 14v16H8z" fill="${C.soleil}" ${T()}/>` +
      `<path d="M8 40h48" ${T()}/>` +
      `<circle cx="22" cy="46" r="3" fill="${C.soleilO}"/><circle cx="38" cy="44" r="2.4" fill="${C.soleilO}"/><circle cx="48" cy="48" r="2" fill="${C.soleilO}"/><circle cx="36" cy="30" r="2.6" fill="${C.soleilO}"/>`,
  ),
  flour: svg(
    ombre(16) +
      `<path d="M18 18c4-4 24-4 28 0l4 32c0 4-8 6-18 6s-18-2-18-6z" fill="${C.creme}" ${T()}/>` +
      `<path d="M20 18c2-6 22-6 24 0" fill="none" ${T()}/><path d="M26 12c4 4 8 4 12 0" stroke="${C.boisO}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
      epiCouleur(32, 26, 22, 0, C.soleil, C.soleilO).replace(/stroke-width="2"/g, 'stroke-width="1.6"'),
  ),
};
const SORTIE_MARCHANDISES = path.join(ICI, "..", "public", "assets", "icons", "goods");

fs.mkdirSync(SORTIE, { recursive: true });
for (const [nom, contenu] of Object.entries(ICONES)) fs.writeFileSync(path.join(SORTIE, `${nom}.svg`), contenu);
for (const [nom, contenu] of Object.entries(MARCHANDISES)) fs.writeFileSync(path.join(SORTIE_MARCHANDISES, `${nom}.svg`), contenu);
console.log(`${Object.keys(ICONES).length} icônes → ${path.relative(process.cwd(), SORTIE)}`);
console.log(`${Object.keys(MARCHANDISES).length} marchandises → ${path.relative(process.cwd(), SORTIE_MARCHANDISES)}`);
