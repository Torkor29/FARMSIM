/**
 * Le catalogue des engins : cinq paliers, calés sur des machines réelles.
 *
 * ## Pourquoi cinq, et pas trois
 *
 * Trois tailles anonymes (T1 ×1, T2 ×1,6, T3 ×2,4) ne racontaient rien : on
 * achetait « plus large ». Cinq modèles, chacun inspiré d'un engin du marché,
 * donnent une progression lisible — de la petite exploitation au haut de
 * gamme — et une base solide pour les assets 3D (proportions, cabine, largeur
 * de coupe, roues).
 *
 * ## Prix de jeu, pas tarif catalogue
 *
 * Les montants sont des **prix cibles du jeu, inspirés du marché**. Un 6R 250
 * neuf se négocie autour de 230 000 € TTC selon options ; une exploitation de
 * quatorze hectares n'en achète pas. L'ancre reste le capital matériel à
 * l'hectare : le palier 1 est du matériel d'occasion de petite ferme (inchangé),
 * les paliers 4 et 5 coûtent assez cher — à l'achat **et** à l'entretien —
 * pour qu'on se demande si on en a réellement besoin.
 *
 * Les noms affichés sont génériques. `inspiredBy` est la référence interne
 * (dimensions, 3D) : les marques restent hors licence commerciale.
 */

export type MachineTier = 1 | 2 | 3 | 4 | 5;

export const MACHINE_TIERS: readonly MachineTier[] = [1, 2, 3, 4, 5];

/** Ce que le palier raconte, au-delà du numéro. */
export const TIER_ROLE_LABELS: Record<MachineTier, string> = {
  1: "Petite exploitation",
  2: "En développement",
  3: "Professionnelle",
  4: "Grande exploitation",
  5: "Haut de gamme",
};

export const TIER_LABELS: Record<MachineTier, string> = {
  1: "T1",
  2: "T2",
  3: "T3",
  4: "T4",
  5: "T5",
};

/**
 * Échelle du mesh 3D. Un T5 n’est pas cinq fois plus gros : il se lit plus
 * imposant sur la cour, sans déborder du hangar.
 */
export function machineMeshScale(tier: MachineTier = 1): number {
  return ([1, 1.05, 1.11, 1.18, 1.26] as const)[tier - 1] ?? 1;
}

/**
 * Cinq notes, 1 à 5. Plus haut = mieux — sauf la consommation, notée en
 * sobriété : cinq étoiles, ça boit peu.
 *
 * Un T5 n'est pas meilleur partout : le géant 517 ch est puissant et large,
 * il est aussi gourmand. C'est ce qui empêche d'acheter « le plus gros chiffre ».
 */
export type MachineStars = {
  puissance: 1 | 2 | 3 | 4 | 5;
  vitesse: 1 | 2 | 3 | 4 | 5;
  capacite: 1 | 2 | 3 | 4 | 5;
  sobriete: 1 | 2 | 3 | 4 | 5;
  fiabilite: 1 | 2 | 3 | 4 | 5;
};

/** Les cinq notes du garage, dans l’ordre d’affichage. */
export const MACHINE_STAR_LABELS: { key: keyof MachineStars; short: string; title: string }[] = [
  { key: "puissance", short: "Puiss.", title: "Puissance" },
  { key: "vitesse", short: "Vit.", title: "Vitesse de chantier" },
  { key: "capacite", short: "Cap.", title: "Capacité / largeur" },
  { key: "sobriete", short: "Sobr.", title: "Sobriété — plus haut, ça boit moins" },
  { key: "fiabilite", short: "Fiab.", title: "Fiabilité" },
];

export type MachineVariant = {
  /** Nom affiché — générique, sans marque. */
  label: string;
  /**
   * SKU réel à copier (silhouette, proportions, accessoires).
   * Interne : les marques ne s’affichent pas au joueur.
   */
  inspiredBy: string;
  /** Ce que le mesh 3D doit reprendre, en une phrase. */
  copy: string;
  /** Prix cible du jeu, en euros. */
  cost: number;
  /** Chevaux disponibles (tracteur, automoteur). */
  powerHp?: number;
  /** Chevaux exigés pour atteler (outil). */
  requiredHp?: number;
  /** Largeur de travail, mètres. Zéro pour un tracteur. */
  widthM: number;
  /** Vitesse de chantier, km/h. */
  speedKmh: number;
  /** Heures pour user 100 points de condition, soin neutre. */
  lifeHours: number;
  /** Trémie / benne, litres — affichage, pas encore une contrainte de chantier. */
  capacityL?: number;
  /** Ce que ce palier débloque, en une phrase. */
  bonus: string;
  stars: MachineStars;
};

export type MachineCatalog = {
  TRACTOR: Record<MachineTier, MachineVariant>;
  HARVESTER: Record<MachineTier, MachineVariant>;
  FORAGE_HARVESTER: Record<MachineTier, MachineVariant>;
  PLOUGH: Record<MachineTier, MachineVariant>;
  SEEDER: Record<MachineTier, MachineVariant>;
  SPREADER: Record<MachineTier, MachineVariant>;
  DISC_HARROW: Record<MachineTier, MachineVariant>;
  MOWER: Record<MachineTier, MachineVariant>;
  SPRAYER: Record<MachineTier, MachineVariant>;
  BALER: Record<MachineTier, MachineVariant>;
  TRAILER: Record<MachineTier, MachineVariant>;
};

const CATALOGUE: MachineCatalog = {
  TRACTOR: {
    1: {
      label: "Utilitaire 115",
      inspiredBy: "John Deere 6M 115",
      copy: "Capot court 4 cyl, cabine 6M, roues arrière nettement plus grandes, garde-boue simples.",
      cost: 14000,
      powerHp: 115,
      widthM: 0,
      speedKmh: 10,
      lifeHours: 700,
      bonus: "Polyvalent de petite ferme — outils jusqu’à ~3 m.",
      stars: { puissance: 2, vitesse: 2, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Polyvalent 145",
      inspiredBy: "John Deere 6R 145",
      copy: "Capot 6R plus long, calandre à lames, cabine panoramique, mêmes trains étroits.",
      cost: 32200,
      powerHp: 145,
      widthM: 0,
      speedKmh: 11,
      lifeHours: 750,
      bonus: "+ puissance : attelle les outils T2 (jusqu’à ~4 m).",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Céréalier 185",
      inspiredBy: "John Deere 6R 185",
      copy: "6R 6 cyl : capot plus haut, empattement allongé, jantes plus larges.",
      cost: 63000,
      powerHp: 185,
      widthM: 0,
      speedKmh: 12,
      lifeHours: 800,
      bonus: "Exploitation professionnelle — outils jusqu’à ~6 m.",
      stars: { puissance: 3, vitesse: 3, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Lourd 250",
      inspiredBy: "John Deere 7R 250",
      copy: "Châssis 7R : capot haut, cabine plus large, jumelage arrière.",
      cost: 98000,
      powerHp: 250,
      widthM: 0,
      speedKmh: 13,
      lifeHours: 850,
      bonus: "Gros outils (jusqu’à ~9 m) — chantier plus vite, cuve plus vide.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Géant 517",
      inspiredBy: "Fendt 1050 Vario",
      copy: "Quatre chenilles type Quadtrac, capot long, double échappement, snorkel, cabine haute.",
      cost: 168000,
      powerHp: 517,
      widthM: 0,
      speedKmh: 14,
      lifeHours: 950,
      bonus: "Travaux lourds et outils très larges. Achat et entretien de haut de gamme.",
      stars: { puissance: 5, vitesse: 4, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  HARVESTER: {
    1: {
      label: "Coupe 5",
      inspiredBy: "New Holland TC5.90",
      copy: "Petite batteuse 5 cylindres, coupe ~4–5 m, trémie 5 000 L, vis latérale courte.",
      cost: 22000,
      powerHp: 200,
      widthM: 4.2,
      speedKmh: 6,
      lifeHours: 480,
      capacityL: 5000,
      bonus: "Petite coupe, trémie ~5 000 L — on rattrape une parcelle, pas une région.",
      stars: { puissance: 2, vitesse: 2, capacite: 2, sobriete: 4, fiabilite: 3 },
    },
    2: {
      label: "Coupe 8",
      inspiredBy: "CLAAS Tucano 450",
      copy: "Caisse Tucano, coupe 5,5 m, trémie 8 000 L, rabatteur et vis plus longs.",
      cost: 50600,
      powerHp: 260,
      widthM: 5.5,
      speedKmh: 6.2,
      lifeHours: 520,
      capacityL: 8000,
      bonus: "Trémie ~8 000 L, coupe plus large : moins d’allers-retours au silo.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Coupe 14",
      inspiredBy: "John Deere S7 600",
      copy: "Rotor S7, coupe 7,6 m, trémie 14 000 L, cabine haute, vis de déchargement longue.",
      cost: 99000,
      powerHp: 340,
      widthM: 7.6,
      speedKmh: 6.5,
      lifeHours: 560,
      capacityL: 14000,
      bonus: "Débit de céréalier : ~14 000 L, la fenêtre de moisson se rattrape.",
      stars: { puissance: 4, vitesse: 3, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    4: {
      label: "Coupe 17",
      inspiredBy: "Fendt IDEAL 8",
      copy: "IDEAL : rotor unique, coupe 9,1 m, trémie 17 100 L, jumelage moteur.",
      cost: 165000,
      powerHp: 450,
      widthM: 9.1,
      speedKmh: 7,
      lifeHours: 620,
      capacityL: 17000,
      bonus: "Grande coupe et trémie ~17 000 L. Automatisation, moins de pertes.",
      stars: { puissance: 4, vitesse: 4, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Coupe 18",
      inspiredBy: "CLAAS LEXION 8600",
      copy: "LEXION 8000 : coupe Vario 12,3 m, quatre chenilles Terra Trac, double échappement.",
      cost: 264000,
      powerHp: 650,
      widthM: 12.3,
      speedKmh: 7.5,
      lifeHours: 720,
      capacityL: 15000,
      bonus: "Haut de gamme : débit et largeur. Gourmande, chère à réviser.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  FORAGE_HARVESTER: {
    1: {
      label: "Ensileuse 3 m",
      inspiredBy: "John Deere 8100",
      copy: "8000 series : bec Kemper 300 3 m, goulotte arrière, cabine haute étroite.",
      cost: 31000,
      powerHp: 260,
      widthM: 3,
      speedKmh: 8,
      lifeHours: 450,
      bonus: "Rampe 3 m — le maïs plante entière d’une petite ferme.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 4, fiabilite: 3 },
    },
    2: {
      label: "Ensileuse 4,5 m",
      inspiredBy: "New Holland FR 550",
      copy: "FR : bec 4,5 m, goulotte plus haute, capot moteur long à l’arrière.",
      cost: 71300,
      powerHp: 340,
      widthM: 4.5,
      speedKmh: 8.2,
      lifeHours: 500,
      bonus: "Rampe 4,5 m, plus de tonnage à l’heure.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Ensileuse 6 m",
      inspiredBy: "CLAAS Jaguar 950",
      copy: "Jaguar : Orbis 600 6 m, goulotte courbe, orange-vert, cabine large.",
      cost: 139500,
      powerHp: 450,
      widthM: 6,
      speedKmh: 8.5,
      lifeHours: 550,
      bonus: "Chantier professionnel : 6 m de rampe.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    4: {
      label: "Ensileuse 7,5 m",
      inspiredBy: "John Deere 9700",
      copy: "9000 series : bec 7,5 m, jumelage moteur, goulotte plus longue.",
      cost: 230000,
      powerHp: 580,
      widthM: 7.5,
      speedKmh: 9,
      lifeHours: 620,
      bonus: "Gros débit — il faut des remorques qui suivent.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Ensileuse 9 m",
      inspiredBy: "CLAAS Jaguar 990",
      copy: "Jaguar 900 : Orbis 900 9 m, quatre chenilles Terra Trac, double goulotte.",
      cost: 372000,
      powerHp: 790,
      widthM: 9,
      speedKmh: 9.5,
      lifeHours: 700,
      bonus: "Haut de gamme fourrager. Puissance et soif au rendez-vous.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  PLOUGH: {
    1: {
      label: "Charrue 3 corps",
      inspiredBy: "Kuhn Master 103 3E",
      copy: "Portée 3 corps, châssis simple, versoirs rouge, roue de jauge.",
      cost: 3100,
      requiredHp: 90,
      widthM: 2,
      speedKmh: 8,
      lifeHours: 850,
      bonus: "2 m — le goulot du parc, et c’est voulu.",
      stars: { puissance: 2, vitesse: 2, capacite: 2, sobriete: 4, fiabilite: 4 },
    },
    2: {
      label: "Charrue 4 corps",
      inspiredBy: "Kuhn Multi-Master 123 4E",
      copy: "Portée 4 corps, largeur variable, même silhouette Master plus longue.",
      cost: 7130,
      requiredHp: 130,
      widthM: 3,
      speedKmh: 8,
      lifeHours: 880,
      bonus: "3 m — le 115 ch ne suffit plus.",
      stars: { puissance: 3, vitesse: 2, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Charrue 5 corps",
      inspiredBy: "Lemken Juwel 8 5 N100",
      copy: "Portée 5 corps, tourteau hydraulique, châssis plus haut.",
      cost: 13950,
      requiredHp: 175,
      widthM: 4,
      speedKmh: 8.2,
      lifeHours: 920,
      bonus: "4 m — il faut le céréalier 185.",
      stars: { puissance: 3, vitesse: 3, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Charrue 7 corps",
      inspiredBy: "Lemken Diamant 16 7+1",
      copy: "Semi-portée 7+1, roue de transport, châssis en deux sections.",
      cost: 22300,
      requiredHp: 240,
      widthM: 6,
      speedKmh: 8.5,
      lifeHours: 980,
      bonus: "6 m — réservée au lourd 250.",
      stars: { puissance: 4, vitesse: 3, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Charrue 9 corps",
      inspiredBy: "Kverneland PW 9",
      copy: "Semi-portée 9 corps, « queue » articulée, très longue au transport.",
      cost: 37200,
      requiredHp: 400,
      widthM: 8,
      speedKmh: 9,
      lifeHours: 1050,
      bonus: "8 m — seul le géant 517 la tire.",
      stars: { puissance: 5, vitesse: 4, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  SEEDER: {
    1: {
      label: "Semoir 4 m",
      inspiredBy: "Amazone D9 4000 Super",
      copy: "Porté 4 m, trémie orange, rangées de socs, herse-peigne.",
      cost: 4600,
      requiredHp: 70,
      widthM: 4,
      speedKmh: 10,
      lifeHours: 800,
      bonus: "4 m — le semis de petite ferme.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 4, fiabilite: 3 },
    },
    2: {
      label: "Semoir 5 m",
      inspiredBy: "Amazone Cataya 5000 Super",
      copy: "Combiné 5 m herse rotative + semoir, trémie plus haute.",
      cost: 10580,
      requiredHp: 100,
      widthM: 5,
      speedKmh: 10,
      lifeHours: 830,
      bonus: "5 m, combiné herse-semoir.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Semoir 6 m",
      inspiredBy: "Horsch Pronto 6 DC",
      copy: "Traîné 6 m, packer pneus, double trémie, ailes repliables.",
      cost: 20700,
      requiredHp: 140,
      widthM: 6,
      speedKmh: 10.5,
      lifeHours: 870,
      bonus: "6 m — semis direct possible, chantier pro.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Semoir 9 m",
      inspiredBy: "Horsch Pronto 9 DC",
      copy: "Traîné 9,00 m pile, trémie 6 000 L, même architecture Pronto élargie.",
      cost: 33100,
      requiredHp: 200,
      widthM: 9,
      speedKmh: 11,
      lifeHours: 930,
      bonus: "9 m — grande exploitation, tracteur lourd.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Semoir 12 m",
      inspiredBy: "Väderstad Inspire 1200C",
      copy: "12,00 m, ailes triples, trémie centrale, packer pneumatique.",
      cost: 55200,
      requiredHp: 320,
      widthM: 12,
      speedKmh: 12,
      lifeHours: 1000,
      bonus: "12 m — haut de gamme, soif et largeur.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  SPREADER: {
    1: {
      label: "Épandeur 12 m",
      inspiredBy: "Amazone ZA-M 1500",
      copy: "Porté, trémie 1 500 L, deux disques, déflecteurs 12 m.",
      cost: 2300,
      requiredHp: 50,
      widthM: 12,
      speedKmh: 12,
      lifeHours: 800,
      bonus: "12 m — l’engrais d’une petite parcelle.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Épandeur 15 m",
      inspiredBy: "Sulky X40+ ECONOV",
      copy: "Porté, trémie plus haute, carénage latéral, rampe 15 m.",
      cost: 5290,
      requiredHp: 75,
      widthM: 15,
      speedKmh: 12,
      lifeHours: 830,
      bonus: "15 m, plus de trémie.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Épandeur 18 m",
      inspiredBy: "Amazone ZA-TS 2000",
      copy: "Porté pesée, trémie 2 000 L, disques TS, 18 m.",
      cost: 10350,
      requiredHp: 110,
      widthM: 18,
      speedKmh: 12.5,
      lifeHours: 870,
      bonus: "18 m — pesée et largeur pro.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Épandeur 24 m",
      inspiredBy: "Kuhn Axis 50.2 W",
      copy: "Porté pesée 50.2, trémie large, 24 m de nappe.",
      cost: 16560,
      requiredHp: 160,
      widthM: 24,
      speedKmh: 13,
      lifeHours: 920,
      bonus: "24 m — un passage couvre la parcelle.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Épandeur 36 m",
      inspiredBy: "Amazone ZG-TS 10001",
      copy: "Traîné 10 000 L, essieu, disques TS, nappe 36 m.",
      cost: 27600,
      requiredHp: 240,
      widthM: 36,
      speedKmh: 14,
      lifeHours: 980,
      bonus: "36 m, trémie portée — haut de gamme.",
      stars: { puissance: 4, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
  DISC_HARROW: {
    1: {
      label: "Déchaumeur 3 m",
      inspiredBy: "Kuhn Optimer+ 303",
      copy: "Porté rigide 3,00 m, 24 disques 510 mm, rouleau arrière.",
      cost: 3300,
      requiredHp: 80,
      widthM: 3,
      speedKmh: 11,
      lifeHours: 900,
      bonus: "3 m — enfouit les résidus d’une petite ferme.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 4, fiabilite: 4 },
    },
    2: {
      label: "Déchaumeur 4 m",
      inspiredBy: "Lemken Rubin 10/400",
      copy: "Porté 4,00 m, disques 645 mm, deux rangées, rouleau packer.",
      cost: 7590,
      requiredHp: 115,
      widthM: 4,
      speedKmh: 11,
      lifeHours: 930,
      bonus: "4 m — le 115 ch passe juste.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Déchaumeur 5,5 m",
      inspiredBy: "Horsch Joker 6 CT",
      copy: "Traîné repliable ~6 m, disques concaves, packer pneu.",
      cost: 14850,
      requiredHp: 160,
      widthM: 5.5,
      speedKmh: 11.5,
      lifeHours: 970,
      bonus: "5,5 m — chantier pro.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Déchaumeur 7,5 m",
      inspiredBy: "Kuhn Optimer+ 7503",
      copy: "Traîné 7,50 m pile, 60 disques, repliage 3 m au transport.",
      cost: 23760,
      requiredHp: 230,
      widthM: 7.5,
      speedKmh: 12,
      lifeHours: 1020,
      bonus: "7,5 m — tracteur lourd.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Déchaumeur 10 m",
      inspiredBy: "Lemken Rubin 10/1000 KUA",
      copy: "Traîné 10,00 m pile, disques 645 mm, repliage hydraulique.",
      cost: 39600,
      requiredHp: 360,
      widthM: 10,
      speedKmh: 13,
      lifeHours: 1080,
      bonus: "10 m — haut de gamme, soif comprise.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  MOWER: {
    1: {
      label: "Faucheuse 3 m",
      inspiredBy: "Kuhn GMD 3125",
      copy: "Portée arrière 3,10 m, 7 disques, relevage vertical.",
      cost: 1900,
      requiredHp: 60,
      widthM: 3,
      speedKmh: 12,
      lifeHours: 800,
      bonus: "3 m — l’herbe d’un petit pré.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Faucheuse 4 m",
      inspiredBy: "CLAAS Disco 4400 Contour",
      copy: "Portée arrière 4,20 m, 10 disques, pivot central.",
      cost: 4370,
      requiredHp: 85,
      widthM: 4,
      speedKmh: 12,
      lifeHours: 830,
      bonus: "4 m, un cran plus vite.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Faucheuse 6 m",
      inspiredBy: "Krone EasyCut 6210 CV",
      copy: "Combiné frontal + arrière 6,20 m, deux barres, conditionneur.",
      cost: 8550,
      requiredHp: 120,
      widthM: 6,
      speedKmh: 12.5,
      lifeHours: 870,
      bonus: "6 m — combiné frontal + arrière.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Faucheuse 8 m",
      inspiredBy: "CLAAS Disco 8500 C",
      copy: "Combiné papillon ~8,3 m, trois barres, repliage vertical.",
      cost: 13680,
      requiredHp: 170,
      widthM: 8,
      speedKmh: 13,
      lifeHours: 920,
      bonus: "8 m — grande prairie.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Faucheuse 10 m",
      inspiredBy: "Krone EasyCut B 1000 CV",
      copy: "Papillon 9,70–10,10 m, trois barres, conditionneur.",
      cost: 22800,
      requiredHp: 260,
      widthM: 10,
      speedKmh: 14,
      lifeHours: 980,
      bonus: "10 m — haut de gamme fourrager.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
  SPRAYER: {
    1: {
      label: "Pulvé 18 m",
      inspiredBy: "Amazone UF 1501",
      copy: "Porté, cuve 1 500 L crème, rampe 18 m repliée en U.",
      cost: 3900,
      requiredHp: 60,
      widthM: 18,
      speedKmh: 12,
      lifeHours: 850,
      bonus: "18 m porté — le désherbage d’une petite ferme.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Pulvé 21 m",
      inspiredBy: "Amazone UF 2002",
      copy: "Porté, cuve 2 000 L, rampe 21 m, même architecture UF.",
      cost: 8970,
      requiredHp: 90,
      widthM: 21,
      speedKmh: 12,
      lifeHours: 880,
      bonus: "21 m, plus de cuve.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Pulvé 24 m",
      inspiredBy: "John Deere R732i",
      copy: "Porté R700i, cuve profilée, rampe 24 m, pompe avant.",
      cost: 17550,
      requiredHp: 130,
      widthM: 24,
      speedKmh: 12.5,
      lifeHours: 920,
      bonus: "24 m — rampe et précision pro.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Pulvé 36 m",
      inspiredBy: "Amazone Pantera 4502",
      copy: "Automoteur, cuve 4 500 L, rampe 36 m, cabine centrale.",
      cost: 28080,
      requiredHp: 200,
      widthM: 36,
      speedKmh: 13,
      lifeHours: 980,
      bonus: "36 m automoteur léger — un passage, la parcelle.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Pulvé 42 m",
      inspiredBy: "John Deere 410R",
      copy: "Automoteur 410R, cuve 3 800 L, rampe carbone jusqu’à 40,2 m.",
      cost: 46800,
      requiredHp: 320,
      widthM: 42,
      speedKmh: 14,
      lifeHours: 1050,
      bonus: "42 m — haut de gamme, précision et soif.",
      stars: { puissance: 4, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  BALER: {
    1: {
      label: "Presse 440",
      inspiredBy: "John Deere 440M",
      copy: "Chambre fixe ronde, pickup 2,2 m, capot latéral, béquille.",
      cost: 6100,
      requiredHp: 70,
      widthM: 2.2,
      speedKmh: 9,
      lifeHours: 750,
      bonus: "Petites balles, rythme de petite ferme.",
      stars: { puissance: 2, vitesse: 2, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Presse ronde",
      inspiredBy: "New Holland Roll-Belt 450",
      copy: "Chambre variable, pickup 2,3 m, courroies visibles sur le flanc.",
      cost: 14030,
      requiredHp: 95,
      widthM: 2.3,
      speedKmh: 10,
      lifeHours: 790,
      bonus: "Plus de balles à l’heure, chambre variable.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Presse Rollant",
      inspiredBy: "CLAAS Rollant 520",
      copy: "Chambre fixe 1,25 m, pickup 2,5 m, capot vert-jaune.",
      cost: 27450,
      requiredHp: 130,
      widthM: 2.5,
      speedKmh: 11,
      lifeHours: 840,
      bonus: "Chambre fixe pro, cadence qui suit la fauche.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Presse Variant",
      inspiredBy: "CLAAS Variant 585 RF",
      copy: "Chambre variable jusqu’à 1,80 m, pickup 2,7 m, capot plus haut.",
      cost: 43920,
      requiredHp: 180,
      widthM: 2.7,
      speedKmh: 12,
      lifeHours: 900,
      bonus: "Grosses balles, moins de voyages.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Presse Quadrant",
      inspiredBy: "CLAAS Quadrant 5300 FC",
      copy: "Balle cubique, piston avant, flywheel, pickup 2,9 m, caisse longue.",
      cost: 73200,
      requiredHp: 280,
      widthM: 2.9,
      speedKmh: 13,
      lifeHours: 980,
      bonus: "Balle cubique haut de gamme — enrubannage, cadence, soif.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
  TRAILER: {
    1: {
      label: "Benne 8 t",
      inspiredBy: "Gourdon RMG 8",
      copy: "Ridelles 8 t, simple essieu, porte 2 vantaux, flèche à ressort.",
      cost: 2600,
      requiredHp: 60,
      widthM: 2.5,
      speedKmh: 14,
      lifeHours: 1100,
      capacityL: 8000,
      bonus: "8 t — les bottes d’un petit champ.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 4 },
    },
    2: {
      label: "Benne 12 t",
      inspiredBy: "Joskin Trans-CAP 12/50",
      copy: "Monocoque 12 t, un essieu, ridelles basses, hayon hydraulique.",
      cost: 5980,
      requiredHp: 80,
      widthM: 2.6,
      speedKmh: 15,
      lifeHours: 1140,
      capacityL: 12000,
      bonus: "12 t — moins de voyages au silo.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Benne 16 t",
      inspiredBy: "Fliegl TMK 160",
      copy: "Monocoque 16 t, tandem, hayon, flèche articulée.",
      cost: 11700,
      requiredHp: 110,
      widthM: 2.8,
      speedKmh: 16,
      lifeHours: 1180,
      capacityL: 16000,
      bonus: "16 t — suit une moisson professionnelle.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Benne 24 t",
      inspiredBy: "Krampe Big Body 650",
      copy: "Monocoque ~24 t, tandem, caisse haute, hayon grain.",
      cost: 18720,
      requiredHp: 160,
      widthM: 3,
      speedKmh: 17,
      lifeHours: 1240,
      capacityL: 24000,
      bonus: "24 t — grande exploitation.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Benne 32 t",
      inspiredBy: "Krampe Big Body 900",
      copy: "Monocoque ~30 t, tridem, caisse très haute, bennes d’ensilage.",
      cost: 31200,
      requiredHp: 240,
      widthM: 3.2,
      speedKmh: 18,
      lifeHours: 1300,
      capacityL: 32000,
      bonus: "32 t — suit l’ensileuse 9 m. Tracteur lourd.",
      stars: { puissance: 4, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
};

/** Une fiche du catalogue, palier compris. */
export function machineVariant<T extends keyof MachineCatalog>(
  type: T,
  tier: MachineTier = 1,
): MachineVariant {
  return CATALOGUE[type][tier];
}

export const MACHINE_CATALOG: MachineCatalog = CATALOGUE;
