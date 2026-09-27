import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ambiance, formatHeure, momentDuJour, type Meteo, type Saison } from "./ambiance";
import { allumerLumieres, appliquerAmbiance } from "./lumieres";
import { creerMeteo3d } from "./meteo3d";
import {
  animerDecor,
  chargerManifeste,
  chargerModele,
  teinterSaison,
  type AssetDecor,
  type ManifesteDecor,
  type SaisonDecor,
} from "./modeles-decor";
import { SCENES, type SceneDecor } from "./scenes-decor";

/**
 * Atelier — les décors de la forge, sous la lumière du jeu.
 *
 * Page de travail, hors jeu. On y juge un décor comme il sera en jeu : le
 * `.glb` livré, chargé par le chargeur du jeu, éclairé par **la même
 * ambiance** que la ferme (`ambiance.ts` + `lumieres.ts`) — à l'heure qu'on
 * veut, par le temps qu'on veut, pluie et neige comprises.
 *
 * Pilotée aussi par l'URL (les pilotes automatiques y arrivent mieux qu'aux
 * clics) :
 *
 *   ?asset=moulin               n'affiche qu'un asset
 *   ?piece=moulin               ouvre une pièce en grand, qui tourne
 *   ?scene=fete-des-recoltes    une scène composée (voir `scenes-decor.ts`)
 *   ?heure=19.2                 l'heure du jeu (13 par défaut)
 *   ?meteo=RAIN                 CLEAR | CLOUDY | RAIN | STORM | SNOW
 *   ?saison=AUTUMN              SPRING | SUMMER | AUTUMN | WINTER
 *   ?defile                     le jour passe : une heure de jeu par seconde
 *
 * Une seule WebGLRenderer pour les vignettes : elles sont rendues l'une après
 * l'autre puis copiées dans des canevas 2D (un navigateur ne tient qu'une
 * quinzaine de contextes WebGL).
 */

const SAISONS: Saison[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
const NOM_SAISON: Record<Saison, string> = { SPRING: "printemps", SUMMER: "été", AUTUMN: "automne", WINTER: "hiver" };
const TEINTE_SAISON: Record<Saison, SaisonDecor | undefined> = {
  SPRING: "printemps",
  SUMMER: undefined,
  AUTUMN: "automne",
  WINTER: "hiver",
};
const METEOS: { v: Meteo; nom: string }[] = [
  { v: "CLEAR", nom: "beau" },
  { v: "CLOUDY", nom: "nuageux" },
  { v: "RAIN", nom: "pluie" },
  { v: "STORM", nom: "orage" },
  { v: "SNOW", nom: "neige" },
];
const VIGNETTE = 260;

interface Carte {
  asset: string;
  piece: string;
  info: AssetDecor;
}

interface Reglage {
  heure: number;
  meteo: Meteo;
  saison: Saison;
}

function params() {
  return new URLSearchParams(typeof location === "undefined" ? "" : location.search);
}

/** La scène d'atelier : lumières du jeu, sol, et au besoin une île sur l'eau. */
function plateau(ile: number | null) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight();
  const ambient = new THREE.AmbientLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0006;
  const bounce = new THREE.DirectionalLight();
  bounce.position.set(-10, 6, -8);
  scene.add(hemi, ambient, sun, sun.target, bounce);
  const lumieres = { hemi, ambient, sun, bounce };
  const herbe = new THREE.MeshStandardMaterial({ color: 0x9cc865, roughness: 1 });
  if (ile) {
    // Une île : dessus d'herbe, liseré de sable, sur une eau turquoise.
    const dessus = new THREE.Mesh(new THREE.CylinderGeometry(ile, ile * 1.02, 0.5, 64), herbe);
    dessus.position.y = -0.25;
    const sable = new THREE.Mesh(
      new THREE.CylinderGeometry(ile * 1.05, ile * 1.1, 0.5, 64),
      new THREE.MeshStandardMaterial({ color: 0xe9d9a4, roughness: 1 }),
    );
    sable.position.y = -0.37;
    const eau = new THREE.Mesh(
      new THREE.CircleGeometry(ile * 4, 64),
      new THREE.MeshStandardMaterial({ color: 0x5fc3d4, roughness: 0.25, metalness: 0.05 }),
    );
    eau.rotation.x = -Math.PI / 2;
    eau.position.y = -0.45;
    for (const m of [dessus, sable, eau]) m.receiveShadow = true;
    scene.add(dessus, sable, eau);
  } else {
    const sol = new THREE.Mesh(new THREE.CircleGeometry(40, 48), herbe);
    sol.rotation.x = -Math.PI / 2;
    sol.receiveShadow = true;
    scene.add(sol);
  }
  const fond = new THREE.Color();
  const eclairer = (r: Reglage, eclair = 0) => {
    const a = ambiance(r.heure, r.saison, r.meteo);
    appliquerAmbiance(lumieres, a, eclair, null, 40);
    // Le fond : le ciel de jour, qui glisse vers le bas du ciel du moment.
    fond.setHex(0xcfe8f2).lerp(new THREE.Color(a.ciel.bas), Math.min(1, a.ciel.voile));
    scene.background = fond;
    herbe.color.setHex(r.saison === "WINTER" ? 0xe4ecef : r.saison === "AUTUMN" ? 0xb4b05a : 0x9cc865);
    allumerLumieres(scene, a.lampes);
    return a;
  };
  return { scene, sun, eclairer };
}

/** Cadre la caméra orthographique iso (celle du jeu) sur l'objet. */
function cadrer(camera: THREE.OrthographicCamera, sun: THREE.DirectionalLight, objet: THREE.Object3D, azimut = 0) {
  const boite = new THREE.Box3().setFromObject(objet);
  const centre = boite.getCenter(new THREE.Vector3());
  const taille = boite.getSize(new THREE.Vector3());
  const r = Math.max(taille.x, taille.y, taille.z) * 0.62 + 0.1;
  const a = Math.PI / 4 + azimut;
  camera.position.set(centre.x + Math.sin(a) * 18, centre.y + 16, centre.z + Math.cos(a) * 18);
  camera.lookAt(centre);
  camera.left = -r;
  camera.right = r;
  camera.top = r;
  camera.bottom = -r;
  camera.near = -100;
  camera.far = 200;
  camera.updateProjectionMatrix();
  const s = sun.shadow.camera as THREE.OrthographicCamera;
  s.left = s.bottom = -r * 1.6;
  s.right = s.top = r * 1.6;
  s.near = 0.5;
  s.far = 120;
  s.updateProjectionMatrix();
  sun.target.position.copy(centre);
  return { centre, r };
}

async function pieceSeule(url: string, nom: string): Promise<THREE.Object3D> {
  const modele = await chargerModele(url);
  const piece = modele.getObjectByName(nom);
  if (!piece) throw new Error(`${nom} absent de ${url}`);
  const copie = piece.clone(true);
  copie.position.set(0, 0, 0);
  copie.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return copie;
}

async function monterScene(s: SceneDecor, manifeste: ManifesteDecor, saison: Saison): Promise<THREE.Group> {
  const g = new THREE.Group();
  const objets = await Promise.all(
    s.poses.map(async (pose) => {
      const info = manifeste.assets[pose.asset];
      if (!info) return null;
      const o = await pieceSeule(info.url, pose.piece).catch(() => null);
      if (!o) return null;
      o.position.set(pose.x, pose.y ?? 0, pose.z);
      o.rotation.y = pose.rot ?? 0;
      o.scale.setScalar(pose.echelle ?? 1);
      const t = TEINTE_SAISON[saison];
      teinterSaison(o, t ? info.saisons[t] : undefined);
      return o;
    }),
  );
  for (const o of objets) if (o) g.add(o);
  return g;
}

export function DecorShowcase() {
  const p = params();
  const [manifeste, setManifeste] = useState<ManifesteDecor | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [heure, setHeure] = useState(() => Number(p.get("heure") ?? 13) || 13);
  const [meteo, setMeteo] = useState<Meteo>(() => (p.get("meteo")?.toUpperCase() as Meteo) || "CLEAR");
  const [saison, setSaison] = useState<Saison>(() => (p.get("saison")?.toUpperCase() as Saison) || "SUMMER");
  const [defile, setDefile] = useState(p.has("defile"));
  const [ouverte, setOuverte] = useState<Carte | null>(null);
  const [scene, setScene] = useState<string | null>(p.get("scene"));
  const seul = p.get("asset");

  useEffect(() => {
    chargerManifeste().then(setManifeste, (e) => setErreur(String(e)));
  }, []);

  // Le jour qui passe : une heure de jeu par seconde.
  useEffect(() => {
    if (!defile) return;
    const id = window.setInterval(() => setHeure((h) => (h + 0.05) % 24), 50);
    return () => window.clearInterval(id);
  }, [defile]);

  const cartes = useMemo<Carte[]>(() => {
    if (!manifeste) return [];
    return Object.entries(manifeste.assets)
      .filter(([id]) => !seul || id === seul)
      .flatMap(([asset, info]) => Object.keys(info.pieces).map((piece) => ({ asset, piece, info })));
  }, [manifeste, seul]);

  useEffect(() => {
    const voulue = p.get("piece");
    if (voulue && cartes.length) setOuverte(cartes.find((c) => c.piece === voulue) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartes]);

  const reglage: Reglage = { heure, meteo, saison };
  // Les vignettes ne suivent pas le défilement du jour : trop de rendus.
  const heureVignettes = defile ? 13 : Math.round(heure * 4) / 4;

  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — les décors de la forge</h1>
        <p>
          Chaque pièce est le <code>.glb</code> livré au jeu, sous la lumière du jeu à l'heure choisie. Les sources
          sont les recettes de <code>apps/web/blender/recettes/</code> (<code>scripts/forge.sh</code>).
        </p>
        <div className="atelier-controls">
          {Object.entries(SCENES).map(([id, s]) => (
            <button key={id} className={scene === id ? "on" : ""} onClick={() => setScene(scene === id ? null : id)}>
              {s.titre.split(" — ")[0]}
            </button>
          ))}
        </div>
        <div className="atelier-controls">
          <label className="atelier-heure">
            {formatHeure(heure)} · {momentDuJour(heure, saison)}
            <input
              type="range"
              min={0}
              max={23.99}
              step={0.05}
              value={heure}
              onChange={(e) => {
                setDefile(false);
                setHeure(Number(e.target.value));
              }}
            />
          </label>
          <button className={defile ? "on" : ""} onClick={() => setDefile(!defile)}>
            {defile ? "⏸ arrêter" : "▶ le jour passe"}
          </button>
        </div>
        <div className="atelier-controls">
          {METEOS.map((m) => (
            <button key={m.v} className={m.v === meteo ? "on" : ""} onClick={() => setMeteo(m.v)}>
              {m.nom}
            </button>
          ))}
          {SAISONS.map((s) => (
            <button key={s} className={s === saison ? "on" : ""} onClick={() => setSaison(s)}>
              {NOM_SAISON[s]}
            </button>
          ))}
        </div>
      </header>
      {erreur && <p>Pas de manifeste : {erreur}</p>}
      {manifeste && scene && SCENES[scene] && (
        <Vue
          titre={SCENES[scene].titre}
          reglage={reglage}
          fermer={() => setScene(null)}
          monter={() => monterScene(SCENES[scene], manifeste, saison)}
          ile={SCENES[scene].rayon}
          cle={`${scene}/${saison}`}
        />
      )}
      {ouverte && (
        <Vue
          titre={`${ouverte.piece} — ${ouverte.info.titre}`}
          reglage={reglage}
          fermer={() => setOuverte(null)}
          monter={async () => {
            const o = await pieceSeule(ouverte.info.url, ouverte.piece);
            const t = TEINTE_SAISON[saison];
            teinterSaison(o, t ? ouverte.info.saisons[t] : undefined);
            return o;
          }}
          ile={null}
          tourne
          cle={`${ouverte.asset}/${ouverte.piece}/${saison}`}
        />
      )}
      <Planche cartes={cartes} reglage={{ ...reglage, heure: heureVignettes }} ouvrir={setOuverte} />
    </div>
  );
}

/** Les vignettes : une renderer, rendue carte après carte, copiée en 2D. */
function Planche({ cartes, reglage, ouvrir }: { cartes: Carte[]; reglage: Reglage; ouvrir: (c: Carte) => void }) {
  const canevas = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const { heure, meteo, saison } = reglage;

  useEffect(() => {
    if (!cartes.length) return;
    let annule = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(VIGNETTE, VIGNETTE);
    renderer.shadowMap.enabled = true;
    const { scene, sun, eclairer } = plateau(null);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    (async () => {
      for (const c of cartes) {
        if (annule) break;
        const cible = canevas.current.get(`${c.asset}/${c.piece}`);
        if (!cible) continue;
        const objet = await pieceSeule(c.info.url, c.piece);
        const t = TEINTE_SAISON[saison];
        teinterSaison(objet, t ? c.info.saisons[t] : undefined);
        scene.add(objet);
        cadrer(camera, sun, objet);
        eclairer({ heure, meteo, saison });
        renderer.render(scene, camera);
        cible.getContext("2d")?.drawImage(renderer.domElement, 0, 0, cible.width, cible.height);
        scene.remove(objet);
      }
    })();
    return () => {
      annule = true;
      renderer.dispose();
    };
  }, [cartes, heure, meteo, saison]);

  return (
    <div className="atelier-grid">
      {cartes.map((c) => {
        const p = c.info.pieces[c.piece];
        return (
          <figure key={`${c.asset}/${c.piece}`} className="atelier-card" onClick={() => ouvrir(c)}>
            <canvas
              width={VIGNETTE * 2}
              height={VIGNETTE * 2}
              style={{ width: "100%", aspectRatio: "1", cursor: "zoom-in" }}
              ref={(el) => {
                if (el) canevas.current.set(`${c.asset}/${c.piece}`, el);
              }}
            />
            <figcaption>
              <strong>{c.piece}</strong> · {c.info.titre}
              <br />
              {p.triangles.toLocaleString("fr")} tri · {p.appels} appels · {p.taille.map((v) => v.toFixed(1)).join(" × ")}
              {p.noeuds.length ? ` · anime : ${p.noeuds.join(", ")}` : ""}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

/**
 * Une vue en grand, rendue en continu : une pièce qui tourne ou une scène
 * composée, sous l'ambiance du réglage, pluie et neige comprises.
 */
function Vue({
  titre,
  reglage,
  fermer,
  monter,
  ile,
  tourne = false,
  cle,
}: {
  titre: string;
  reglage: Reglage;
  fermer: () => void;
  monter: () => Promise<THREE.Object3D>;
  ile: number | null;
  tourne?: boolean;
  cle: string;
}) {
  const hote = useRef<HTMLDivElement>(null);
  const reglageRef = useRef(reglage);
  reglageRef.current = reglage;

  useEffect(() => {
    const el = hote.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const largeur = Math.min(1100, el.clientWidth);
    const hauteur = Math.round(largeur * (ile ? 0.62 : 1));
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(largeur, hauteur);
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);
    const { scene, sun, eclairer } = plateau(ile);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    const meteo3d = creerMeteo3d({ pixelRatio: Math.min(2, window.devicePixelRatio) });
    scene.add(meteo3d.objet);
    let objet: THREE.Object3D | null = null;
    let cadre = { centre: new THREE.Vector3(), r: 5 };
    let fin = false;
    const t0 = performance.now();
    let avant = t0;
    monter().then((o) => {
      if (fin) return;
      objet = o;
      scene.add(o);
      cadre = cadrer(camera, sun, o);
      // Une scène : on cadre sur l'île entière, pas seulement sur ce qui dépasse.
      if (ile) cadre.r = ile * 0.5;
    });
    const boucle = () => {
      if (fin) return;
      const maintenant = performance.now();
      const t = (maintenant - t0) / 1000;
      const dt = (maintenant - avant) / 1000;
      avant = maintenant;
      if (objet) {
        animerDecor(objet, t);
        if (tourne) cadre = cadrer(camera, sun, objet, t * 0.25);
        const aspect = largeur / hauteur;
        camera.left = -cadre.r * aspect;
        camera.right = cadre.r * aspect;
        camera.top = cadre.r;
        camera.bottom = -cadre.r;
        camera.updateProjectionMatrix();
      }
      const eclair = meteo3d.mettreAJour(dt, t, reglageRef.current.meteo, cadre.centre, cadre.r * 4);
      eclairer(reglageRef.current, eclair);
      renderer.render(scene, camera);
      requestAnimationFrame(boucle);
    };
    boucle();
    return () => {
      fin = true;
      meteo3d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return (
    <section className="atelier-big">
      <div className="atelier-big-head">
        <strong>{titre}</strong>
        <button onClick={fermer}>fermer</button>
      </div>
      <div ref={hote} />
    </section>
  );
}
