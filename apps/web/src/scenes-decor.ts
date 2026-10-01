/**
 * Des scènes composées avec les décors de la forge — comme le jeu les
 * posera : chaque élément est une pièce d'un `.glb`, clonée et placée.
 *
 * Ce sont les « merveilles » des références (fête des récoltes, source
 * chaude) : aucune pièce ne fait la scène à elle seule, c'est la densité de
 * petites choses bien placées. L'atelier (`decor.html?scene=…`) les montre
 * sous l'ambiance du jeu, à n'importe quelle heure et par tous les temps.
 *
 * Repère du jeu : x vers la droite, z vers la caméra, y en haut ; `rot` en
 * radians autour de y ; les pièces regardent +z.
 */

export interface PoseDecor {
  asset: string;
  piece: string;
  x: number;
  z: number;
  y?: number;
  rot?: number;
  echelle?: number;
}

export interface SceneDecor {
  titre: string;
  /** Rayon de l'île sous la scène. */
  rayon: number;
  poses: PoseDecor[];
}

const p = (asset: string, piece: string, x: number, z: number, rot = 0, echelle = 1, y = 0): PoseDecor => ({
  asset,
  piece,
  x,
  z,
  rot,
  echelle,
  y,
});

/** Des pieds de lavande semés en bordure, pour la densité. */
function lavandes(points: [number, number][]): PoseDecor[] {
  return points.map(([x, z], i) => p("nature", "lavande", x, z, i * 1.3, 0.9 + (i % 3) * 0.12));
}

export const SCENES: Record<string, SceneDecor> = {
  "fete-des-recoltes": {
    titre: "Fête des récoltes — moulin, épouvantail, serre",
    rayon: 11,
    poses: [
      // Le moulin sur sa butte en terrasses, au fond à gauche.
      p("sol", "terrasses", -5.2, -4.2, 0.3),
      p("moulin", "moulin", -4.5, -4.8, 0.4, 0.62, 1.35),
      // Les trois étals, en arc face à la caméra.
      p("etal", "etal-vert", -1.6, 0.6, 0.25),
      p("etal", "etal-rouge", 1.7, -0.5, 0),
      p("etal", "etal-orange", 4.9, -1.3, -0.25),
      // Guirlandes de fanions et lumineuse au-dessus de la place.
      p("fete", "guirlande", 1.6, 2.4, 0.08),
      p("fete", "guirlande-lumineuse", 2.4, -3.1, -0.1),
      // La serre, l'épouvantail, la ruche.
      p("serre", "serre", 4.4, 4.1, -0.3, 0.9),
      p("epouvantail", "epouvantail", -4.6, 3.1, 0.5),
      p("jardin", "ruche-paille", -2.6, 4.7, 0.2),
      // Ce qui traîne : foin, citrouilles, sacs, tonneau, lanternes.
      p("fete", "botte-de-foin", 0.6, 3.6, 0.4),
      p("fete", "citrouilles", -0.6, 2.7, 0.3),
      p("fete", "citrouilles", 6.4, 1.3, -0.8),
      p("fete", "citrouille", 2.1, 4.4, 0),
      p("jardin", "sacs", 3.2, 1.3, 0.2),
      p("fete", "tonneau", -2.9, -1.7, 0),
      p("fete", "caisse", -3.6, -0.9, 0.4),
      p("fete", "lanterne", -3.3, 1.2, 0.8),
      p("fete", "lanterne", 7.0, -2.8, -0.6),
      // Le paysage autour.
      p("nature", "arbre-rond-automne", -8.2, 1.2, 0),
      p("nature", "arbre-rond-2", 7.8, -5.6, 1),
      p("nature", "arbre-rond-1", -1.2, -7.4, 2),
      p("nature", "sapin-1", 8.5, 2.2, 0),
      p("nature", "buisson-2", -6.8, -0.4, 0),
      p("nature", "buisson-roses", 7.2, 5.4, 0),
      p("nature", "roseaux", -9.2, 4.6, 0),
      p("nature", "roseaux", 9.4, 5.8, 1),
      ...lavandes([
        [-5.8, 5.4], [-3.9, 6.6], [-1.2, 6.2], [1.4, 6.8], [3.1, 7.4], [-7.2, 3.2],
        [-6.4, 7.2], [6.1, -4.2], [3.9, -5.4], [0.6, -5.6], [-2.6, -5.8], [9.0, -1.0],
      ]),
    ],
  },
  "source-chaude": {
    titre: "Source chaude — le jardin de pierre",
    rayon: 8.5,
    poses: [
      p("source_chaude", "source-chaude", 0, 0, 0),
      p("nature", "arbre-rond-1", -5.4, -3.6, 0.5),
      p("nature", "arbre-rond-3", 4.6, -4.8, 2),
      p("nature", "sapin-2", -6.2, 1.8, 0),
      p("nature", "buisson-roses", 4.4, 3.4, 0),
      p("nature", "buisson-1", -4.2, 4.2, 0),
      p("nature", "rocher-3", 5.8, -0.6, 0.6, 0.7),
      p("nature", "roseaux", 6.4, 2.2, 0),
      p("jardin", "banc", 3.2, 4.4, -0.6),
      p("jardin", "pots-fleurs", 1.4, 4.6, 0),
      p("jardin", "ruche-paille", -3.4, -5.4, 0.3),
      ...lavandes([[-4.6, 2.6], [-3.4, 5.6], [5.4, 1.2], [3.6, -3.2], [-1.4, -4.8], [0.4, 5.8], [6.2, -2.6]]),
    ],
  },
};
