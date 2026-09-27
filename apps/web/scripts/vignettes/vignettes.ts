/**
 * Les vignettes du catalogue de construction, rendues depuis le jeu lui-même.
 *
 * Chaque élément est construit par le même code que sur la ferme
 * (`verserObjet`, `creerDomaine3d`), posé sur un carré de pré, éclairé comme
 * la scène, et photographié en vue plongeante. La vignette montre donc
 * exactement ce qu'on va poser — plus un dessin qui lui ressemble.
 *
 * Servie par Vite (`/scripts/vignettes/`) et pilotée par `rendre.mjs`.
 */
import * as THREE from "three";
import { creerDomaine3d, verserObjet, type CaseTerrain } from "../../src/domaine3d";
import { maillageFacette } from "../../src/decor3d";
import { BOIS_MATURITE_MS, HAUTEUR_NIVEAU } from "@farmsim/shared";

const COTE = 256;
const TOP = 0.09;
const EP = 0.18;

type Scene = { objets: THREE.Object3D[]; cases: [number, number][] };

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(COTE, COTE);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

function dalle(x: number, z: number, couleur: number, hauteur = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, EP, 0.98),
    new THREE.MeshLambertMaterial({ color: couleur }),
  );
  m.position.set(x, hauteur, z);
  m.receiveShadow = true;
  return m;
}

function objet(type: string, poses: { x: number; z: number; voisins?: number; rot?: number }[]): THREE.Mesh {
  const t = { pos: [] as number[], col: [] as number[] };
  poses.forEach((p, i) => verserObjet(t, type, p.x, p.z, p.rot ?? 0, 1, p.voisins ?? 0, 7 + i * 13));
  const m = maillageFacette(t.pos, t.col, { shadows: true, recoit: true });
  return m;
}

function terrain(cells: CaseTerrain[]): THREE.Object3D {
  const d = creerDomaine3d({ shadows: true });
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  d.majTerrain(
    {
      bornes: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs) + 1, maxY: Math.max(...ys) + 1 },
      cells,
      amenagements: [],
    },
    (x, y) => ({ px: x - 1, pz: y - 1 }),
    1,
  );
  return d.group;
}

const PRE = [0x74ad48, 0x6ca342];
const pre = (n: number): [number, number][] => {
  const o: [number, number][] = [];
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) o.push([x - (n - 1) / 2, z - (n - 1) / 2]);
  return o;
};

function sceneDe(id: string): { groupe: THREE.Group; recul: number } {
  const g = new THREE.Group();
  const sol = (cases: [number, number][], couleurs = PRE) =>
    cases.forEach(([x, z]) => g.add(dalle(x, z, couleurs[Math.abs(Math.round(x + z)) % couleurs.length]!)));
  const cellsCarre = (n: number, f: (x: number, y: number) => Partial<CaseTerrain>): CaseTerrain[] =>
    pre(n).map(([x, z]) => ({ x: x + 1, y: z + 1, sol: "PRE", revetement: null, kind: "EMPTY", ...f(x, z) }));
  let recul = 1;
  switch (id) {
    case "champ": {
      pre(3).forEach(([x, z]) => g.add(dalle(x, z, 0x593a20)));
      // Des sillons et une levée : un champ tout juste semé.
      const t = { pos: [] as number[], col: [] as number[] };
      const m0 = new THREE.Group();
      for (const [x, z] of pre(3)) {
        for (let k = -1; k <= 1; k++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.03, 0.08), new THREE.MeshLambertMaterial({ color: 0x3f2814 }));
          s.position.set(x, TOP + 0.01, z + k * 0.28);
          m0.add(s);
          for (let j = -2; j <= 2; j++) {
            const p = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), new THREE.MeshLambertMaterial({ color: 0x6fae3e }));
            p.position.set(x + j * 0.17, TOP + 0.07, z + k * 0.28 + 0.1);
            p.castShadow = true;
            m0.add(p);
          }
        }
      }
      void t;
      g.add(m0);
      break;
    }
    case "pre":
      g.add(terrain(cellsCarre(3, () => ({}))));
      sol(pre(3));
      break;
    case "etang":
    case "berge": {
      // Creuser : un petit lac en L, tout en rondeurs. Berges : un canal dont
      // un bout est d'équerre au nord, en biseau au sud, et l'autre arrondi.
      const eau =
        id === "etang"
          ? (x: number, z: number) => (z === 0 && x >= -1) || (x === 0 && z === 1) || (x === -1 && z === -1)
          : (_x: number, z: number) => z === 0;
      const formes: Record<string, number> = id === "berge" ? { "0,1": (1 << 0) | (2 << 6) } : {};
      g.add(
        terrain(
          cellsCarre(3, (x, z) =>
            eau(x, z) ? { sol: "EAU", forme: formes[`${x + 1},${z + 1}`] ?? 0 } : {},
          ),
        ),
      );
      pre(3).forEach(([x, z]) => g.add(dalle(x, z, eau(x, z) ? 0x4b3d2c : PRE[Math.abs(Math.round(x + z)) % 2]!, eau(x, z) ? -0.2 : 0)));
      break;
    }
    case "chemin-terre":
    case "chemin-gravier":
    case "chemin-pave": {
      const rev = id === "chemin-terre" ? "TERRE" : id === "chemin-gravier" ? "GRAVIER" : "PAVE";
      g.add(terrain(cellsCarre(3, (x, z) => (z === 0 || (x === 0 && z > 0) ? { revetement: rev } : {}))));
      sol(pre(3));
      break;
    }
    case "surelever":
    case "abaisser": {
      // Surélever : deux terrasses qui montent vers le fond. Abaisser : une
      // seule marche, plus basse.
      const niv = (x: number, z: number) =>
        id === "surelever" ? (z === -1 ? 2 : z === 0 && x >= 0 ? 1 : 0) : z === -1 || (z === 0 && x === 1) ? 1 : 0;
      g.add(terrain(cellsCarre(3, (x, z) => ({ niveau: niv(x, z), sol: z === 1 ? "PRE" : "PRE" }))));
      pre(3).forEach(([x, z]) => g.add(dalle(x, z, PRE[Math.abs(Math.round(x + z)) % 2]!, niv(x, z) * HAUTEUR_NIVEAU)));
      break;
    }
    case "pont": {
      const eau = (_x: number, z: number) => z === 0;
      g.add(terrain(cellsCarre(3, (x, z) => (eau(x, z) ? { sol: "EAU" } : {}))));
      pre(3).forEach(([x, z]) => g.add(dalle(x, z, eau(x, z) ? 0x4b3d2c : PRE[Math.abs(Math.round(x + z)) % 2]!, eau(x, z) ? -0.2 : 0)));
      g.add(objet("pont", [{ x: 0, z: 0, rot: 1 }]));
      break;
    }
    case "rampe": {
      const niv = (_x: number, z: number) => (z === -1 ? 1 : 0);
      g.add(terrain(cellsCarre(3, (x, z) => ({ niveau: niv(x, z) }))));
      pre(3).forEach(([x, z]) => g.add(dalle(x, z, PRE[Math.abs(Math.round(x + z)) % 2]!, niv(x, z) * HAUTEUR_NIVEAU)));
      g.add(objet("rampe", [{ x: 0, z: 0, rot: 0 }]));
      break;
    }
    case "boiser":
    case "couper": {
      // Boiser : les trois âges d'un bois, des plants à la futaie. Couper :
      // une futaie entamée, des souches, un fût à terre et la hache.
      const age = (x: number, z: number) =>
        id === "boiser" ? (z === -1 ? 1.2 : z === 0 ? 0.62 : 0.1) : x === 1 && z === 1 ? 0.02 : 1.2;
      const depuis = (x: number, z: number) => new Date(Date.now() - age(x, z) * BOIS_MATURITE_MS).toISOString();
      const sansBois = (x: number, z: number) => id === "couper" && (x === 0 || x === 1) && z === 1;
      g.add(terrain(cellsCarre(3, (x, z) => (sansBois(x, z) && !(x === 1 && z === 1) ? {} : { sol: "BOIS", boiseDepuis: depuis(x, z) }))));
      pre(3).forEach(([x, z]) => g.add(dalle(x, z, sansBois(x, z) && !(x === 1 && z === 1) ? PRE[0]! : 0x5a6b34)));
      if (id === "couper") {
        const bois = new THREE.MeshLambertMaterial({ color: 0x7a5535, flatShading: true });
        const coeur = new THREE.MeshLambertMaterial({ color: 0xe0c48e, flatShading: true });
        for (const [x, z] of [[-0.2, 0.9], [0.25, 1.15], [0.95, 0.75]] as const) {
          const souche = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 9), [bois, coeur, bois]);
          souche.position.set(x, TOP + 0.06, z);
          souche.castShadow = true;
          g.add(souche);
        }
        const fut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 9), [bois, coeur, coeur]);
        fut.rotation.z = Math.PI / 2;
        fut.rotation.y = 0.5;
        fut.position.set(0.05, TOP + 0.1, 0.6);
        fut.castShadow = true;
        g.add(fut);
        const manche = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.035), new THREE.MeshLambertMaterial({ color: 0xb08a55 }));
        manche.position.set(0.25, TOP + 0.3, 1.15);
        manche.rotation.z = -0.5;
        g.add(manche);
        const fer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.03), new THREE.MeshLambertMaterial({ color: 0x8b9096 }));
        fer.position.set(0.35, TOP + 0.48, 1.15);
        fer.rotation.z = -0.5;
        g.add(fer);
      }
      break;
    }
    case "haie":
    case "cloture":
      sol(pre(3));
      g.add(objet(id, [{ x: -1, z: 0, voisins: 2 }, { x: 0, z: 0, voisins: 10 }, { x: 1, z: 0, voisins: 8 }]));
      break;
    default: {
      // Un rond de pelouse à la taille de l'objet : il se lit posé, sans le
      // damier, et c'est l'objet qui remplit la vignette.
      const o = objet(id, [{ x: 0, z: 0 }]);
      const bo = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      const R = Math.max(bo.x, bo.z) / 2 + 0.22;
      const disque = new THREE.Mesh(
        new THREE.CylinderGeometry(R, R * 1.04, EP, 40),
        new THREE.MeshLambertMaterial({ color: 0x70a847 }),
      );
      disque.receiveShadow = true;
      g.add(disque);
      const bord = new THREE.Mesh(
        new THREE.CylinderGeometry(R * 1.05, R * 1.08, EP * 0.9, 40),
        new THREE.MeshLambertMaterial({ color: 0x6b4e30 }),
      );
      bord.position.y = -0.02;
      g.add(bord);
      g.add(o);
      recul = 1;
    }
  }
  return { groupe: g, recul };
}

const hemi = new THREE.HemisphereLight(0xffffff, 0x9ab87e, 1.2);
const sun = new THREE.DirectionalLight(0xfff2d4, 1.9);
sun.position.set(-4, 8, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -4;
sun.shadow.camera.right = 4;
sun.shadow.camera.top = 4;
sun.shadow.camera.bottom = -4;
sun.shadow.bias = -0.0005;

async function rendre(id: string): Promise<string> {
  const scene = new THREE.Scene();
  scene.add(hemi.clone(), sun.clone());
  const s2 = scene.children[1] as THREE.DirectionalLight;
  s2.castShadow = true;
  s2.shadow.mapSize.set(1024, 1024);
  Object.assign(s2.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  const { groupe, recul } = sceneDe(id);
  scene.add(groupe);
  const boite = new THREE.Box3().setFromObject(groupe);
  const centre = boite.getCenter(new THREE.Vector3());
  const taille = boite.getSize(new THREE.Vector3());
  // En vue plongeante, un objet haut monte à l'écran : sa hauteur compte.
  const r = Math.max(taille.x, taille.z, taille.y * 1.25) * 0.6 * recul + 0.08;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 0.1, 100);
  // Même regard que la ferme : trois quarts, de haut.
  const dir = new THREE.Vector3(1, 1.05, 1).normalize();
  cam.position.copy(centre).addScaledVector(dir, 20);
  cam.lookAt(centre);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL("image/webp", 0.92);
}

(window as unknown as { rendre: typeof rendre }).rendre = rendre;
document.title = "pret";
