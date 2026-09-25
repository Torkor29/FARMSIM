import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { jouerSon } from "./audio";
import {
  GRAISSEURS,
  TOLERANCE_GRAISSE,
  VITESSE_ROUE,
  etoilesGraissage,
  etoilesLavage,
} from "./atelier-notes";

/**
 * Les deux jeux d'atelier, dessinés — pas des ronds posés sur une photo.
 *
 * « Les jeux sont horribles. » La pompe à jauge et le grattage d'une couche de
 * boue étaient des gestes, mais pas des jeux : rien à viser, rien à rater,
 * rien qui réponde. Ils deviennent deux petites scènes d'arcade, dans le trait
 * du jeu, qui se jouent en une dizaine de secondes :
 *
 * - **la roue à graisser** : la roue tourne, le pistolet est en haut ; on
 *   tire quand un graisseur passe sous la buse. Elle accélère et change de
 *   sens à mesure qu'on réussit, et un tir raté laisse une tache ;
 * - **la station de lavage** : le tracteur entre couvert de paquets de boue ;
 *   on tient la lance et on vise. Chaque paquet tremble, rétrécit et éclate
 *   en gouttes ; la boue sèche tient plus longtemps. Propre, il brille et
 *   repart.
 */

type Particule = { x: number; y: number; vx: number; vy: number; vie: number; duree: number; couleur: string; taille: number };

/** Une toile qui suit la largeur de sa carte, nette sur écran dense. */
function useToile(
  ratio: number,
  dessiner: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => void,
) {
  const toile = useRef<HTMLCanvasElement>(null);
  const dessin = useRef(dessiner);
  dessin.current = dessiner;
  useEffect(() => {
    const c = toile.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    const taille = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, c.clientWidth);
      h = Math.round(w / ratio);
      c.style.height = `${h}px`;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    taille();
    const ro = new ResizeObserver(taille);
    ro.observe(c);
    let raf = 0;
    let avant = performance.now();
    const boucle = (now: number) => {
      const dt = Math.min(0.05, (now - avant) / 1000);
      avant = now;
      dessin.current(ctx, w, h, now / 1000, dt);
      raf = requestAnimationFrame(boucle);
    };
    raf = requestAnimationFrame(boucle);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ratio]);
  return toile;
}

function animerParticules(ctx: CanvasRenderingContext2D, ps: Particule[], dt: number, sol: number) {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]!;
    p.vie += dt;
    if (p.vie >= p.duree) {
      ps.splice(i, 1);
      continue;
    }
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > sol) {
      p.y = sol;
      p.vy *= -0.25;
      p.vx *= 0.6;
    }
    ctx.globalAlpha = 1 - p.vie / p.duree;
    ctx.fillStyle = p.couleur;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.taille, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function gerbe(ps: Particule[], x: number, y: number, n: number, couleurs: string[], force = 260) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = force * (0.35 + Math.random() * 0.8);
    ps.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - force * 0.6,
      vie: 0,
      duree: 0.5 + Math.random() * 0.5,
      couleur: couleurs[i % couleurs.length]!,
      taille: 2 + Math.random() * 3,
    });
  }
}

function texteFlottant(
  ctx: CanvasRenderingContext2D,
  textes: { x: number; y: number; t: string; vie: number; couleur: string }[],
  dt: number,
) {
  ctx.textAlign = "center";
  ctx.font = "800 18px 'Baloo 2', Nunito, sans-serif";
  for (let i = textes.length - 1; i >= 0; i--) {
    const f = textes[i]!;
    f.vie += dt;
    if (f.vie > 0.9) {
      textes.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = 1 - f.vie / 0.9;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeText(f.t, f.x, f.y - f.vie * 40);
    ctx.fillStyle = f.couleur;
    ctx.fillText(f.t, f.x, f.y - f.vie * 40);
  }
  ctx.globalAlpha = 1;
}

/** Le bandeau du haut : un compteur à gauche, un indicateur à droite. */
function bandeau(ctx: CanvasRenderingContext2D, w: number, gauche: string, droite: string) {
  ctx.font = "800 15px 'Baloo 2', Nunito, sans-serif";
  ctx.textBaseline = "middle";
  const pastille = (x: number, texte: string, aligne: "left" | "right") => {
    const l = ctx.measureText(texte).width + 22;
    const x0 = aligne === "left" ? x : x - l;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(x0, 10, l, 28, 14);
    ctx.fill();
    ctx.fillStyle = "#1f4d3d";
    ctx.textAlign = "left";
    ctx.fillText(texte, x0 + 11, 25);
  };
  pastille(10, gauche, "left");
  if (droite) pastille(w - 10, droite, "right");
  ctx.textBaseline = "alphabetic";
}

/* ------------------------------------------------------------------ */
/* La roue à graisser                                                  */
/* ------------------------------------------------------------------ */

export function JeuGraissage({ onFini }: { onFini: (etoiles: number) => void }) {
  const etat = useRef({
    angle: 0,
    vitesse: VITESSE_ROUE,
    sens: 1,
    faits: Array.from({ length: GRAISSEURS }, () => false),
    taches: [] as { a: number; r: number }[],
    rates: 0,
    tir: -1,
    secousse: 0,
    fini: false,
    finiDepuis: 0,
    particules: [] as Particule[],
    textes: [] as { x: number; y: number; t: string; vie: number; couleur: string }[],
    lueur: 0,
  });
  const fin = useRef(onFini);
  fin.current = onFini;

  const toile = useToile(4 / 3.1, (ctx, w, h, t, dt) => {
    const e = etat.current;
    const cx = w / 2;
    const cy = h * 0.62;
    const R = Math.min(w, h) * 0.36;
    const rG = R * 0.5; // rayon des graisseurs sur la jante

    if (!e.fini) e.angle += e.vitesse * e.sens * dt;
    else {
      e.finiDepuis += dt;
      e.vitesse *= 1 - Math.min(1, dt * 1.6);
      e.angle += e.vitesse * e.sens * dt;
    }
    e.secousse = Math.max(0, e.secousse - dt);
    e.lueur = Math.max(0, e.lueur - dt * 2.5);

    const sx = e.secousse > 0 ? Math.sin(t * 90) * 5 * (e.secousse / 0.2) : 0;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(sx, 0);

    // L'atelier : un mur chaud, un établi, le sol.
    const fond = ctx.createLinearGradient(0, 0, 0, h);
    fond.addColorStop(0, "#f6ead2");
    fond.addColorStop(0.72, "#ead7b3");
    fond.addColorStop(0.72, "#b99b6e");
    fond.addColorStop(1, "#a88a5f");
    ctx.fillStyle = fond;
    ctx.fillRect(-10, 0, w + 20, h);
    ctx.fillStyle = "rgba(120, 90, 50, 0.08)";
    for (let x = 0; x < w; x += 46) ctx.fillRect(x, 0, 2, h * 0.72);

    // L'ombre de la roue.
    ctx.fillStyle = "rgba(60, 40, 20, 0.22)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + R * 1.02, R * 0.95, R * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Le pneu et ses crampons.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(e.angle);
    ctx.fillStyle = "#2c2c2e";
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c1c1e";
    for (let k = 0; k < 18; k++) {
      ctx.save();
      ctx.rotate((k / 18) * Math.PI * 2);
      ctx.beginPath();
      ctx.roundRect(-R * 0.09, -R * 1.05, R * 0.18, R * 0.16, 3);
      ctx.fill();
      ctx.restore();
    }
    // La jante jaune.
    ctx.fillStyle = "#f2c230";
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c99a1c";
    ctx.lineWidth = R * 0.05;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.64, 0, Math.PI * 2);
    ctx.stroke();
    // Le moyeu et ses goujons.
    ctx.fillStyle = "#56585c";
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8d9095";
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.17, Math.sin(a) * R * 0.17, R * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#3a3b3e";
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Les taches des tirs ratés, qui tournent avec la roue.
    for (const s of e.taches) {
      ctx.fillStyle = "rgba(170, 120, 20, 0.85)";
      ctx.beginPath();
      ctx.ellipse(Math.cos(s.a) * s.r, Math.sin(s.a) * s.r, R * 0.1, R * 0.07, s.a, 0, Math.PI * 2);
      ctx.fill();
    }
    // Les graisseurs.
    for (let i = 0; i < GRAISSEURS; i++) {
      const a = (i / GRAISSEURS) * Math.PI * 2;
      const gx = Math.cos(a) * rG;
      const gy = Math.sin(a) * rG;
      ctx.fillStyle = "#7d8288";
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const b = (k / 6) * Math.PI * 2;
        ctx.lineTo(gx + Math.cos(b) * R * 0.075, gy + Math.sin(b) * R * 0.075);
      }
      ctx.closePath();
      ctx.fill();
      if (e.faits[i]) {
        // Graissé : une pastille verte cochée — le doré se perdait sur la jante.
        ctx.fillStyle = "#3f9a5b";
        ctx.beginPath();
        ctx.arc(gx, gy, R * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(-e.angle);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = R * 0.022;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(-R * 0.03, 0);
        ctx.lineTo(-R * 0.005, R * 0.025);
        ctx.lineTo(R * 0.035, -R * 0.025);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = "#d8412c";
        ctx.beginPath();
        ctx.arc(gx, gy, R * 0.042, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // La zone de tir : un arc en haut, qui s'allume quand un graisseur sec y passe.
    const dansZone = cibleSousLaBuse(e);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = dansZone >= 0 ? "rgba(63, 154, 91, 0.95)" : "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = R * 0.2;
    ctx.lineCap = "round";
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, rG, -Math.PI / 2 - TOLERANCE_GRAISSE, -Math.PI / 2 + TOLERANCE_GRAISSE);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Le pistolet à graisse, fixe en haut.
    const buseY = cy - rG - R * 0.1;
    const recul = e.tir >= 0 && t - e.tir < 0.12 ? 6 : 0;
    ctx.fillStyle = "#b9bec4";
    ctx.beginPath();
    ctx.roundRect(cx - R * 0.55, h * 0.06 - recul, R * 0.95, R * 0.2, 8);
    ctx.fill();
    ctx.fillStyle = "#c8402f";
    ctx.beginPath();
    ctx.roundRect(cx + R * 0.35, h * 0.06 - recul, R * 0.32, R * 0.42, 8);
    ctx.fill();
    ctx.fillStyle = "#8f2a1e";
    ctx.beginPath();
    ctx.roundRect(cx + R * 0.44, h * 0.06 + R * 0.34 - recul, R * 0.14, R * 0.3, 5);
    ctx.fill();
    ctx.strokeStyle = "#4a4d52";
    ctx.lineWidth = R * 0.07;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.06 + R * 0.18 - recul);
    ctx.lineTo(cx, buseY - R * 0.05);
    ctx.stroke();
    ctx.fillStyle = "#2f3033";
    ctx.beginPath();
    ctx.arc(cx, buseY - R * 0.04, R * 0.05, 0, Math.PI * 2);
    ctx.fill();
    // La noix de graisse qui part au tir.
    if (e.tir >= 0 && t - e.tir < 0.14) {
      const u = (t - e.tir) / 0.14;
      ctx.fillStyle = "#e9b23a";
      ctx.beginPath();
      ctx.arc(cx, buseY + u * R * 0.12, R * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    animerParticules(ctx, e.particules, dt, h * 0.95);
    texteFlottant(ctx, e.textes, dt);
    ctx.restore();

    const faits = e.faits.filter(Boolean).length;
    bandeau(ctx, w, `Graisseurs ${faits}/${GRAISSEURS}`, e.rates ? `Ratés ${e.rates}` : "");
    if (e.fini) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.5, e.finiDepuis)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center";
      ctx.font = "900 28px 'Baloo 2', Nunito, sans-serif";
      ctx.fillStyle = "#2f7d4a";
      ctx.fillText(e.rates ? "Graissé !" : "Graissage parfait !", w / 2, h * 0.3);
    }
    const c = toile.current;
    if (c) {
      c.dataset.cible = dansZone >= 0 ? "1" : "0";
      c.dataset.faits = String(faits);
    }
  });

  function tirer() {
    const e = etat.current;
    if (e.fini) return;
    const t = performance.now() / 1000;
    if (e.tir >= 0 && t - e.tir < 0.18) return;
    e.tir = t;
    jouerSon("clic");
    const c = toile.current;
    const w = c?.clientWidth ?? 300;
    const h = c?.clientHeight ?? 230;
    const R = Math.min(w, h) * 0.36;
    const cx = w / 2;
    const cy = h * 0.62;
    const hautX = cx;
    const hautY = cy - R * 0.5;
    const i = cibleSousLaBuse(e);
    if (i >= 0) {
      e.faits[i] = true;
      e.lueur = 1;
      gerbe(e.particules, hautX, hautY, 14, ["#f2c230", "#e9b23a", "#fff3c4"], 220);
      e.textes.push({ x: hautX, y: hautY - 16, t: "+1", vie: 0, couleur: "#2f7d4a" });
      jouerSon("piece");
      const faits = e.faits.filter(Boolean).length;
      // La roue accélère à chaque réussite, et change de sens deux fois.
      e.vitesse *= 1.16;
      if (faits === 2 || faits === 4) e.sens *= -1;
      if (faits >= GRAISSEURS) {
        e.fini = true;
        gerbe(e.particules, cx, cy, 30, ["#f2c230", "#3f9a5b", "#ffffff"], 320);
        fin.current(etoilesGraissage(e.rates));
      }
    } else {
      e.rates += 1;
      e.secousse = 0.2;
      // La graisse atterrit sur la jante, là où la buse visait.
      e.taches.push({ a: -Math.PI / 2 - e.angle, r: R * 0.5 });
      gerbe(e.particules, hautX, hautY, 8, ["#b8851c", "#8a6414"], 160);
      e.textes.push({ x: hautX, y: hautY - 16, t: "Raté", vie: 0, couleur: "#b23a1f" });
      jouerSon("refus");
    }
  }

  return (
    <canvas
      ref={toile}
      className="care-jeu"
      tabIndex={0}
      aria-label="Roue à graisser : touchez quand un graisseur rouge passe sous le pistolet"
      onPointerDown={(ev) => {
        ev.preventDefault();
        tirer();
      }}
      onKeyDown={(ev) => {
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          if (!ev.repeat) tirer();
        }
      }}
      onContextMenu={(ev) => ev.preventDefault()}
    />
  );
}

/** Le graisseur sec qui passe sous la buse, ou -1. */
function cibleSousLaBuse(e: { angle: number; faits: boolean[] }): number {
  for (let i = 0; i < GRAISSEURS; i++) {
    if (e.faits[i]) continue;
    const a = (i / GRAISSEURS) * Math.PI * 2 + e.angle;
    let d = (a - -Math.PI / 2) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) <= TOLERANCE_GRAISSE) return i;
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* La station de lavage                                                */
/* ------------------------------------------------------------------ */

/** Les paquets de boue, en coordonnées du tracteur (il mesure 260 × 185). */
const PAQUETS: { x: number; y: number; r: number; sec?: boolean }[] = [
  { x: 60, y: -58, r: 24, sec: true },
  { x: 205, y: -38, r: 17 },
  { x: 28, y: -92, r: 15 },
  { x: 96, y: -76, r: 17 },
  { x: 142, y: -70, r: 15, sec: true },
  { x: 186, y: -82, r: 14 },
  { x: 232, y: -68, r: 12 },
  { x: 160, y: -95, r: 12 },
  { x: 62, y: -128, r: 13 },
];

type Paquet = { x: number; y: number; r: number; pv: number; pvMax: number; bosses: number[]; eclate: boolean };

function dessinerTracteur(ctx: CanvasRenderingContext2D, rotRoues: number, brille: number) {
  const vert = "#3f9a3a";
  const vertFonce = "#2c7429";
  // Châssis.
  ctx.fillStyle = "#3b3d41";
  ctx.fillRect(36, -64, 196, 16);
  // Capot.
  ctx.fillStyle = vert;
  ctx.beginPath();
  ctx.roundRect(108, -104, 136, 50, [14, 18, 6, 6]);
  ctx.fill();
  ctx.fillStyle = vertFonce;
  ctx.fillRect(108, -62, 136, 8);
  // Calandre et phare.
  ctx.fillStyle = "#26282b";
  ctx.beginPath();
  ctx.roundRect(228, -98, 16, 38, 4);
  ctx.fill();
  ctx.fillStyle = "#fff2b0";
  ctx.beginPath();
  ctx.roundRect(232, -96, 10, 10, 3);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(150 + k * 14, -96);
    ctx.lineTo(150 + k * 14, -72);
    ctx.stroke();
  }
  // Pot d'échappement.
  ctx.fillStyle = "#26282b";
  ctx.beginPath();
  ctx.roundRect(160, -142, 9, 42, 3);
  ctx.fill();
  // Cabine.
  ctx.fillStyle = vertFonce;
  ctx.beginPath();
  ctx.roundRect(14, -184, 108, 14, 6);
  ctx.fill();
  ctx.fillStyle = "#2a2c2f";
  ctx.fillRect(22, -172, 8, 110);
  ctx.fillRect(104, -172, 8, 110);
  ctx.fillStyle = "#a9d6ea";
  ctx.fillRect(30, -170, 74, 70);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.moveTo(36, -164);
  ctx.lineTo(58, -164);
  ctx.lineTo(40, -120);
  ctx.lineTo(36, -120);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = vert;
  ctx.fillRect(22, -100, 90, 40);
  // Garde-boue arrière.
  ctx.fillStyle = vert;
  ctx.beginPath();
  ctx.arc(60, -58, 66, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(126, -58);
  ctx.lineTo(-6, -58);
  ctx.closePath();
  ctx.fill();
  // Les roues.
  const roue = (x: number, y: number, r: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotRoues);
    ctx.fillStyle = "#2c2c2e";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1c1c1e";
    for (let k = 0; k < 12; k++) {
      ctx.save();
      ctx.rotate((k / 12) * Math.PI * 2);
      ctx.fillRect(-r * 0.1, -r * 1.04, r * 0.2, r * 0.18);
      ctx.restore();
    }
    ctx.fillStyle = "#f2c230";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#56585c";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  roue(60, -58, 58);
  roue(205, -36, 36);
  // Les reflets d'un engin propre.
  if (brille > 0) {
    ctx.globalAlpha = brille;
    ctx.fillStyle = "#ffffff";
    for (const [x, y, s] of [
      [130, -96, 9],
      [70, -150, 7],
      [220, -80, 6],
      [40, -40, 6],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.25, y - s * 0.25);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x + s * 0.25, y + s * 0.25);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.25, y + s * 0.25);
      ctx.lineTo(x - s, y);
      ctx.lineTo(x - s * 0.25, y - s * 0.25);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function dessinerPaquet(ctx: CanvasRenderingContext2D, p: Paquet, t: number) {
  const vie = p.pv / p.pvMax;
  if (vie <= 0) return;
  const tremble = vie < 1 ? Math.sin(t * 40 + p.x) * 1.5 : 0;
  const r = p.r * (0.35 + 0.65 * vie);
  const sec = p.pvMax > 1.2;
  ctx.save();
  ctx.translate(p.x + tremble, p.y);
  // Les coulures, sous le paquet.
  ctx.fillStyle = sec ? "#5a3e22" : "#6b4a2b";
  for (const [dx, l] of [[-r * 0.35, r * 0.9], [r * 0.25, r * 0.6]] as const) {
    ctx.beginPath();
    ctx.roundRect(dx - r * 0.1, 0, r * 0.2, l + r * 0.4, r * 0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx, l + r * 0.4, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  // Le paquet : un rond à bosses, cerné.
  ctx.beginPath();
  const n = p.bosses.length;
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * p.bosses[k % n]!;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (k === 0) ctx.moveTo(x, y);
    else {
      const am = ((k - 0.5) / n) * Math.PI * 2;
      const rm = r * 0.78;
      ctx.quadraticCurveTo(Math.cos(am) * rm, Math.sin(am) * rm, x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = sec ? "#5a3e22" : "#6f4c2c";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#3e2915";
  ctx.stroke();
  // Craquelures de la boue sèche, reflet de la boue fraîche.
  if (sec) {
    ctx.strokeStyle = "rgba(160, 125, 80, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.1);
    ctx.lineTo(0, r * 0.1);
    ctx.lineTo(r * 0.3, -r * 0.25);
    ctx.moveTo(0, r * 0.1);
    ctx.lineTo(r * 0.05, r * 0.45);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(190, 150, 100, 0.7)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function JeuLavage({ onFini }: { onFini: (etoiles: number) => void }) {
  const etat = useRef({
    paquets: PAQUETS.map<Paquet>((p) => ({
      x: p.x,
      y: p.y,
      r: p.r,
      pv: p.sec ? 1.7 : 1,
      pvMax: p.sec ? 1.7 : 1,
      bosses: Array.from({ length: 9 }, () => 0.85 + Math.random() * 0.35),
      eclate: false,
    })),
    entree: 0,
    visee: null as { x: number; y: number } | null,
    tient: false,
    clavier: false,
    debut: -1,
    fini: false,
    finiDepuis: 0,
    particules: [] as Particule[],
    textes: [] as { x: number; y: number; t: string; vie: number; couleur: string }[],
    derniereGoutte: 0,
  });
  const fin = useRef(onFini);
  fin.current = onFini;

  const toile = useToile(16 / 10.5, (ctx, w, h, t, dt) => {
    const e = etat.current;
    // Le tracteur tient dans la station avec de l'air autour : sous le
    // bandeau du haut, loin des bords.
    const echelle = Math.min(w / 330, h / 262) * 0.9;
    const sol = h * 0.86;
    // Le tracteur entre, s'arrête au milieu, et repart propre.
    e.entree = Math.min(1, e.entree + dt / 1.1);
    if (e.fini) e.finiDepuis += dt;
    const arrivee = 1 - (1 - e.entree) ** 3;
    const depart = e.fini ? Math.max(0, e.finiDepuis - 1.1) ** 2 * 3 : 0;
    const tx = w / 2 - 130 * echelle + (arrivee - 1) * w * 0.9 + depart * w;
    const saut = e.fini && e.finiDepuis < 1 ? Math.abs(Math.sin(e.finiDepuis * 9)) * 6 * (1 - e.finiDepuis) : 0;
    const ty = sol - saut;
    const rotRoues = (tx / (58 * echelle)) * 1;

    // La station : carrelage, rampes de jets, caniveau.
    ctx.clearRect(0, 0, w, h);
    const fond = ctx.createLinearGradient(0, 0, 0, h);
    fond.addColorStop(0, "#dff1f7");
    fond.addColorStop(0.86, "#c3e2ec");
    fond.addColorStop(0.86, "#8aa1a8");
    fond.addColorStop(1, "#7a9098");
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, sol);
      ctx.stroke();
    }
    for (let y = 0; y < sol; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#5d7178";
    ctx.fillRect(0, sol + 6, w, 5);
    ctx.fillStyle = "rgba(40, 60, 70, 0.25)";
    ctx.beginPath();
    ctx.ellipse(tx + 130 * echelle, sol + 2, 125 * echelle, 9 * echelle, 0, 0, Math.PI * 2);
    ctx.fill();

    // Le tracteur et sa boue.
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(echelle, echelle);
    const brille = e.fini ? Math.min(1, e.finiDepuis * 2) * (0.6 + 0.4 * Math.sin(t * 8)) : 0;
    dessinerTracteur(ctx, rotRoues, brille);
    for (const p of e.paquets) dessinerPaquet(ctx, p, t);
    ctx.restore();

    // Le jet : à la souris ou au doigt ; au clavier, il vise le paquet le plus proche.
    let vise = e.visee;
    if (e.clavier) {
      const reste = e.paquets.filter((p) => p.pv > 0);
      const p = reste[0];
      vise = p ? { x: tx + p.x * echelle, y: ty + p.y * echelle } : null;
    }
    const arrose = (e.tient || e.clavier) && vise && !e.fini && e.entree >= 1;
    if (arrose && vise) {
      if (e.debut < 0) e.debut = t;
      const lanceX = w - 18;
      const lanceY = h - 14;
      const jet = ctx.createLinearGradient(lanceX, lanceY, vise.x, vise.y);
      jet.addColorStop(0, "rgba(255,255,255,0.95)");
      jet.addColorStop(1, "rgba(150, 210, 240, 0.9)");
      ctx.strokeStyle = jet;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lanceX, lanceY);
      ctx.lineTo(vise.x, vise.y);
      ctx.stroke();
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -t * 220;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(210, 238, 250, 0.55)";
      ctx.beginPath();
      ctx.arc(vise.x, vise.y, 16, 0, Math.PI * 2);
      ctx.fill();
      if (t - e.derniereGoutte > 0.03) {
        e.derniereGoutte = t;
        gerbe(e.particules, vise.x, vise.y, 2, ["#bfe6f7", "#ffffff"], 180);
      }
      // Le jet ronge le paquet visé.
      for (const p of e.paquets) {
        if (p.pv <= 0) continue;
        const px = tx + p.x * echelle;
        const py = ty + p.y * echelle;
        if (Math.hypot(px - vise.x, py - vise.y) > p.r * echelle + 14) continue;
        p.pv -= dt * 1.35;
        if (p.pv <= 0 && !p.eclate) {
          p.eclate = true;
          gerbe(e.particules, px, py, 16, ["#6f4c2c", "#8a6a44", "#bfe6f7"], 240);
          e.textes.push({ x: px, y: py - 10, t: "Splash !", vie: 0, couleur: "#1f6f9a" });
          jouerSon("piece");
          if (e.paquets.every((q) => q.pv <= 0)) {
            e.fini = true;
            e.finiDepuis = 0;
            jouerSon("niveau");
            fin.current(etoilesLavage(t - e.debut));
          }
        }
      }
    }
    // La lance, en bas à droite.
    ctx.fillStyle = "#2f3033";
    ctx.beginPath();
    ctx.roundRect(w - 30, h - 22, 26, 14, 4);
    ctx.fill();
    ctx.fillStyle = "#f2c230";
    ctx.beginPath();
    ctx.roundRect(w - 46, h - 20, 18, 10, 3);
    ctx.fill();

    animerParticules(ctx, e.particules, dt, sol + 4);
    texteFlottant(ctx, e.textes, dt);

    const reste = e.paquets.filter((p) => p.pv > 0).length;
    const chrono = e.debut >= 0 ? t - e.debut : 0;
    bandeau(ctx, w, `Boue ${reste}/${e.paquets.length}`, e.debut >= 0 && !e.fini ? `${chrono.toFixed(1)} s` : "");
    if (e.fini && e.finiDepuis < 2.5) {
      ctx.textAlign = "center";
      ctx.font = "900 28px 'Baloo 2', Nunito, sans-serif";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText("Comme neuf !", w / 2, h * 0.28);
      ctx.fillStyle = "#2f7d4a";
      ctx.fillText("Comme neuf !", w / 2, h * 0.28);
    }
    const c = toile.current;
    if (c) c.dataset.reste = String(reste);
  });

  const viser = (ev: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    etat.current.visee = { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };

  return (
    <canvas
      ref={toile}
      className="care-jeu care-jeu-lavage"
      tabIndex={0}
      aria-label="Station de lavage : maintenez et visez la boue avec le jet ; au clavier, maintenez Espace"
      onPointerDown={(ev) => {
        ev.preventDefault();
        ev.currentTarget.setPointerCapture?.(ev.pointerId);
        etat.current.tient = true;
        viser(ev);
      }}
      onPointerMove={(ev) => {
        viser(ev);
        if (ev.pointerType === "mouse") etat.current.tient = ev.buttons !== 0;
      }}
      onPointerUp={() => {
        etat.current.tient = false;
      }}
      onPointerCancel={() => {
        etat.current.tient = false;
      }}
      onKeyDown={(ev) => {
        if (ev.key === " ") {
          ev.preventDefault();
          etat.current.clavier = true;
        }
      }}
      onKeyUp={(ev) => {
        if (ev.key === " ") etat.current.clavier = false;
      }}
      onContextMenu={(ev) => ev.preventDefault()}
    />
  );
}
