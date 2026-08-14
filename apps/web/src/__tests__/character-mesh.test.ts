import * as THREE from "three";
import {
  BEARDS,
  CLOTHES,
  EARS,
  EYE_SHAPES,
  HAIRS,
  HATS,
  MOUTHS,
  NOSES,
  defaultAppearance,
  randomAppearance,
  type CharacterAppearance,
} from "@farmsim/shared";
import { HAT_LINE, createCharacterRig, headGap, headHalfWidth } from "../character-mesh";

/**
 * Le personnage, mesuré.
 *
 * Un bonhomme est plus fragile qu'un engin : ses pièces se posent au
 * millimètre sur un visage de trente centimètres, et **toute** combinaison
 * d'options doit tenir debout — il y en a des dizaines de milliers, et le
 * joueur en verra une que personne n'a jamais regardée. On vérifie donc ce qui
 * casse en silence : l'aplomb au sol, l'échelle, la présence des articulations
 * et le fait qu'une pièce choisie apparaisse vraiment.
 */

function look(over: Partial<CharacterAppearance> = {}): CharacterAppearance {
  return { ...defaultAppearance("CEREALIER"), ...over };
}

function bounds(appearance: CharacterAppearance, opts = {}) {
  const rig = createCharacterRig(appearance, opts);
  const box = new THREE.Box3().setFromObject(rig.group);
  rig.dispose();
  return box;
}

/** Nombre de sommets portés par une matière donnée, sous un nœud donné. */
function vertsIn(root: THREE.Object3D, material: string): number {
  let n = 0;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.name === material) n += mesh.geometry.getAttribute("position").count;
  });
  return n;
}

/** Idem, sur le personnage entier. */
function vertsOf(rig: { group: THREE.Object3D }, material: string): number {
  return vertsIn(rig.group, material);
}

/**
 * Sommets d'une ou plusieurs matières, ramenés dans le repère de la tête.
 *
 * C'est le repère où `headGap` et `faceZ` ont un sens : mesurer une barbe dans
 * le repère du monde reviendrait à mesurer aussi la posture du personnage.
 */
function headVerts(appearance: CharacterAppearance, ...materials: string[]): THREE.Vector3[] {
  const rig = createCharacterRig(appearance);
  const head = rig.joints.head!;
  rig.group.updateMatrixWorld(true);
  const toHead = new THREE.Matrix4().copy(head.matrixWorld).invert();
  const out: THREE.Vector3[] = [];
  head.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !materials.includes(mesh.name)) return;
    const pos = mesh.geometry.getAttribute("position");
    const m = new THREE.Matrix4().multiplyMatrices(toHead, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      out.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m));
    }
  });
  rig.dispose();
  return out;
}

/**
 * Le visage, au millimètre.
 *
 * Les reproches reçus sur le personnage — « c'est quoi ça », « bouche ouverte
 * horrible », « tout se superpose » — décrivent tous la même faute : une pièce
 * posée à une cote devinée au lieu d'être calée sur la surface du crâne. Elle
 * saillit, elle flotte, ou elle traverse la pièce voisine. Ces tests mesurent
 * ce que l'œil voit, pour que le défaut ne puisse pas revenir en silence.
 */
describe("les pièces du visage collent au crâne", () => {
  it("la moustache ne saillit pas de la joue", () => {
    // Elle lisait sa profondeur au **milieu** du visage alors qu'elle se pose
    // de part et d'autre : deux millimètres et demi d'erreur suffisent à
    // décoller un lobe de six.
    const proud = headVerts(look({ beard: BEARDS.findIndex((b) => b.id === "moustache") }), "beard");
    expect(proud.length).toBeGreaterThan(0);
    const worst = Math.max(...proud.map((p) => headGap(p.x, p.y, p.z)));
    expect(`saillie ${(worst * 1000).toFixed(1)} mm ${worst < 0.008}`).toBe(
      `saillie ${(worst * 1000).toFixed(1)} mm true`,
    );
  });

  it("la barbe pleine reste sur la mâchoire", () => {
    const verts = headVerts(look({ beard: BEARDS.findIndex((b) => b.id === "full") }), "beard");
    expect(verts.length).toBeGreaterThan(0);
    // La coquille partait de l'équateur du crâne : elle prenait les joues
    // entières et remontait jusqu'aux pommettes, d'où le pâté brun.
    // Les yeux sont à 176 mm : une barbe qui les atteint n'est plus une barbe.
    const top = Math.max(...verts.map((p) => p.y));
    expect(`haut ${top.toFixed(3)} ${top < 0.172}`).toBe(`haut ${top.toFixed(3)} true`);
    // Et elle ne fait pas le tour : le crâne va jusqu'à −158 mm en arrière,
    // une barbe s'arrête à hauteur d'oreille.
    const back = Math.min(...verts.map((p) => p.z));
    expect(`arrière ${back.toFixed(3)} ${back > -0.05}`).toBe(`arrière ${back.toFixed(3)} true`);
  });

  it("la barbe épouse la peau sans s'en détacher", () => {
    for (const b of BEARDS) {
      if (b.id === "none") continue;
      const verts = headVerts(look({ beard: BEARDS.indexOf(b) }), "beard");
      // Le seuil laisse la place à l'épaisseur réelle d'une barbe pleine — un
      // bon centimètre au menton. `headGap` normalise sur le plus grand rayon
      // du crâne, donc majore d'un quart sur les côtés : ce qu'il mesure à
      // seize millimètres en fait treize. Ce qu'on traque ici n'est pas
      // l'épaisseur mais le **décollement** — une pièce posée à côté du visage.
      const worst = Math.max(...verts.map((p) => headGap(p.x, p.y, p.z)));
      expect(`${b.id} ${(worst * 1000).toFixed(1)} mm ${worst < 0.018}`).toBe(
        `${b.id} ${(worst * 1000).toFixed(1)} mm true`,
      );
    }
  });
});

describe("le chapeau se pose sur la tête", () => {
  for (const h of HATS) {
    if (h.id === "none") continue;
    it(`${h.id} touche le crâne`, () => {
      const verts = headVerts(look({ hat: HATS.indexOf(h) }), "hat", "hatDark");
      expect(verts.length).toBeGreaterThan(0);
      // Un chapeau taillé plus large que le crâne ne se pose pas : il flotte
      // au-dessus, et l'entrée d'air se lit comme un défaut de montage. Le
      // rayon de coiffe était codé en dur à 138 mm pour un crâne qui en fait
      // 119 à cette hauteur.
      const nearest = Math.min(...verts.map((p) => Math.abs(headGap(p.x, p.y, p.z))));
      expect(`${h.id} jour ${(nearest * 1000).toFixed(1)} mm ${nearest < 0.008}`).toBe(
        `${h.id} jour ${(nearest * 1000).toFixed(1)} mm true`,
      );
    });
  }

  it("la coiffe est cotée sur le crâne, pas devinée", () => {
    // Le garde-fou du garde-fou : si la demi-largeur change, la valeur codée
    // en dur qu'on vient de retirer ne doit pas revenir par la fenêtre.
    expect(headHalfWidth(HAT_LINE)).toBeCloseTo(0.119, 3);
  });

  it("sous un chapeau, aucune mèche ne monte au-dessus de la coiffe", () => {
    for (const h of HATS) {
      if (h.id === "none") continue;
      for (const hair of HAIRS) {
        if (hair.id === "bald") continue;
        const verts = headVerts(look({ hat: HATS.indexOf(h), hair: HAIRS.indexOf(hair) }), "hair");
        if (!verts.length) continue;
        // La queue de cheval partait à 272 mm quand le bord du canotier est à
        // 213 : elle le traversait de part en part. Sous un chapeau, une mèche
        // sort par le bas du bord, jamais par le dessus.
        const top = Math.max(...verts.map((p) => p.y));
        expect(`${h.id}+${hair.id} ${top.toFixed(3)} ${top < HAT_LINE + 0.012}`).toBe(
          `${h.id}+${hair.id} ${top.toFixed(3)} true`,
        );
      }
    }
  });
});

describe("la bouche", () => {
  it("aucune bouche ne dépasse du visage", () => {
    for (const m of MOUTHS) {
      const verts = headVerts(look({ mouth: MOUTHS.indexOf(m) }), "mouth", "lip", "teeth");
      expect(verts.length).toBeGreaterThan(0);
      const worst = Math.max(...verts.map((p) => headGap(p.x, p.y, p.z)));
      expect(`${m.id} ${(worst * 1000).toFixed(1)} mm ${worst < 0.006}`).toBe(
        `${m.id} ${(worst * 1000).toFixed(1)} mm true`,
      );
    }
  });

  it("la bouche ouverte est une bouche, pas un trou", () => {
    const verts = headVerts(look({ mouth: MOUTHS.findIndex((m) => m.id === "open") }), "mouth");
    const w = Math.max(...verts.map((p) => p.x)) - Math.min(...verts.map((p) => p.x));
    const h = Math.max(...verts.map((p) => p.y)) - Math.min(...verts.map((p) => p.y));
    // Elle était un ovale sombre de 46 × 56 mm plaqué sur un visage qui en
    // fait 270 de haut : de loin, un trou noir au milieu de la figure. C'est
    // la hauteur qui la trahissait — une bouche est large et mince.
    expect(`${(w * 1000).toFixed(0)}×${(h * 1000).toFixed(0)} mm ${w < 0.06 && h < 0.026}`).toBe(
      `${(w * 1000).toFixed(0)}×${(h * 1000).toFixed(0)} mm true`,
    );
  });
});

describe("aplomb", () => {
  it("le personnage pose ses semelles sur le sol", () => {
    const box = bounds(look());
    expect(box.min.y).toBeGreaterThan(-0.005);
    expect(box.min.y).toBeLessThan(0.01);
  });

  it("il fait une taille d'homme, chapeau compris", () => {
    const box = bounds(look());
    // Le champ et l'atelier cadrent sur cette hauteur : elle ne doit pas
    // dériver au fil des retouches de silhouette.
    expect(box.max.y).toBeGreaterThan(1.6);
    expect(box.max.y).toBeLessThan(1.95);
  });

  it("il reste plus haut que large", () => {
    const box = bounds(look());
    const width = box.max.x - box.min.x;
    expect(width).toBeLessThan(box.max.y * 0.55);
  });

  it("l'accessoire de métier est planté au sol, pas enterré", () => {
    for (const spec of ["CEREALIER", "ELEVEUR"] as const) {
      const box = bounds(look(), { spec, prop: true });
      expect(box.min.y).toBeGreaterThan(-0.005);
    }
  });
});

describe("toutes les options tiennent debout", () => {
  const axes: [keyof CharacterAppearance, number][] = [
    ["hat", HATS.length],
    ["clothes", CLOTHES.length],
    ["hair", HAIRS.length],
    ["beard", BEARDS.length],
    ["eyeShape", EYE_SHAPES.length],
    ["nose", NOSES.length],
    ["mouth", MOUTHS.length],
    ["ears", EARS.length],
  ];

  for (const [key, len] of axes) {
    for (let i = 0; i < len; i++) {
      it(`${key} nº${i} garde l'aplomb et l'échelle`, () => {
        const box = bounds(look({ [key]: i }));
        expect(box.min.y).toBeGreaterThan(-0.005);
        expect(box.min.y).toBeLessThan(0.01);
        expect(box.max.y).toBeGreaterThan(1.6);
        expect(box.max.y).toBeLessThan(1.95);
      });
    }
  }

  it("cinquante tirages au hasard donnent cinquante personnages viables", () => {
    for (let i = 0; i < 50; i++) {
      const box = bounds(randomAppearance(i % 2 ? "ELEVEUR" : "CEREALIER"));
      expect(box.min.y).toBeGreaterThan(-0.005);
      expect(box.max.y).toBeLessThan(1.95);
      // Une boîte vide ou infinie signale une géométrie dégénérée.
      expect(Number.isFinite(box.max.x - box.min.x)).toBe(true);
    }
  });
});

describe("les pièces choisies apparaissent vraiment", () => {
  it("« Aucun » chapeau ne coiffe personne, chaque autre en pose un", () => {
    const none = createCharacterRig(look({ hat: 0, hair: HAIRS.length - 1 }));
    // La matière `hat` porte la couleur choisie pour le couvre-chef : rien
    // d'autre ne s'en sert.
    expect(vertsOf(none, "hat")).toBe(0);
    none.dispose();
    for (let i = 1; i < HATS.length; i++) {
      const rig = createCharacterRig(look({ hat: i, hair: HAIRS.length - 1 }));
      expect(vertsOf(rig, "hat")).toBeGreaterThan(0);
      rig.dispose();
    }
  });

  it("la couleur du chapeau ne déteint pas sur les vêtements", () => {
    const a = createCharacterRig(look({ hat: 1, hatColor: 0, clothColor: 0 }));
    const b = createCharacterRig(look({ hat: 1, hatColor: 3, clothColor: 0 }));
    const hue = (rig: ReturnType<typeof createCharacterRig>, name: string) => {
      let hex = -1;
      rig.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (hex < 0 && mesh.isMesh && mesh.name === name) {
          hex = (mesh.material as THREE.MeshStandardMaterial).color.getHex();
        }
      });
      return hex;
    };
    expect(hue(a, "hat")).not.toBe(hue(b, "hat"));
    expect(hue(a, "cloth")).toBe(hue(b, "cloth"));
    a.dispose();
    b.dispose();
  });

  it("un crâne rasé ne garde que les sourcils", () => {
    const bald = createCharacterRig(look({ hair: HAIRS.length - 1, beard: 0, hat: 0 }));
    const rase = vertsOf(bald, "hair");
    bald.dispose();
    // Les sourcils sont en cheveux eux aussi : « rasé » veut dire pas de
    // coiffure, pas un visage sans arcades.
    for (let i = 0; i < HAIRS.length - 1; i++) {
      const rig = createCharacterRig(look({ hair: i, beard: 0, hat: 0 }));
      expect(vertsOf(rig, "hair")).toBeGreaterThan(rase * 1.5);
      rig.dispose();
    }
  });

  it("chaque coiffure a sa propre masse", () => {
    const counts = HAIRS.map((_, i) => {
      const rig = createCharacterRig(look({ hair: i, beard: 0, hat: 0 }));
      const n = vertsOf(rig, "hair");
      rig.dispose();
      return n;
    });
    // Deux coiffures qui rendraient la même géométrie seraient un doublon
    // déguisé dans le menu.
    expect(new Set(counts).size).toBe(counts.length);
  });

  it("une barbe pleine met plus de poil qu'une moustache", () => {
    // Le poil du visage a sa matière propre : mesuré sur « hair », la barbe se
    // confondrait avec les sourcils et la coiffe.
    const full = createCharacterRig(look({ beard: BEARDS.length - 2, hair: HAIRS.length - 1 }));
    const tache = createCharacterRig(look({ beard: 2, hair: HAIRS.length - 1 }));
    expect(vertsOf(full, "beard")).toBeGreaterThan(vertsOf(tache, "beard"));
    full.dispose();
    tache.dispose();
  });

  it("un gilet laisse les bras nus, une veste les couvre", () => {
    const vest = createCharacterRig(look({ clothes: 5 }));
    const jacket = createCharacterRig(look({ clothes: 2 }));
    // Le bras nu est toujours construit — c'est la manche posée par-dessus qui
    // fait la différence, et elle vit sous l'articulation de l'épaule.
    expect(vertsIn(vest.joints.armR!, "cloth")).toBe(0);
    expect(vertsIn(jacket.joints.armR!, "cloth")).toBeGreaterThan(0);
    vest.dispose();
    jacket.dispose();
  });

  it("aucune tenue ne laisse le buste à nu", () => {
    // Les épaules et la taille sont des volumes distincts du buste. Une
    // version antérieure plaquait la veste et le gilet sur le seul buste :
    // les épaules ressortaient en blanc de part et d'autre, et le personnage
    // semblait porter une veste trouée. On vérifie donc que le tissu monte
    // bien jusqu'à l'épaule et redescend jusqu'à la taille.
    for (let i = 0; i < CLOTHES.length; i++) {
      const rig = createCharacterRig(look({ clothes: i }));
      const chest = rig.joints.chest!;
      for (const [lo, hi, où] of [
        [0.3, 0.38, "épaule"],
        [0.05, 0.12, "taille"],
      ] as const) {
        let covered = 0;
        chest.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh || (mesh.name !== "cloth" && mesh.name !== "linen")) return;
          const pos = mesh.geometry.getAttribute("position");
          for (let k = 0; k < pos.count; k++) {
            const y = pos.getY(k);
            if (y >= lo && y <= hi) covered++;
          }
        });
        expect(`${CLOTHES[i].id} ${où} ${covered > 0}`).toBe(`${CLOTHES[i].id} ${où} true`);
      }
      rig.dispose();
    }
  });

  it("changer de couleur ne change pas la géométrie", () => {
    const a = bounds(look({ clothColor: 0, hairColor: 0, skin: 0 }));
    const b = bounds(look({ clothColor: 4, hairColor: 5, skin: 6 }));
    expect(b.min.y).toBeCloseTo(a.min.y, 9);
    expect(b.max.y).toBeCloseTo(a.max.y, 9);
  });
});

describe("le squelette", () => {
  const JOINTS = [
    "hips",
    "chest",
    "head",
    "armL",
    "armR",
    "foreL",
    "foreR",
    "handL",
    "handR",
    "thighL",
    "thighR",
    "shinL",
    "shinR",
    "footL",
    "footR",
    "lidL",
    "lidR",
  ] as const;

  it("expose toutes ses articulations", () => {
    const rig = createCharacterRig(look());
    for (const j of JOINTS) expect(rig.joints[j]).toBeDefined();
    rig.dispose();
  });

  it("les articulations sont nommées dans la scène", () => {
    const rig = createCharacterRig(look());
    const names = new Set<string>();
    rig.group.traverse((o) => names.add(o.name));
    // Le modèle doit rester exploitable une fois exporté hors du jeu.
    for (const j of JOINTS) expect(names.has(j)).toBe(true);
    rig.dispose();
  });
});

describe("l'animation", () => {
  it("le pas suit la distance, pas le temps", () => {
    const rig = createCharacterRig(look());
    rig.update({ t: 2, distance: 1.1, walking: true });
    const first = rig.joints.thighL!.rotation.x;
    rig.update({ t: 40, distance: 1.1, walking: true });
    // Deux personnages à la même vitesse doivent poser le pied ensemble, quel
    // que soit le moment où ils sont apparus à l'écran.
    expect(rig.joints.thighL!.rotation.x).toBeCloseTo(first, 12);
    rig.dispose();
  });

  it("à l'arrêt, les jambes ne battent pas", () => {
    const rig = createCharacterRig(look());
    rig.update({ t: 5, distance: 3.3, walking: false });
    expect(rig.joints.thighL!.rotation.x).toBeCloseTo(0, 10);
    expect(rig.joints.thighR!.rotation.x).toBeCloseTo(0, 10);
    rig.dispose();
  });

  it("les jambes marchent en opposition", () => {
    const rig = createCharacterRig(look());
    rig.update({ t: 1, distance: 0.18, walking: true });
    const l = rig.joints.thighL!.rotation.x;
    const r = rig.joints.thighR!.rotation.x;
    expect(Math.sign(l)).toBe(-Math.sign(r));
    expect(Math.abs(l)).toBeGreaterThan(0.1);
    rig.dispose();
  });

  it("il respire même immobile", () => {
    const rig = createCharacterRig(look());
    rig.update({ t: 0, distance: 0 });
    const a = rig.joints.chest!.scale.z;
    rig.update({ t: 1.05, distance: 0 });
    expect(rig.joints.chest!.scale.z).not.toBeCloseTo(a, 4);
    rig.dispose();
  });

  it("le clignement finit par fermer les yeux", () => {
    const rig = createCharacterRig(look());
    let closed = 0;
    let openest = Infinity;
    for (let i = 0; i < 600; i++) {
      rig.update({ t: i * 0.05, distance: 0 });
      const x = rig.joints.lidL!.rotation.x;
      openest = Math.min(openest, x);
      if (x > 1.3) closed++;
    }
    // Un œil qui ne se ferme jamais est un regard de statue ; un œil qui reste
    // fermé est un bug.
    expect(closed).toBeGreaterThan(0);
    expect(openest).toBeLessThan(0.7);
    rig.dispose();
  });

  it("le salut lève le bras droit et le repose", () => {
    const rig = createCharacterRig(look());
    const restZ = rig.joints.armR!.rotation.z;
    for (let i = 0; i < 120; i++) rig.update({ t: i * 0.016, distance: 0, wave: 1 });
    expect(rig.joints.armR!.rotation.z).toBeLessThan(restZ - 1.5);
    for (let i = 0; i < 400; i++) rig.update({ t: 2 + i * 0.016, distance: 0, wave: 0 });
    expect(rig.joints.armR!.rotation.z).toBeCloseTo(restZ, 2);
    rig.dispose();
  });

  it("au travail, il se penche sur l'ouvrage", () => {
    const rig = createCharacterRig(look());
    for (let i = 0; i < 300; i++) rig.update({ t: i * 0.016, distance: 0, working: false });
    const droit = rig.joints.chest!.rotation.x;
    for (let i = 0; i < 300; i++) rig.update({ t: i * 0.016, distance: 0, working: true });
    expect(rig.joints.chest!.rotation.x).toBeGreaterThan(droit + 0.25);
    rig.dispose();
  });

  it("l'animation ne fait jamais passer les pieds sous le sol", () => {
    const rig = createCharacterRig(look());
    let lowest = Infinity;
    for (let i = 0; i < 240; i++) {
      rig.update({ t: i * 0.03, distance: i * 0.06, walking: true });
      rig.group.updateMatrixWorld(true);
      lowest = Math.min(lowest, new THREE.Box3().setFromObject(rig.group).min.y);
    }
    // Le pas fait pivoter la cheville : si l'aplomb n'était juste qu'au repos,
    // le personnage patinerait dans la terre à chaque foulée.
    expect(lowest).toBeGreaterThan(-0.06);
    rig.dispose();
  });
});
