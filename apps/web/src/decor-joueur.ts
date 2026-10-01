import * as THREE from "three";
import {
  TEINTES_DECO,
  articleDeco,
  cerclesDeco,
  type ArticleDeco,
  type Decoration,
} from "@farmsim/shared";
import { tourner } from "./countryside-plan";
import { chevauchent, empreinteArbre, marge, type Forme, type Genre, type Occupant } from "./placement";
import { MODELES_DISPONIBLES, animerDecor, poserPiece } from "./modeles-decor";

/**
 * La décoration du joueur, dans la scène.
 *
 * Ce que le joueur pose autour de sa ferme (`packages/shared/src/decoration.ts`)
 * vit ici : conversion entre le repère du siège, où la décoration est
 * enregistrée, et celui de la scène ; son emprise au sol dans les règles du
 * décor (`placement.ts`) ; la validation d'une pose ; et les modèles de la
 * forge qui la dessinent, avec le fantôme vert ou rouge qui suit le
 * pointeur.
 */

/** Le repère de la ferme : orientation de la carte et place du siège. */
export type RepereFerme = { quart: 0 | 1 | 2 | 3; mx: number; mz: number };

/* ------------------------------------------------------------------ */
/* Repères                                                             */
/* ------------------------------------------------------------------ */

/**
 * Du repère du siège vers la scène. Le quart de tour de la carte fait
 * tourner la position autour du siège, et le cap avec elle : `tourner` envoie
 * l'axe des x sur celui des z au premier quart, ce qui est une rotation de
 * −90° autour de y.
 */
export function versScene(
  d: { x: number; z: number; rot: number },
  r: RepereFerme,
): { x: number; z: number; rot: number } {
  const t = tourner({ col: d.x, rang: d.z }, r.quart);
  return { x: t.col + r.mx, z: t.rang + r.mz, rot: d.rot - (r.quart * Math.PI) / 2 };
}

/** De la scène vers le repère du siège — l'inverse exact de `versScene`. */
export function versSiege(
  p: { x: number; z: number; rot: number },
  r: RepereFerme,
): { x: number; z: number; rot: number } {
  const inverse = ((4 - r.quart) % 4) as 0 | 1 | 2 | 3;
  const t = tourner({ col: p.x - r.mx, rang: p.z - r.mz }, inverse);
  return { x: t.col, z: t.rang, rot: p.rot + (r.quart * Math.PI) / 2 };
}

/* ------------------------------------------------------------------ */
/* Emprise et validation                                               */
/* ------------------------------------------------------------------ */

/** Hauteur d'un article posé, en unités de scène. */
export function hauteurDeco(a: ArticleDeco): number {
  return a.taille[1] * a.echelle;
}

/** L'emprise au sol d'un article posé en (x, z, cap) de la scène. */
export function empreinteDeco(
  a: ArticleDeco,
  x: number,
  z: number,
  rot: number,
): { genre: Genre; forme: Forme }[] {
  if (a.emprise === "arbre") return empreinteArbre(x, z, hauteurDeco(a) / 1.15);
  const genre: Genre = a.emprise === "dalle" ? "dalle" : a.emprise === "eau" ? "eau" : "objet";
  return cerclesDeco(a, x, z, rot).map((c) => ({ genre, forme: { type: "cercle" as const, ...c } }));
}

/**
 * Les occupants d'une liste de décorations, en coordonnées de scène. C'est
 * ce que reçoit le plan de campagne : les arbres et les détails de l'herbe
 * tirés au sort leur laissent la place.
 */
export function occupantsDeco(decos: readonly Decoration[], r: RepereFerme): Occupant[] {
  const out: Occupant[] = [];
  for (const d of decos) {
    const a = articleDeco(d.code);
    if (!a) continue;
    const p = versScene(d, r);
    for (const e of empreinteDeco(a, p.x, p.z, p.rot)) out.push({ id: `deco-${d.id}`, ...e });
  }
  return out;
}

/**
 * Peut-on poser `a` en (x, z, cap) de la scène ?
 *
 * `durs` : ce que le décor tient pour fixe — routes, chemins, cour, île,
 * champs, lieux du village (les arbres et touffes tirés au sort n'en sont
 * pas : ils cèdent la place). `autres` : les décorations déjà posées, en
 * occupants de scène, sans celle qu'on déplace.
 *
 * Renvoie `null` si la place est libre, sinon ce qui gêne.
 */
export function gene(
  a: ArticleDeco,
  x: number,
  z: number,
  rot: number,
  durs: readonly Occupant[],
  autres: readonly Occupant[],
): Occupant | null {
  const parts = empreinteDeco(a, x, z, rot);
  for (const liste of [durs, autres]) {
    for (const o of liste) {
      for (const p of parts) {
        const m = marge(p.genre, o.genre);
        if (m !== null && chevauchent(p.forme, o.forme, m)) return o;
      }
    }
  }
  return null;
}

/** Ce qu'on dit au joueur d'un occupant qui gêne. */
export function raisonGene(o: Occupant): string {
  if (o.id.startsWith("deco-")) return "Déjà occupé par une décoration";
  switch (o.genre) {
    case "route":
      return "Pas sur la route";
    case "chemin":
      return "Pas sur le chemin";
    case "cour":
      return "Pas dans la cour";
    case "ile":
      return "Pas dans les champs de la ferme";
    case "parcelle":
      return "Pas dans un champ";
    case "batiment":
      return "Pas sur un bâtiment";
    case "eau":
      return "Pas dans l'eau";
    case "tronc":
      return "Trop près d'un arbre";
    default:
      return "La place est prise";
  }
}

/* ------------------------------------------------------------------ */
/* La scène                                                            */
/* ------------------------------------------------------------------ */

const URL_ASSET = (asset: string) => `/assets/decor3d/${asset}.glb`;

/** Repeint la matière `nom` d'un clone, sans toucher au modèle partagé. */
function repeindre(objet: THREE.Object3D, nom: string, hex: string): void {
  const couleur = new THREE.Color(hex);
  objet.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const neufs = mats.map((m) => {
      if (m.name !== nom) return m;
      const c = (m as THREE.MeshStandardMaterial).clone();
      c.color.copy(couleur);
      c.userData.decoPropre = true;
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? neufs : neufs[0]!;
  });
}

/** Le voile du fantôme : vert si la place est libre, rouge sinon. */
const VOILE_LIBRE = new THREE.MeshBasicMaterial({
  color: 0x5fd35f,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});
const VOILE_PRIS = new THREE.MeshBasicMaterial({
  color: 0xe0503a,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

/** Un anneau au sol : l'emprise, lisible même sous un objet plat. */
function anneau(r: number): THREE.Mesh {
  const g = new THREE.RingGeometry(Math.max(0.05, r - 0.06), r, 40).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, VOILE_LIBRE);
  m.position.y = 0.02;
  m.renderOrder = 2;
  return m;
}

/**
 * Tout ce que le joueur a posé, plus le fantôme de ce qu'il s'apprête à
 * poser. La vue le crée une fois, lui passe le repère et les occupants du
 * décor à chaque campagne, et la liste à chaque changement.
 */
export class DecorJoueur {
  readonly group = new THREE.Group();
  private repere: RepereFerme = { quart: 0, mx: 0, mz: 0 };
  private durs: Occupant[] = [];
  private liste: Decoration[] = [];
  /** id → objet posé, et la signature de ce qu'il dessine. */
  private poses = new Map<string, { objet: THREE.Object3D; cle: string }>();
  private selection: string | null = null;
  private halo: THREE.Mesh | null = null;

  private fantome: THREE.Group | null = null;
  private fantomeCle = "";
  private fantomeArticle: ArticleDeco | null = null;
  private fantomeRot = 0;
  private fantomeSans: string | null = null;
  private fantomeLibre = false;
  private fantomeRaison: string | null = null;
  private fantomePos: { x: number; z: number } | null = null;

  constructor(
    private shadows: boolean,
    y: number,
  ) {
    this.group.name = "decor-joueur";
    this.group.position.y = y;
  }

  /** Nouveau repère ou nouvelle campagne : tout se replace. */
  setTerrain(repere: RepereFerme, durs: readonly Occupant[]): void {
    const bouge =
      repere.quart !== this.repere.quart || repere.mx !== this.repere.mx || repere.mz !== this.repere.mz;
    this.repere = repere;
    this.durs = [...durs];
    if (bouge) for (const [id, p] of this.poses) this.placer(p.objet, this.liste.find((d) => d.id === id));
    this.revaliderFantome();
  }

  /** La liste à dessiner. Seul ce qui a changé est rechargé. */
  setDecorations(liste: readonly Decoration[], selection: string | null): void {
    this.liste = [...liste];
    const vus = new Set<string>();
    for (const d of liste) {
      vus.add(d.id);
      const a = articleDeco(d.code);
      if (!a) continue;
      const cle = `${d.code}:${d.teinte ?? ""}`;
      const deja = this.poses.get(d.id);
      if (deja && deja.cle === cle) {
        this.placer(deja.objet, d);
        continue;
      }
      if (deja) this.retirer(d.id);
      this.charger(a, d.teinte).then((objet) => {
        if (!objet) return;
        // Une liste plus récente a pu retirer ou remplacer celle-ci entre-temps.
        const actuelle = this.liste.find((x) => x.id === d.id);
        if (!actuelle || `${actuelle.code}:${actuelle.teinte ?? ""}` !== cle || this.poses.has(d.id)) {
          this.jeter(objet);
          return;
        }
        objet.userData.decoId = d.id;
        this.placer(objet, actuelle);
        this.group.add(objet);
        this.poses.set(d.id, { objet, cle });
        this.majSelection();
      });
    }
    for (const id of [...this.poses.keys()]) if (!vus.has(id)) this.retirer(id);
    this.selection = selection;
    this.majSelection();
    this.revaliderFantome();
  }

  /**
   * L'article en main (ou `null`), son cap et sa teinte. `sans` : la
   * décoration qu'on déplace — elle ne se gêne pas elle-même, et on la cache
   * le temps du déplacement.
   */
  setFantome(a: ArticleDeco | null, rot: number, teinte: number | undefined, sans: string | null): void {
    this.fantomeArticle = a;
    this.fantomeRot = rot;
    if (sans !== this.fantomeSans) {
      if (this.fantomeSans) {
        const ancien = this.poses.get(this.fantomeSans);
        if (ancien) ancien.objet.visible = true;
      }
      this.fantomeSans = sans;
    }
    if (sans) {
      const p = this.poses.get(sans);
      if (p) p.objet.visible = false;
    }
    const cle = a ? `${a.code}:${teinte ?? ""}` : "";
    if (cle !== this.fantomeCle) {
      this.fantomeCle = cle;
      if (this.fantome) {
        this.group.remove(this.fantome);
        this.jeter(this.fantome);
        this.fantome = null;
      }
      if (a) {
        const g = new THREE.Group();
        g.name = "fantome";
        g.visible = false;
        const rayon = Math.max(...empreinteDeco(a, 0, 0, 0).map((p) =>
          p.forme.type === "cercle" ? Math.hypot(p.forme.x, p.forme.z) + p.forme.r : 0.5,
        ));
        g.add(anneau(a.emprise === "arbre" ? hauteurDeco(a) * 0.17 : rayon));
        this.fantome = g;
        this.group.add(g);
        this.charger(a, teinte).then((objet) => {
          if (!objet || this.fantome !== g) {
            if (objet) this.jeter(objet);
            return;
          }
          objet.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) {
              m.castShadow = false;
              m.userData.matiereVraie = m.material;
            }
          });
          objet.name = "fantome-modele";
          g.add(objet);
          this.peindreFantome();
        });
      }
    }
    if (this.fantome) this.fantome.rotation.y = rot;
    this.revaliderFantome();
  }

  /** Le pointeur est au-dessus de (x, z) de la scène. */
  bougerFantome(p: { x: number; z: number } | null): void {
    this.fantomePos = p;
    this.revaliderFantome();
  }

  /** Où poserait le fantôme, dans le repère du siège ; `null` s'il n'a pas de place. */
  poseFantome(): { x: number; z: number; rot: number } | null {
    if (!this.fantomeArticle || !this.fantomePos || !this.fantomeLibre) return null;
    const s = versSiege({ ...this.fantomePos, rot: this.fantomeRot }, this.repere);
    return { x: Math.round(s.x * 100) / 100, z: Math.round(s.z * 100) / 100, rot: s.rot };
  }

  /** Pourquoi le fantôme est rouge, ou `null`. */
  raison(): string | null {
    return this.fantomeRaison;
  }

  /**
   * La décoration sous le rayon, s'il y en a une. Un poteau de lanterne ou
   * une guirlande ne font que quelques pixels de large : à défaut de les
   * toucher, on prend la décoration la plus proche du point du sol visé,
   * dans son emprise élargie d'un tiers d'unité.
   */
  toucher(rayon: THREE.Raycaster, auSol: { x: number; z: number } | null = null): string | null {
    const cibles = [...this.poses.values()].map((p) => p.objet).filter((o) => o.visible);
    for (const hit of rayon.intersectObjects(cibles, true)) {
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        const id = o.userData.decoId as string | undefined;
        if (id) return id;
      }
    }
    if (!auSol) return null;
    let meilleur: { id: string; d: number } | null = null;
    for (const d of this.liste) {
      const a = articleDeco(d.code);
      if (!a || !this.poses.get(d.id)?.objet.visible) continue;
      const p = versScene(d, this.repere);
      for (const c of cerclesDeco(a, p.x, p.z, p.rot)) {
        const ecart = Math.hypot(auSol.x - c.x, auSol.z - c.z) - c.r;
        if (ecart < 0.35 && (!meilleur || ecart < meilleur.d)) meilleur = { id: d.id, d: ecart };
      }
    }
    return meilleur?.id ?? null;
  }

  /** Les lanternes et le moulin s'animent comme les décors de la forge. */
  update(t: number): void {
    for (const p of this.poses.values()) animerDecor(p.objet, t);
  }

  dispose(): void {
    for (const id of [...this.poses.keys()]) this.retirer(id);
    if (this.fantome) this.jeter(this.fantome);
    this.fantome = null;
    this.group.removeFromParent();
  }

  /* — interne ———————————————————————————————————————————— */

  private async charger(a: ArticleDeco, teinte: number | undefined): Promise<THREE.Object3D | null> {
    if (!MODELES_DISPONIBLES) return null;
    try {
      const objet = await poserPiece(URL_ASSET(a.asset), a.piece, this.shadows);
      objet.scale.setScalar(a.echelle);
      if (a.teinte && teinte != null && TEINTES_DECO[teinte]) repeindre(objet, a.teinte, TEINTES_DECO[teinte]!.hex);
      const racine = new THREE.Group();
      racine.add(objet);
      return racine;
    } catch {
      return null;
    }
  }

  private placer(objet: THREE.Object3D, d: Decoration | undefined): void {
    if (!d) return;
    const p = versScene(d, this.repere);
    objet.position.set(p.x, 0, p.z);
    objet.rotation.y = p.rot;
  }

  private retirer(id: string): void {
    const p = this.poses.get(id);
    if (!p) return;
    this.group.remove(p.objet);
    this.jeter(p.objet);
    this.poses.delete(id);
  }

  /** Ne libère que ce qui appartient au clone : la géométrie est partagée. */
  private jeter(objet: THREE.Object3D): void {
    objet.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const x of mats) if (x.userData.decoPropre) x.dispose();
      if (m.geometry.type === "RingGeometry") m.geometry.dispose();
    });
  }

  private majSelection(): void {
    if (this.halo) {
      this.halo.removeFromParent();
      this.halo.geometry.dispose();
      (this.halo.material as THREE.Material).dispose();
      this.halo = null;
    }
    const p = this.selection ? this.poses.get(this.selection) : null;
    const d = this.selection ? this.liste.find((x) => x.id === this.selection) : null;
    const a = d ? articleDeco(d.code) : null;
    if (!p || !a) return;
    const r = Math.max(0.3, (Math.max(a.taille[0], a.taille[2]) * a.echelle) / 2 + 0.08);
    const halo = anneau(r);
    halo.material = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false });
    halo.material.userData.decoPropre = true;
    p.objet.add(halo);
    this.halo = halo;
  }

  private occupantsSans(): Occupant[] {
    return occupantsDeco(
      this.liste.filter((d) => d.id !== this.fantomeSans),
      this.repere,
    );
  }

  private revaliderFantome(): void {
    const g = this.fantome;
    const a = this.fantomeArticle;
    if (!g || !a) return;
    if (!this.fantomePos) {
      g.visible = false;
      this.fantomeLibre = false;
      this.fantomeRaison = null;
      return;
    }
    g.visible = true;
    g.position.set(this.fantomePos.x, 0, this.fantomePos.z);
    const o = gene(a, this.fantomePos.x, this.fantomePos.z, this.fantomeRot, this.durs, this.occupantsSans());
    this.fantomeLibre = !o;
    this.fantomeRaison = o ? raisonGene(o) : null;
    this.peindreFantome();
  }

  private peindreFantome(): void {
    const g = this.fantome;
    if (!g) return;
    const voile = this.fantomeLibre ? VOILE_LIBRE : VOILE_PRIS;
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.geometry.type === "RingGeometry") {
        m.material = voile;
        return;
      }
      // Libre : l'objet sous ses vraies couleurs, un peu transparent serait
      // illisible — on garde ses couleurs. Pris : tout en rouge.
      m.material = this.fantomeLibre ? (m.userData.matiereVraie as THREE.Material) : voile;
    });
  }
}
