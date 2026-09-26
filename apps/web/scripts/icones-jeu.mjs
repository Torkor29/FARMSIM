/**
 * Les pictogrammes de l'interface : navigation, outils, catégories, bandeau.
 *
 * Un seul trait, une seule couleur, sur une grille de 24 : c'est le langage
 * des simulateurs de ferme, où la scène est riche et l'interface se tait. Les
 * autocollants colorés d'avant faisaient jeu d'enfant ; ce qui montre un objet
 * (le catalogue de construction) montre désormais le modèle 3D lui-même —
 * voir `scripts/vignettes/`.
 *
 * Les glyphes sont tracés en brun-vert sombre ; l'interface les passe en blanc
 * sur un bouton actif par un filtre CSS.
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

const ENCRE = "#2f3a2c";
const svg = (corps) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${ENCRE}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corps}</svg>\n`;
const plein = (d) => `<path d="${d}" fill="${ENCRE}" stroke="none"/>`;

/** Un épi : une tige et deux rangs de grains. */
const epi = (x, y, h) => {
  let s = `<path d="M${x} ${y + h}V${y + 1.5}"/>`;
  for (let k = 0; k < 4; k++) {
    const yy = y + 2.6 + k * 2.7;
    s += `<path d="M${x - 2.3} ${yy}l2.3 1.9 2.3-1.9"/>`;
  }
  return s;
};

const ICONES = {
  /* —— Navigation —— */
  construire: svg(
    `<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9v11h14V9"/><path d="M9.5 20v-6h5v6"/><path d="M9.5 14l5 6M14.5 14l-5 6"/>`,
  ),
  ventes: svg(`<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/><circle cx="12" cy="4" r="1"/>`),
  garage: svg(
    `<circle cx="7" cy="16" r="3.6"/><circle cx="7" cy="16" r="1"/><circle cx="18.2" cy="17.2" r="2.3"/><path d="M3.4 14.5V9h6.2l1.6 5h6.3l2.2 1.5"/><path d="M5 9V5h4.4l.9 4"/><path d="M15.5 14V8.5"/>`,
  ),
  bureau: svg(`<rect x="5" y="4.5" width="14" height="16.5" rx="1.6"/><path d="M9 4.5V3h6v1.5"/><path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4"/>`),
  personnel: svg(`<circle cx="12" cy="8.5" r="3.4"/><path d="M7.6 6.2h8.8M9.3 6.2c.2-1.8 1.3-2.7 2.7-2.7s2.5.9 2.7 2.7"/><path d="M4.8 20.5c.6-3.8 3.5-6 7.2-6s6.6 2.2 7.2 6"/>`),
  elevage: svg(
    `<path d="M7 7.5C5 7.5 3.5 6.5 3.2 4.8M17 7.5c2 0 3.5-1 3.8-2.7"/><path d="M6.5 7.5h11V13c0 3.6-2.4 6.5-5.5 6.5S6.5 16.6 6.5 13z"/><ellipse cx="12" cy="15.6" rx="3.6" ry="2.4"/>` +
      plein("M9.2 11.2a.9.9 0 1 1 0 .01zM14.8 11.2a.9.9 0 1 1 0 .01z"),
  ),
  parcelle: svg(`<path d="M2.5 15.5 12 11l9.5 4.5L12 20z"/><path d="M12 15V3.5l5 2-5 2"/>`),
  competences: svg(`<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7.3 21l4.7-2.6 4.7 2.6-1.3-7.6"/><path d="m12 6.3.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z"/>`),
  guide: svg(`<path d="M3 5.5c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6.5v13"/>`),
  test: svg(`<path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.7-7.7a4 4 0 0 1-2-2zM14.7 6.3 17 4"/>`),
  reglages: svg(
    `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
  ),
  plus: svg(`<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>`),
  fermer: svg(`<path d="M6 6l12 12M18 6 6 18"/>`),
  trace: svg(`<path d="M4 20c3-5 6 1 9-4"/><path d="M14.5 13.5 20 8a1.8 1.8 0 0 0-2.5-2.5L12 11l-.6 3.1z"/>`),
  rectangle: svg(`<rect x="4.5" y="5.5" width="15" height="13" rx="1" stroke-dasharray="3 2.4"/><circle cx="4.5" cy="5.5" r="1.3" fill="${ENCRE}"/><circle cx="19.5" cy="18.5" r="1.3" fill="${ENCRE}"/>`),
  calendrier: svg(`<rect x="3.5" y="5" width="17" height="15.5" rx="1.6"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>`),

  /* —— Outils des champs —— */
  voir: svg(`<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5.5 5.5"/>`),
  semer: svg(`<path d="M3.5 20h17"/><path d="M12 20v-7"/><path d="M12 13c0-3.5-2.4-5.5-6.3-5.5 0 3.6 2.4 5.5 6.3 5.5zM12 11c0-3 2-4.8 5.4-4.8 0 3.1-2 4.8-5.4 4.8z"/>`),
  sol: svg(`<path d="M3.5 20.5h17"/><path d="M14 3.5v9.5"/><path d="M12 3.5h4"/><path d="M10.2 13h7.6v2.2a3.8 3.8 0 0 1-7.6 0z"/><path d="M5 17.5c1.4-.7 2.8-.7 4 0"/>`),
  recolte: svg(epi(8.5, 3.5, 17) + epi(15.5, 3.5, 17) + `<path d="M6 15.5h12"/>`),

  /* —— Bandeau —— */
  piece: svg(`<circle cx="12" cy="12" r="8.5"/><path d="M15 9a4 4 0 1 0 0 6M8 11h5M8 13.2h5"/>`),
  etoile: svg(`<path d="m12 3.5 2.6 5.3 5.9.8-4.3 4.1 1 5.8L12 16.7l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>`),

  /* —— Catégories de construction —— */
  terrain: svg(`<path d="M2.5 12 12 7.5l9.5 4.5L12 16.5z"/><path d="M2.5 12v3.5L12 20l9.5-4.5V12"/><path d="M12 16.5V20"/>`),
  agriculture: svg(epi(12, 3, 18) + `<path d="M7 21c0-3 1.4-5 3-6M17 21c0-3-1.4-5-3-6"/>`),
  batiments: svg(`<path d="M3 11 12 4l9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5.5h5V20"/><path d="M9.5 14.5l5 5.5M14.5 14.5 9.5 20"/><circle cx="12" cy="10.3" r="1.5"/>`),
  nature: svg(`<path d="M12 21v-6"/><path d="M12 15c-4.2 0-7-2.3-7-5.6 0-2.6 2-4.4 4.1-4.6C9.8 3.7 10.8 3 12 3s2.2.7 2.9 1.8c2.1.2 4.1 2 4.1 4.6 0 3.3-2.8 5.6-7 5.6z"/>`),
  chemins: svg(`<path d="M8 21c.8-4 3.4-5.2 4.2-8.5.6-2.5-.8-4.5-.2-8.5"/><path d="M16.5 21c-.4-3.6-2.6-6-2.2-9 .3-2.7 1.7-4.6 1.4-8"/>`),
  decoration: svg(`<path d="M4 11.5h16M5 7.5h14"/><path d="M6 11.5V18M18 11.5V18M7.5 7.5v4M16.5 7.5v4"/><path d="M4 15h16"/>`),
};

fs.mkdirSync(SORTIE, { recursive: true });
for (const f of fs.readdirSync(SORTIE)) if (f.endsWith(".svg") && !(f.replace(".svg", "") in ICONES)) fs.rmSync(path.join(SORTIE, f));
for (const [nom, contenu] of Object.entries(ICONES)) fs.writeFileSync(path.join(SORTIE, `${nom}.svg`), contenu);
console.log(`${Object.keys(ICONES).length} pictogrammes → ${path.relative(process.cwd(), SORTIE)}`);
