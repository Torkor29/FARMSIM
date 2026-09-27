import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  animerDecor,
  chargerManifeste,
  chargerModele,
  teinterSaison,
  type AssetDecor,
  type ManifesteDecor,
  type SaisonDecor,
} from "./modeles-decor";

/**
 * Atelier — les décors de la forge.
 *
 * Page de travail, hors jeu. La forge (`blender/atelier.py`) rend déjà un
 * aperçu Cycles de chaque pièce ; celle-ci montre la **vraie** chose : le
 * `.glb` compressé, chargé par le chargeur du jeu, sous l'éclairage du jeu,
 * avec l'occlusion cuite dans les sommets, les couleurs de saison et les
 * nœuds animés. C'est l'acceptation finale d'un décor.
 *
 * Pilotée par l'URL (les pilotes automatiques y arrivent mieux qu'aux clics) :
 *
 *   ?asset=moulin         n'affiche qu'un asset
 *   ?piece=moulin         ouvre une pièce en grand, qui tourne
 *   ?saison=automne       printemps | automne | hiver (été par défaut)
 *   ?nuit                 l'éclairage de nuit : ce qui est émissif brille
 *
 * Une seule WebGLRenderer pour toute la page : les vignettes sont rendues
 * l'une après l'autre puis copiées dans des canevas 2D. Un navigateur ne
 * tient qu'une quinzaine de contextes WebGL à la fois.
 */

const SAISONS: (SaisonDecor | "ete")[] = ["ete", "printemps", "automne", "hiver"];
const VIGNETTE = 260;

interface Carte {
  asset: string;
  piece: string;
  info: AssetDecor;
}

function params() {
  return new URLSearchParams(typeof location === "undefined" ? "" : location.search);
}

/** La scène et les lumières du jeu (`IsoFarmView`), de jour ou de nuit. */
function scenePlateau(nuit: boolean) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(nuit ? 0x2c3f6e : 0xcfe8f2);
  const hemi = new THREE.HemisphereLight(nuit ? 0x5a6fa8 : 0xffffff, nuit ? 0x1a2238 : 0x9ab87e, nuit ? 1.1 : 1.25);
  const ambient = new THREE.AmbientLight(nuit ? 0x4a5a90 : 0xfff6e4, nuit ? 0.7 : 0.65);
  const sun = new THREE.DirectionalLight(nuit ? 0x9fb4ff : 0xfff2d4, nuit ? 0.8 : 1.55);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0006;
  const bounce = new THREE.DirectionalLight(0xbfe0c8, nuit ? 0.1 : 0.4);
  bounce.position.set(-10, 6, -8);
  scene.add(hemi, ambient, sun, bounce);
  const sol = new THREE.Mesh(
    new THREE.CircleGeometry(40, 48),
    new THREE.MeshStandardMaterial({ color: nuit ? 0x2f4a3a : 0x9cc865, roughness: 1 }),
  );
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);
  return { scene, sun };
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
  s.updateProjectionMatrix();
  sun.target.position.copy(centre);
  sun.position.set(centre.x + 14, centre.y + 24, centre.z + 10);
  sun.target.updateMatrixWorld();
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

export function DecorShowcase() {
  const p = params();
  const [manifeste, setManifeste] = useState<ManifesteDecor | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [saison, setSaison] = useState<SaisonDecor | "ete">((p.get("saison") as SaisonDecor) ?? "ete");
  const [nuit, setNuit] = useState(p.has("nuit"));
  const [ouverte, setOuverte] = useState<Carte | null>(null);
  const seul = p.get("asset");

  useEffect(() => {
    chargerManifeste().then(setManifeste, (e) => setErreur(String(e)));
  }, []);

  const cartes = useMemo<Carte[]>(() => {
    if (!manifeste) return [];
    return Object.entries(manifeste.assets)
      .filter(([id]) => !seul || id === seul)
      .flatMap(([asset, info]) => Object.keys(info.pieces).map((piece) => ({ asset, piece, info })));
  }, [manifeste, seul]);

  // ?piece= ouvre directement la pièce en grand.
  useEffect(() => {
    const voulue = p.get("piece");
    if (voulue && cartes.length) setOuverte(cartes.find((c) => c.piece === voulue) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartes]);

  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — les décors de la forge</h1>
        <p>
          Chaque pièce est le <code>.glb</code> livré au jeu, sous l'éclairage du jeu. Les sources sont les recettes
          de <code>apps/web/blender/recettes/</code> ; on les reconstruit avec{" "}
          <code>scripts/forge.sh construire --perimes</code>.
        </p>
        <div className="atelier-controls">
          {SAISONS.map((s) => (
            <button key={s} className={s === saison ? "on" : ""} onClick={() => setSaison(s)}>
              {s === "ete" ? "été" : s}
            </button>
          ))}
          <button className={nuit ? "on" : ""} onClick={() => setNuit(!nuit)}>
            nuit
          </button>
        </div>
      </header>
      {erreur && <p>Pas de manifeste : {erreur}</p>}
      {ouverte && (
        <Grande carte={ouverte} saison={saison} nuit={nuit} fermer={() => setOuverte(null)} />
      )}
      <Planche cartes={cartes} saison={saison} nuit={nuit} ouvrir={setOuverte} />
    </div>
  );
}

/** Les vignettes : une renderer, rendue carte après carte, copiée en 2D. */
function Planche({
  cartes,
  saison,
  nuit,
  ouvrir,
}: {
  cartes: Carte[];
  saison: SaisonDecor | "ete";
  nuit: boolean;
  ouvrir: (c: Carte) => void;
}) {
  const canevas = useRef<Map<string, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    if (!cartes.length) return;
    let annule = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(VIGNETTE, VIGNETTE);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const { scene, sun } = scenePlateau(nuit);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    (async () => {
      for (const c of cartes) {
        if (annule) break;
        const cle = `${c.asset}/${c.piece}`;
        const cible = canevas.current.get(cle);
        if (!cible) continue;
        const objet = await pieceSeule(c.info.url, c.piece);
        teinterSaison(objet, saison === "ete" ? undefined : c.info.saisons[saison]);
        scene.add(objet);
        cadrer(camera, sun, objet);
        renderer.render(scene, camera);
        const ctx = cible.getContext("2d");
        ctx?.drawImage(renderer.domElement, 0, 0, cible.width, cible.height);
        scene.remove(objet);
      }
    })();
    return () => {
      annule = true;
      renderer.dispose();
    };
  }, [cartes, saison, nuit]);

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

/** Une pièce en grand, qui tourne, nœuds animés. */
function Grande({
  carte,
  saison,
  nuit,
  fermer,
}: {
  carte: Carte;
  saison: SaisonDecor | "ete";
  nuit: boolean;
  fermer: () => void;
}) {
  const hote = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hote.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const cote = Math.min(720, el.clientWidth);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(cote, cote);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const { scene, sun } = scenePlateau(nuit);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    let objet: THREE.Object3D | null = null;
    let fin = false;
    const t0 = performance.now();
    pieceSeule(carte.info.url, carte.piece).then((o) => {
      if (fin) return;
      objet = o;
      teinterSaison(o, saison === "ete" ? undefined : carte.info.saisons[saison]);
      scene.add(o);
    });
    const boucle = () => {
      if (fin) return;
      const t = (performance.now() - t0) / 1000;
      if (objet) {
        animerDecor(objet, t);
        cadrer(camera, sun, objet, t * 0.25);
      }
      renderer.render(scene, camera);
      requestAnimationFrame(boucle);
    };
    boucle();
    return () => {
      fin = true;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [carte, saison, nuit]);

  return (
    <section className="atelier-big">
      <div className="atelier-big-head">
        <strong>
          {carte.piece} — {carte.info.titre}
        </strong>
        <button onClick={fermer}>fermer</button>
      </div>
      <div ref={hote} />
    </section>
  );
}
