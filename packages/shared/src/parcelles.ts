/**
 * La taille d'une parcelle — et pourquoi elles n'en avaient qu'une seule.
 *
 * ## Le signalement
 *
 * « Les parcelles ont toutes les mêmes tailles, il devrait y avoir des tailles
 * différentes ; seule la parcelle de base qu'on a tous devrait avoir une
 * taille standard. »
 *
 * Le reproche portait, et il était plus profond qu'un défaut d'affichage. Les
 * colonnes `gridW` et `gridH` existent depuis toujours sur `Parcel`, le client
 * les lit, la grille se dessine à la dimension reçue : rien n'empêchait une
 * parcelle de 16×16. C'est la **génération du monde** qui écrivait
 * `DEFAULT_GRID` dans les deux colonnes pour chacune des parcelles de chaque
 * région, sans exception. Une variable qui ne prend jamais qu'une valeur.
 *
 * Conséquence économique, plus gênante encore : `askPrice()` ne connaissait pas
 * la surface. Une parcelle se payait le même prix qu'elle fasse six hectares
 * ou vingt-cinq. Tant que toutes faisaient quatorze hectares, l'oubli ne se
 * voyait pas ; il devient une faille dès la première parcelle plus grande.
 * C'est `surfaceFactor()`, dans `land.ts`, qui le ferme.
 *
 * ## Pourquoi un tirage déterministe, et non une colonne au hasard
 *
 * La taille se **déduit** de la case du cadastre : même région, mêmes
 * coordonnées, même taille — pour tout le monde, pour toujours, sans rien
 * stocker de plus. Deux joueurs qui regardent la même commune y voient le même
 * parcellaire, et une base restaurée ne redistribue pas les terres.
 *
 * Les colonnes restent la source de vérité : le tirage sert à les **remplir**
 * (à la création du monde, puis au rattrapage des mondes déjà nés). Une
 * parcelle dont le joueur agrandirait la grille garderait sa valeur en base,
 * sans que ce module ait son mot à dire.
 *
 * ## Le carré, et ce qu'on y gagne
 *
 * Toutes les tailles sont carrées. Ce n'est pas un manque d'imagination : le
 * paysage pose les parcelles sur une trame régulière et retrouve celle qu'on
 * touche par une division (`parcelleSous`). Un parcellaire rectangulaire
 * demanderait une autre trame ; il reste possible plus tard, le stockage
 * l'accepte déjà.
 */

/**
 * La grille standard — celle de la parcelle de départ.
 *
 * Recopiée de `DEFAULT_GRID` plutôt qu'importée : le baril `index.ts` réexporte
 * ce module, l'importer en retour formerait un cycle. Le test
 * `taille-parcelle.test.ts` compare les deux et casse si elles divergent.
 */
export const GRILLE_STANDARD = { w: 12, h: 12 } as const;

/** Nombre de cases de la grille standard — l'unité à laquelle tout se compare. */
export const CASES_STANDARD = GRILLE_STANDARD.w * GRILLE_STANDARD.h;

/**
 * Une taille au catalogue, et sa fréquence.
 *
 * Le poids n'est pas une probabilité mais un nombre de parts : le tirage
 * additionne les parts et coupe. Les tailles moyennes dominent — un pays où
 * une parcelle sur cinq ferait vingt-cinq hectares ne ressemblerait à aucune
 * campagne — mais les extrêmes sont assez fréquents pour qu'on en ait un de
 * chaque côté en regardant autour de soi, ce qui était la demande exacte :
 * « qu'on ait des lots plus grands et plus petits à côté de chez soi ».
 */
export type TailleParcelle = {
  /** Côté de la grille, en cases. */
  cote: number;
  /** Parts dans le tirage. */
  poids: number;
  /** Ce qu'un voisin en dirait. */
  libelle: string;
};

export const TAILLES_PARCELLE: readonly TailleParcelle[] = [
  { cote: 8, poids: 3, libelle: "petit lot" },
  { cote: 10, poids: 5, libelle: "lot moyen" },
  { cote: 12, poids: 6, libelle: "lot standard" },
  { cote: 14, poids: 4, libelle: "grand lot" },
  { cote: 16, poids: 2, libelle: "très grand lot" },
];

/** Le plus petit et le plus grand côté au catalogue. */
export const COTE_MIN = Math.min(...TAILLES_PARCELLE.map((t) => t.cote));
export const COTE_MAX = Math.max(...TAILLES_PARCELLE.map((t) => t.cote));

/**
 * Rapport du plus grand côté au côté standard.
 *
 * Le paysage s'en sert pour écarter sa trame : le pas doit loger la plus
 * grande parcelle possible, sinon un très grand lot mordrait sur le chemin.
 */
export const ECART_COTE_MAX = COTE_MAX / GRILLE_STANDARD.w;

/**
 * Une empreinte 32 bits d'une chaîne — FNV-1a.
 *
 * Écrit ici plutôt qu'importé d'une bibliothèque : quelques lignes, aucun
 * besoin cryptographique, et surtout une valeur qui ne doit **jamais**
 * changer. Le
 * jour où cette fonction rendrait autre chose, tout le parcellaire des mondes
 * déjà nés se retrouverait en désaccord avec la base.
 */
export function empreinteTexte(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  /*
   * Le brassage final n'est pas cosmétique, et il a été ajouté après mesure.
   *
   * FNV-1a a une faiblesse connue sur ses bits de poids faible : la
   * multiplication ne les mélange qu'entre eux. Or c'est précisément eux qu'un
   * `% 20` consomme. Résultat, sur un échantillon de six cents cases, près de
   * cinq pour cent n'avaient ni lot plus grand ni lot plus petit dans les
   * vingt-quatre parcelles qu'on voit depuis chez soi — au lieu des quelques
   * millièmes qu'un tirage vraiment indépendant donnerait. Le parcellaire
   * était corrélé de proche en proche, ce qui est exactement le défaut qu'on
   * corrige.
   *
   * Les cinq lignes qui suivent sont l'avalanche finale de xorshift-multiply,
   * qui répartit l'entropie des bits hauts vers les bas.
   */
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** La clé d'une case du cadastre : région et coordonnées, rien d'autre. */
export function cleDeCase(zoneCode: string, mapX: number, mapY: number): string {
  return `${zoneCode}:${mapX}:${mapY}`;
}

/**
 * La taille d'une parcelle, déduite de sa case.
 *
 * Déterministe : la même case rend toujours la même grille. Le tirage est une
 * roulette pondérée sur `TAILLES_PARCELLE`.
 */
export function tailleDeParcelle(
  zoneCode: string,
  mapX: number,
  mapY: number,
): { w: number; h: number } {
  const total = TAILLES_PARCELLE.reduce((n, t) => n + t.poids, 0);
  let reste = empreinteTexte(cleDeCase(zoneCode, mapX, mapY)) % total;
  for (const t of TAILLES_PARCELLE) {
    reste -= t.poids;
    if (reste < 0) return { w: t.cote, h: t.cote };
  }
  /* Inatteignable : la somme des parts est exactement le modulo. Le repli rend
     le standard plutôt que de lever — une taille manquante ne doit jamais
     empêcher un monde de se créer. */
  return { w: GRILLE_STANDARD.w, h: GRILLE_STANDARD.h };
}

/**
 * Surface d'une grille, en hectares.
 *
 * Le nombre 14 est celui de `PARCEL_HECTARES` — même remarque que pour
 * `GRILLE_STANDARD` sur le cycle d'import, même test de non-divergence.
 */
export const HECTARES_STANDARD = 14;

export function hectaresDeGrille(w: number, h: number): number {
  const cases = Math.max(0, Math.round(w)) * Math.max(0, Math.round(h));
  return Math.round((cases / CASES_STANDARD) * HECTARES_STANDARD * 10) / 10;
}

/**
 * Comment nommer une parcelle par sa taille, face au lot standard.
 *
 * Sert dans la fiche du voisin et sur la carte : « 24,9 ha — très grand lot »
 * dit en trois mots ce qu'un chiffre nu ne dit pas, parce qu'il n'a pas de
 * point de comparaison tant qu'on n'a pas vu les autres.
 */
export function libelleDeTaille(w: number, h: number): string {
  const cases = Math.max(0, w) * Math.max(0, h);
  let choisi = TAILLES_PARCELLE[0]!;
  let ecart = Infinity;
  for (const t of TAILLES_PARCELLE) {
    const d = Math.abs(t.cote * t.cote - cases);
    if (d < ecart) {
      ecart = d;
      choisi = t;
    }
  }
  return choisi.libelle;
}
