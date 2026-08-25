/**
 * Le catalogue des engins : cinq paliers, calés sur des machines réelles.
 *
 * ## Pourquoi cinq, et pas trois
 *
 * Cinq modèles, chacun inspiré d'un engin du marché, donnent une progression
 * lisible — petite ferme → industrielle — et une base solide pour les assets
 * 3D (proportions, cabine, largeur de coupe, trains).
 *
 * ## T5 = sommet du marché
 *
 * Le palier 5 n'est pas « un gros modèle ». C'est l'un des plus imposants
 * réellement disponibles dans sa famille : 9RX 830, CR11 à 20 000 L, 9900 à
 * ~970 ch, rampe 48 m, semoir 24 m. Il doit se lire trop grand pour une
 * petite parcelle, et trop cher pour qu'on l'achète sans calculer.
 *
 * ## Prix de jeu
 *
 * Les tarifs concessionnaire (HT, 2024–2026) ancrent les ordres de grandeur.
 * Les prix du jeu s'en approchent, un cran en dessous pour rester jouables :
 * un T1 reste accessible en début de partie (parc offert + crédit), un T5
 * se paie des campagnes, et sa révision (22 % du neuf) pèse autant que
 * l'achat d'un palier inférieur.
 *
 * Les noms affichés sont génériques. `inspiredBy` / `maker` sont internes :
 * les marques restent hors licence commerciale.
 */

export type MachineTier = 1 | 2 | 3 | 4 | 5;

export const MACHINE_TIERS: readonly MachineTier[] = [1, 2, 3, 4, 5];

/** Ce que le palier raconte, au-delà du numéro. */
export const TIER_ROLE_LABELS: Record<MachineTier, string> = {
  1: "Petite exploitation",
  2: "En développement",
  3: "Professionnelle",
  4: "Grande exploitation",
  5: "Technologie maximale",
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
 * imposant sur la cour, sans déborder du hangar (plafond de test : 1,4).
 */
export function machineMeshScale(tier: MachineTier = 1): number {
  return ([1, 1.06, 1.14, 1.24, 1.35] as const)[tier - 1] ?? 1;
}

/**
 * Cinq notes, 1 à 5. Plus haut = mieux — sauf la consommation, notée en
 * sobriété : cinq étoiles, ça boit peu.
 *
 * Un T5 n'est pas meilleur partout : le géant 830 ch est puissant et large,
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
  /** Constructeur de la référence. Interne. */
  maker: string;
  /** Ce que le mesh 3D doit reprendre, en une phrase. */
  copy: string;
  /** Prix cible du jeu, en euros. */
  cost: number;
  /** Ordre de grandeur du neuf réel, euros HT, 2024–2026. */
  realPriceApprox: number;
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
  /** Trémie / benne / cuve, litres. */
  capacityL?: number;
  /** Consommation affichée, L/h à charge typique du palier. */
  fuelLPerHour: number;
  /** Ce que ce palier débloque, en une phrase. */
  bonus: string;
  /** Pourquoi ce n'est pas toujours le bon achat. */
  constraints: string;
  /** Ce qu'on attelle / ce qui l'utilise. */
  compatible: string;
  /** Place dans la progression petite ferme → industrielle. */
  role: string;
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
      label: "Utilitaire 105",
      inspiredBy: "John Deere 6105M",
      maker: "John Deere",
      copy: "Capot court 4 cyl, cabine 6M, roues arrière nettement plus grandes, garde-boue simples.",
      cost: 72000,
      realPriceApprox: 85000,
      powerHp: 105,
      widthM: 0,
      speedKmh: 10,
      lifeHours: 700,
      fuelLPerHour: 17,
      bonus: "Polyvalent de petite ferme — outils jusqu’à ~3 m.",
      constraints: "Inutile sur un déchaumeur de 10 m. Lent dès que les parcelles s’agrandissent.",
      compatible: "Tous les outils T1. Rien au-dessus.",
      role: "Le premier porteur. Offert à l’installation.",
      stars: { puissance: 1, vitesse: 2, capacite: 1, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Polyvalent 163",
      inspiredBy: "Fendt 516 Vario",
      maker: "Fendt",
      copy: "Capot 500 Vario plus long, transmission continue, cabine panoramique, trains étroits.",
      cost: 140000,
      realPriceApprox: 155000,
      powerHp: 163,
      widthM: 0,
      speedKmh: 11,
      lifeHours: 760,
      fuelLPerHour: 26,
      bonus: "Attelle les outils T2 (jusqu’à ~6 m). Première vraie montée en gamme.",
      constraints: "Encore juste pour un labour professionnel. La cuve le sent déjà.",
      compatible: "Outils T1–T2.",
      role: "Exploitation en développement — on accélère sans se ruiner.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 4, fiabilite: 4 },
    },
    3: {
      /*
       * « Céréalier 250 » désignait un type de ferme, quand tous ses voisins
       * de gamme désignent une taille : Utilitaire, Polyvalent, Lourd, Géant.
       * Le mot a surtout un passé — c'était l'un des deux métiers qu'on
       * choisissait à l'inscription, avant qu'on supprime ce choix. Un joueur
       * qui l'a connu lit donc un reste de mécanique morte et se demande si
       * son tracteur a hérité d'un libellé qui traîne. La question a été
       * posée telle quelle.
       */
      label: "Intensif 250",
      inspiredBy: "John Deere 6R 250",
      maker: "John Deere",
      copy: "6R 6 cyl : capot haut, empattement allongé, jantes plus larges, GPS de série.",
      cost: 230000,
      realPriceApprox: 245000,
      powerHp: 250,
      widthM: 0,
      speedKmh: 12,
      lifeHours: 820,
      fuelLPerHour: 40,
      bonus: "Chantier professionnel — outils jusqu’à ~8 m.",
      constraints: "Surdimensionné pour 14 ha. Un T1 attelé juste boit moins sur petite parcelle.",
      compatible: "Outils T1–T3.",
      role: "Le porteur d’une exploitation qui vit du champ, plus du jardin.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Lourd 370",
      inspiredBy: "John Deere 8R 370",
      maker: "John Deere",
      copy: "Châssis 8R : capot très haut, cabine large, jumelage arrière, masses avant épaisses.",
      cost: 380000,
      realPriceApprox: 400000,
      powerHp: 370,
      widthM: 0,
      speedKmh: 13,
      lifeHours: 880,
      fuelLPerHour: 58,
      bonus: "Gros outils (jusqu’à ~12 m). Jumelage : traction, pas encore chenilles.",
      constraints: "N’attelle pas la charrue T5 ni le semoir de 24 m. Entretien de grande ferme.",
      compatible: "Outils T1–T4. Pas les T5 les plus lourds.",
      role: "Grande exploitation — on prépare le saut industriel.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Géant 830",
      inspiredBy: "John Deere 9RX 830",
      maker: "John Deere",
      copy: "Quatre chenilles 9RX, capot immense, double échappement, snorkel, cabine haute.",
      cost: 920000,
      realPriceApprox: 1050000,
      powerHp: 830,
      widthM: 0,
      speedKmh: 14,
      lifeHours: 980,
      fuelLPerHour: 149,
      bonus: "Sommet du marché : 830 ch, tous les outils T5. Travaux les plus lourds.",
      constraints: "Achat ~1 M€, soif ~150 L/h, révision ruineuse. Ridicule sur 14 ha.",
      compatible: "Tout le parc, y compris charrue 12 corps et semoir 24 m.",
      role: "Exploitation industrielle. On l’achète quand le temps de chantier vaut de l’or.",
      stars: { puissance: 5, vitesse: 4, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  HARVESTER: {
    1: {
      label: "Coupe 5",
      inspiredBy: "New Holland TC5.90",
      maker: "New Holland",
      copy: "Petite batteuse 5 cylindres, coupe ~4,5 m, trémie 5 200 L, vis latérale courte.",
      cost: 200000,
      realPriceApprox: 220000,
      powerHp: 175,
      widthM: 4.5,
      speedKmh: 6,
      lifeHours: 480,
      capacityL: 5200,
      fuelLPerHour: 32,
      bonus: "On rattrape une parcelle. Trémie petite : vidanges fréquentes.",
      constraints: "Fenêtre de moisson courte = file d’attente. Pertes dès que ça verse.",
      compatible: "Automoteur — pas de tracteur. Remorque T1–T2 suffisent à la suivre.",
      role: "Première moissonneuse. Souvent après l’entreprise de travaux.",
      stars: { puissance: 2, vitesse: 2, capacite: 2, sobriete: 4, fiabilite: 3 },
    },
    2: {
      label: "Coupe 6",
      inspiredBy: "CLAAS Tucano 560",
      maker: "CLAAS",
      copy: "Caisse Tucano, coupe 6,0 m, trémie 9 000 L, rabatteur et vis plus longs.",
      cost: 320000,
      realPriceApprox: 340000,
      powerHp: 300,
      widthM: 6,
      speedKmh: 6.2,
      lifeHours: 530,
      capacityL: 9000,
      fuelLPerHour: 48,
      bonus: "Moins d’allers-retours au silo. Première batteuse qui suit deux parcelles.",
      constraints: "Encore étroite pour une campagne de 80 ha. L’entreprise reste tentante.",
      compatible: "Automoteur. Remorques T2–T3.",
      role: "Le saut que finance le crédit d’une ferme installée.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Coupe 8",
      inspiredBy: "John Deere S7 700",
      maker: "John Deere",
      copy: "Rotor S7, coupe 7,6 m, trémie 14 100 L, cabine haute, vis de déchargement longue.",
      cost: 520000,
      realPriceApprox: 560000,
      powerHp: 373,
      widthM: 7.6,
      speedKmh: 6.6,
      lifeHours: 580,
      capacityL: 14100,
      fuelLPerHour: 62,
      bonus: "Débit de céréalier : la fenêtre de moisson se rattrape.",
      constraints: "Investissement conséquent. Il faut des bennes qui suivent.",
      compatible: "Automoteur. Remorques T3+.",
      role: "Exploitation professionnelle — on ne sous-traite plus la moisson.",
      stars: { puissance: 3, vitesse: 3, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    4: {
      label: "Coupe 12",
      inspiredBy: "Fendt IDEAL 9T",
      maker: "Fendt",
      copy: "IDEAL 9 : rotor unique, coupe 12,2 m, trémie 17 100 L, jumelage moteur.",
      cost: 740000,
      realPriceApprox: 820000,
      powerHp: 647,
      widthM: 12.2,
      speedKmh: 7.2,
      lifeHours: 650,
      capacityL: 17100,
      fuelLPerHour: 98,
      bonus: "Grande coupe, trémie ~17 000 L, automatisation, moins de pertes.",
      constraints: "Gourmande. Sur petite parcelle, trop de temps en demi-tour.",
      compatible: "Automoteur. Remorques T4+ — sinon elle attend.",
      role: "Grande exploitation. On vise le haut de la campagne.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Industrielle 20 000",
      inspiredBy: "New Holland CR11",
      maker: "New Holland",
      copy: "CR11 : coupe 15,2 m, trémie 20 000 L, quatre chenilles, double rotor, vis XXL.",
      cost: 1280000,
      realPriceApprox: 1450000,
      powerHp: 775,
      widthM: 15.2,
      speedKmh: 8,
      lifeHours: 740,
      capacityL: 20000,
      fuelLPerHour: 140,
      bonus: "Sommet mondial : 20 000 L, 15 m de coupe. Une vidange, un camion.",
      constraints: "1,3 M€, soif de centrale, entretien de site industriel. Inutile sous 150 ha.",
      compatible: "Automoteur. Remorques T5 — 70 m³ — ou elle s’arrête.",
      role: "Le trophée. On l’achète pour maximiser une fenêtre de récolte énorme.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  FORAGE_HARVESTER: {
    1: {
      label: "Ensileuse 3 m",
      inspiredBy: "John Deere 8100",
      maker: "John Deere",
      copy: "8000 series : bec Kemper 300 3 m, goulotte arrière, cabine haute étroite.",
      cost: 220000,
      realPriceApprox: 240000,
      powerHp: 400,
      widthM: 3,
      speedKmh: 8,
      lifeHours: 450,
      fuelLPerHour: 58,
      bonus: "Le maïs plante entière d’une petite ferme. Débit limité.",
      constraints: "Rampe étroite : une journée pour 14 ha. Les bennes T1 suffisent pile.",
      compatible: "Automoteur. Remorques T1–T2.",
      role: "Première ensileuse — souvent après avoir fait faire.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 4, fiabilite: 3 },
    },
    2: {
      label: "Ensileuse 4,5 m",
      inspiredBy: "New Holland FR 550",
      maker: "New Holland",
      copy: "FR 550 : bec 4,5 m, goulotte plus haute, capot moteur long à l’arrière.",
      cost: 340000,
      realPriceApprox: 350000,
      powerHp: 544,
      widthM: 4.5,
      speedKmh: 8.2,
      lifeHours: 500,
      fuelLPerHour: 78,
      bonus: "Plus de tonnage à l’heure. Les silos se remplissent dans la journée.",
      constraints: "Il faut deux bennes pour ne pas l’arrêter.",
      compatible: "Automoteur. Remorques T2–T3.",
      role: "Élevage qui grandit — l’ensilage n’est plus un goulet.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Ensileuse 6 m",
      inspiredBy: "CLAAS Jaguar 960",
      maker: "CLAAS",
      copy: "Jaguar 960 : Orbis 600 6 m, goulotte courbe, cabine large.",
      cost: 450000,
      realPriceApprox: 480000,
      powerHp: 626,
      widthM: 6,
      speedKmh: 8.6,
      lifeHours: 560,
      fuelLPerHour: 95,
      bonus: "Chantier professionnel : 6 m de rampe, débit d’ETA.",
      constraints: "Trois remorques ou elle attend en bout de rang.",
      compatible: "Automoteur. Remorques T3+.",
      role: "On ensile pour soi et, bientôt, pour les autres.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    4: {
      label: "Ensileuse 7,5 m",
      inspiredBy: "CLAAS Jaguar 990",
      maker: "CLAAS",
      copy: "Jaguar 990 : Orbis 750 7,5 m, jumelage, goulotte longue, 790 ch.",
      cost: 720000,
      realPriceApprox: 780000,
      powerHp: 790,
      widthM: 7.5,
      speedKmh: 9,
      lifeHours: 630,
      fuelLPerHour: 125,
      bonus: "Très gros débit — le train de bennes doit suivre sans trou.",
      constraints: "Presque le sommet Claas. Encore un cran sous la 9900.",
      compatible: "Automoteur. Remorques T4+.",
      role: "Grande exploitation fourragère / ETA.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Ensileuse 9 m",
      inspiredBy: "John Deere 9900",
      maker: "John Deere",
      copy: "9900 : ~970 ch, bec 9 m, quatre chenilles, double goulotte, capot arrière énorme.",
      cost: 1050000,
      realPriceApprox: 1180000,
      powerHp: 970,
      widthM: 9,
      speedKmh: 9.6,
      lifeHours: 720,
      fuelLPerHour: 175,
      bonus: "La plus puissante du marché. Volumes industriels, vitesse max.",
      constraints: "Plus d’1 M€, ~175 L/h, train de 70 m³ obligatoire. Hors sujet en petit.",
      compatible: "Automoteur. Remorques T5 uniquement si on veut le débit annoncé.",
      role: "Sommet fourrager. On ensile une région, pas un pré.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  PLOUGH: {
    1: {
      label: "Charrue 3 corps",
      inspiredBy: "Kuhn Master 103 3E",
      maker: "Kuhn",
      copy: "Portée 3 corps, châssis simple, versoirs, roue de jauge.",
      cost: 22000,
      realPriceApprox: 18000,
      requiredHp: 85,
      widthM: 2,
      speedKmh: 8,
      lifeHours: 850,
      fuelLPerHour: 15,
      bonus: "2 m — le goulot du parc, et c’est voulu.",
      constraints: "Un labour de 14 ha prend une journée. C’est le prix du T1.",
      compatible: "Tracteur T1+ (85 ch).",
      role: "Premier labour. Offert à l’installation.",
      stars: { puissance: 2, vitesse: 2, capacite: 2, sobriete: 4, fiabilite: 4 },
    },
    2: {
      label: "Charrue 4 corps",
      inspiredBy: "Kuhn Multi-Master 123 4E",
      maker: "Kuhn",
      copy: "Portée 4 corps, largeur variable, silhouette Master plus longue.",
      cost: 38000,
      realPriceApprox: 32000,
      requiredHp: 130,
      widthM: 3,
      speedKmh: 8,
      lifeHours: 880,
      fuelLPerHour: 22,
      bonus: "3 m — le 105 ch ne suffit plus.",
      constraints: "Il faut le polyvalent 163. Sinon elle reste au hangar.",
      compatible: "Tracteur T2+ (130 ch).",
      role: "On laboure plus vite dès que le porteur suit.",
      stars: { puissance: 3, vitesse: 2, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Charrue 6 corps",
      inspiredBy: "Lemken Juwel 8 6 N100",
      maker: "Lemken",
      copy: "Portée 6 corps, tourteau hydraulique, châssis plus haut.",
      cost: 62000,
      realPriceApprox: 55000,
      requiredHp: 200,
      widthM: 5,
      speedKmh: 8.5,
      lifeHours: 930,
      fuelLPerHour: 32,
      bonus: "5 m — chantier pro, le céréalier 250 la tire.",
      constraints: "Semi-lourde : uns petite parcelle n’y gagne presque rien.",
      compatible: "Tracteur T3+ (200 ch).",
      role: "Labour d’exploitation professionnelle.",
      stars: { puissance: 3, vitesse: 3, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Charrue 8 corps",
      inspiredBy: "Lemken Diamant 16 8+1",
      maker: "Lemken",
      copy: "Semi-portée 8+1, roue de transport, châssis en deux sections.",
      cost: 82000,
      realPriceApprox: 78000,
      requiredHp: 280,
      widthM: 6,
      speedKmh: 8.6,
      lifeHours: 990,
      fuelLPerHour: 44,
      bonus: "6 m — réservée au lourd 370.",
      constraints: "Une charrue n’atteint pas 12 m : au-delà, on déchaume.",
      compatible: "Tracteur T4+ (280 ch).",
      role: "Grande exploitation. Le labour reste le plus lent des gestes.",
      stars: { puissance: 4, vitesse: 3, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Charrue 12 corps",
      inspiredBy: "Kverneland PW 100 12",
      maker: "Kverneland",
      copy: "Semi-portée 12 corps, queue articulée, très longue au transport.",
      cost: 98000,
      realPriceApprox: 110000,
      requiredHp: 420,
      widthM: 7,
      speedKmh: 9,
      lifeHours: 1080,
      fuelLPerHour: 68,
      bonus: "7 m, 12 versoirs — seul le géant 830 la tire.",
      constraints: "Le 370 ch recule. Transport cauchemardesque. Soif du 830.",
      compatible: "Tracteur T5 uniquement (420 ch).",
      role: "Le labour industriel. Rare, spectaculaire, cher à faire tourner.",
      stars: { puissance: 5, vitesse: 4, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  SEEDER: {
    1: {
      label: "Semoir 3 m",
      inspiredBy: "Amazone D9 3000 Super",
      maker: "Amazone",
      copy: "Porté 3 m, trémie, rangées de socs, herse-peigne.",
      cost: 25000,
      realPriceApprox: 28000,
      requiredHp: 70,
      widthM: 3,
      speedKmh: 10,
      lifeHours: 800,
      capacityL: 850,
      fuelLPerHour: 14,
      bonus: "3 m — le semis de petite ferme.",
      constraints: "Beaucoup de passages. Trémie petite.",
      compatible: "Tracteur T1+ (70 ch).",
      role: "Offert à l’installation. On sème son premier blé.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 4, fiabilite: 3 },
    },
    2: {
      label: "Semoir 6 m",
      inspiredBy: "Horsch Express 6 KR",
      maker: "Horsch",
      copy: "Traîné 6 m, trémie plus haute, ailes repliables.",
      cost: 55000,
      realPriceApprox: 62000,
      requiredHp: 110,
      widthM: 6,
      speedKmh: 10,
      lifeHours: 840,
      capacityL: 2000,
      fuelLPerHour: 22,
      bonus: "6 m, deux fois moins de passages.",
      constraints: "Le 105 ch ne la tire pas.",
      compatible: "Tracteur T2+ (110 ch).",
      role: "On sème plus vite dès que le porteur grandit.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Semoir 9 m",
      inspiredBy: "Horsch Pronto 9 DC",
      maker: "Horsch",
      copy: "Traîné 9 m, packer pneus, double trémie, ailes.",
      cost: 120000,
      realPriceApprox: 135000,
      requiredHp: 180,
      widthM: 9,
      speedKmh: 10.5,
      lifeHours: 890,
      capacityL: 5000,
      fuelLPerHour: 34,
      bonus: "9 m — semis direct possible, chantier pro.",
      constraints: "Il faut le 250 ch. Trémie à remplir souvent si on force le débit.",
      compatible: "Tracteur T3+ (180 ch).",
      role: "Semis d’exploitation professionnelle.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Semoir 12 m",
      inspiredBy: "Horsch Avatar 12.25 SD",
      maker: "Horsch",
      copy: "12,25 m, dents, trémie 6 500 L, repliage routier.",
      cost: 210000,
      realPriceApprox: 230000,
      requiredHp: 280,
      widthM: 12.25,
      speedKmh: 11,
      lifeHours: 950,
      capacityL: 6500,
      fuelLPerHour: 48,
      bonus: "12 m — grande exploitation, tracteur lourd.",
      constraints: "Le 250 ch recule. Demi-tours longs sur 14 ha.",
      compatible: "Tracteur T4+ (280 ch).",
      role: "On sème une matinée ce qui prenait un jour.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Semoir 24 m",
      inspiredBy: "Bourgault 3420-80",
      maker: "Bourgault",
      copy: "Air drill 24,4 m, trémie centrale énorme, ailes triples, packer.",
      cost: 420000,
      realPriceApprox: 480000,
      requiredHp: 500,
      widthM: 24.4,
      speedKmh: 12,
      lifeHours: 1040,
      capacityL: 17000,
      fuelLPerHour: 95,
      bonus: "24 m — un passage couvre une petite ferme entière.",
      constraints: "500 ch : seul le 830 la tire. Monstrueuse à manœuvrer. 420 k€.",
      compatible: "Tracteur T5 uniquement (500 ch).",
      role: "Semis industriel. La largeur est le palier.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  SPREADER: {
    1: {
      label: "Épandeur 12 m",
      inspiredBy: "Amazone ZA-M 1500",
      maker: "Amazone",
      copy: "Porté, trémie 1 500 L, deux disques, nappe 12 m.",
      cost: 12000,
      realPriceApprox: 14000,
      requiredHp: 50,
      widthM: 12,
      speedKmh: 12,
      lifeHours: 800,
      capacityL: 1500,
      fuelLPerHour: 10,
      bonus: "12 m — l’engrais d’une petite parcelle.",
      constraints: "Trémie vite vide. Précision limitée.",
      compatible: "Tracteur T1+ (50 ch).",
      role: "Premier fertilisant. Pas cher, pas large.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Épandeur 18 m",
      inspiredBy: "Sulky X40+ ECONOV",
      maker: "Sulky",
      copy: "Porté, trémie plus haute, carénage, nappe 18 m.",
      cost: 22000,
      realPriceApprox: 25000,
      requiredHp: 75,
      widthM: 18,
      speedKmh: 12,
      lifeHours: 840,
      capacityL: 3000,
      fuelLPerHour: 14,
      bonus: "18 m, plus de trémie, début de modulation.",
      constraints: "Encore porté : le 105 ch le sent en cote.",
      compatible: "Tracteur T1+ (75 ch).",
      role: "On couvre plus vite sans changer de porteur.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Épandeur 24 m",
      inspiredBy: "Amazone ZA-TS 3200",
      maker: "Amazone",
      copy: "Porté pesée, trémie 3 200 L, disques TS, 24 m.",
      cost: 38000,
      realPriceApprox: 42000,
      requiredHp: 110,
      widthM: 24,
      speedKmh: 12.5,
      lifeHours: 890,
      capacityL: 3200,
      fuelLPerHour: 20,
      bonus: "24 m — pesée et largeur pro.",
      constraints: "Porté lourd. Il faut le 163 ch.",
      compatible: "Tracteur T2+ (110 ch).",
      role: "Fertilisation professionnelle.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Épandeur 36 m",
      inspiredBy: "Kuhn Axis 50.2 W",
      maker: "Kuhn",
      copy: "Porté pesée 50.2, trémie large, nappe 36 m.",
      cost: 58000,
      realPriceApprox: 62000,
      requiredHp: 160,
      widthM: 36,
      speedKmh: 13,
      lifeHours: 940,
      capacityL: 4200,
      fuelLPerHour: 28,
      bonus: "36 m — un passage couvre la parcelle.",
      constraints: "Nappe large : le vent devient un vrai risque.",
      compatible: "Tracteur T3+ (160 ch).",
      role: "Grande exploitation. L’engrais n’est plus un chantier.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Épandeur 48 m",
      inspiredBy: "Amazone ZG-TS 10001",
      maker: "Amazone",
      copy: "Traîné 10 000 L, essieu, disques TS, nappe 48 m.",
      cost: 88000,
      realPriceApprox: 95000,
      requiredHp: 240,
      widthM: 48,
      speedKmh: 14,
      lifeHours: 1020,
      capacityL: 10000,
      fuelLPerHour: 42,
      bonus: "48 m, 10 000 L — autonomie et largeur de sommet.",
      constraints: "Sur 14 ha c’est un passage unique, et un 250 ch qui s’ennuie.",
      compatible: "Tracteur T3+ (240 ch).",
      role: "Fertilisation industrielle. La trémie tient une matinée.",
      stars: { puissance: 4, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
  DISC_HARROW: {
    1: {
      label: "Déchaumeur 3 m",
      inspiredBy: "Kuhn Optimer+ 303",
      maker: "Kuhn",
      copy: "Porté rigide 3,00 m, 24 disques 510 mm, rouleau arrière.",
      cost: 22000,
      realPriceApprox: 24000,
      requiredHp: 80,
      widthM: 3,
      speedKmh: 11,
      lifeHours: 900,
      fuelLPerHour: 15,
      bonus: "3 m — enfouit les résidus d’une petite ferme.",
      constraints: "Lent dès que les hectares s’additionnent.",
      compatible: "Tracteur T1+ (80 ch).",
      role: "Offert à l’installation. Sans lui, pas de second cycle.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 4, fiabilite: 4 },
    },
    2: {
      label: "Déchaumeur 5 m",
      inspiredBy: "Lemken Rubin 10/500",
      maker: "Lemken",
      copy: "Porté 5,00 m, disques 645 mm, deux rangées, rouleau packer.",
      cost: 42000,
      realPriceApprox: 48000,
      requiredHp: 130,
      widthM: 5,
      speedKmh: 11,
      lifeHours: 940,
      fuelLPerHour: 24,
      bonus: "5 m — le 105 ch ne passe plus.",
      constraints: "Il faut le 163 ch.",
      compatible: "Tracteur T2+ (130 ch).",
      role: "Le déchaumage cesse d’être une corvée.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 3, fiabilite: 4 },
    },
    3: {
      label: "Déchaumeur 8 m",
      inspiredBy: "Horsch Joker 8 RT",
      maker: "Horsch",
      copy: "Traîné repliable 8 m, disques concaves, packer pneu.",
      cost: 78000,
      realPriceApprox: 85000,
      requiredHp: 200,
      widthM: 8,
      speedKmh: 11.5,
      lifeHours: 990,
      fuelLPerHour: 36,
      bonus: "8 m — chantier pro, le 250 ch la tire.",
      constraints: "Repliage routier obligatoire. Poids.",
      compatible: "Tracteur T3+ (200 ch).",
      role: "Travail du sol professionnel.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Déchaumeur 10 m",
      inspiredBy: "Lemken Rubin 10/1000 KUA",
      maker: "Lemken",
      copy: "Traîné 10,00 m, disques 645 mm, repliage hydraulique.",
      cost: 120000,
      realPriceApprox: 130000,
      requiredHp: 280,
      widthM: 10,
      speedKmh: 12,
      lifeHours: 1040,
      fuelLPerHour: 50,
      bonus: "10 m — tracteur lourd.",
      constraints: "Le 250 ch recule. Demi-tours longs.",
      compatible: "Tracteur T4+ (280 ch).",
      role: "Grande exploitation. Le sol se prépare en une matinée.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Déchaumeur 12 m",
      inspiredBy: "Horsch Joker 12 RT",
      maker: "Horsch",
      copy: "Traîné 12,25 m, disques concaves, packer, repliage 3 m au transport.",
      cost: 165000,
      realPriceApprox: 185000,
      requiredHp: 400,
      widthM: 12.25,
      speedKmh: 13,
      lifeHours: 1100,
      fuelLPerHour: 78,
      bonus: "12 m — sommet européen. Le 370 ch ne suffit pas.",
      constraints: "400 ch : géant 830. Sur 14 ha, trop d’outil pour trop peu de terre.",
      compatible: "Tracteur T5 (400 ch).",
      role: "Préparation industrielle. La largeur, enfin, se voit.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  MOWER: {
    1: {
      label: "Faucheuse 3 m",
      inspiredBy: "Kuhn GMD 3125",
      maker: "Kuhn",
      copy: "Portée arrière 3,10 m, 7 disques, relevage vertical.",
      cost: 16000,
      realPriceApprox: 18000,
      requiredHp: 60,
      widthM: 3.1,
      speedKmh: 12,
      lifeHours: 800,
      fuelLPerHour: 12,
      bonus: "3 m — l’herbe d’un petit pré.",
      constraints: "Une coupe, pas une campagne fourragère.",
      compatible: "Tracteur T1+ (60 ch).",
      role: "Première fauche. L’élevage commence là.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Faucheuse 4 m",
      inspiredBy: "CLAAS Disco 4400 Contour",
      maker: "CLAAS",
      copy: "Portée arrière 4,20 m, 10 disques, pivot central.",
      cost: 28000,
      realPriceApprox: 32000,
      requiredHp: 85,
      widthM: 4.2,
      speedKmh: 12,
      lifeHours: 840,
      fuelLPerHour: 16,
      bonus: "4 m, un cran plus vite.",
      constraints: "Toujours une seule barre. Les grandes prairies attendent le combiné.",
      compatible: "Tracteur T1+ (85 ch).",
      role: "Le pré s’agrandit, la barre suit.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Faucheuse 6 m",
      inspiredBy: "Krone EasyCut 6210 CV",
      maker: "Krone",
      copy: "Combiné frontal + arrière 6,20 m, deux barres, conditionneur.",
      cost: 48000,
      realPriceApprox: 55000,
      requiredHp: 120,
      widthM: 6.2,
      speedKmh: 12.5,
      lifeHours: 890,
      fuelLPerHour: 24,
      bonus: "6 m — combiné frontal + arrière.",
      constraints: "Il faut le 163 ch et un attelage avant.",
      compatible: "Tracteur T2+ (120 ch).",
      role: "Fauche professionnelle. L’andain nourrit la presse.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Faucheuse 8 m",
      inspiredBy: "CLAAS Disco 8500 C",
      maker: "CLAAS",
      copy: "Combiné papillon ~8,3 m, trois barres, repliage vertical.",
      cost: 68000,
      realPriceApprox: 75000,
      requiredHp: 170,
      widthM: 8.3,
      speedKmh: 13,
      lifeHours: 940,
      fuelLPerHour: 32,
      bonus: "8 m — grande prairie.",
      constraints: "Poids, hydraulique, 250 ch à l’aise.",
      compatible: "Tracteur T3+ (170 ch).",
      role: "Grande exploitation fourragère.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Faucheuse 11 m",
      inspiredBy: "CLAAS Disco 1100 C",
      maker: "CLAAS",
      copy: "Papillon 10,7 m, trois barres, conditionneur, repliage vertical.",
      cost: 95000,
      realPriceApprox: 105000,
      requiredHp: 220,
      widthM: 10.7,
      speedKmh: 14,
      lifeHours: 1000,
      fuelLPerHour: 42,
      bonus: "10,7 m — le plus large des combinés tractés.",
      constraints: "Sur un petit pré, on passe plus de temps à replier qu’à faucher.",
      compatible: "Tracteur T3+ (220 ch).",
      role: "Sommet fourrager tracté. Au-delà, ce serait un automoteur.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
  SPRAYER: {
    1: {
      label: "Pulvé 15 m",
      inspiredBy: "Amazone UF 1501",
      maker: "Amazone",
      copy: "Porté, cuve 1 500 L, rampe 15 m repliée en U.",
      cost: 28000,
      realPriceApprox: 32000,
      requiredHp: 70,
      widthM: 15,
      speedKmh: 12,
      lifeHours: 850,
      capacityL: 1500,
      fuelLPerHour: 14,
      bonus: "15 m porté — le désherbage d’une petite ferme.",
      constraints: "Cuve petite, précision limitée. Rechargements.",
      compatible: "Tracteur T1+ (70 ch).",
      role: "Premier pulvé. Le désherbage devient un geste, pas une journée.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Pulvé 24 m",
      inspiredBy: "Amazone UX 5201",
      maker: "Amazone",
      copy: "Traîné, cuve 5 200 L, rampe 24 m, essieu, pompe.",
      cost: 75000,
      realPriceApprox: 85000,
      requiredHp: 90,
      widthM: 24,
      speedKmh: 12.5,
      lifeHours: 900,
      capacityL: 5200,
      fuelLPerHour: 18,
      bonus: "24 m traîné — autonomie et largeur d’un vrai chantier.",
      constraints: "Encore attelé. Manœuvres en fourrière plus lourdes.",
      compatible: "Tracteur T1+ (90 ch).",
      role: "On désherbe une matinée, plus un après-midi.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Pulvé 36 m",
      inspiredBy: "Amazone Pantera 4504",
      maker: "Amazone",
      copy: "Automoteur, cuve 4 500 L, rampe 36 m, cabine centrale — attelé en jeu.",
      cost: 200000,
      realPriceApprox: 220000,
      requiredHp: 180,
      widthM: 36,
      speedKmh: 14,
      lifeHours: 960,
      capacityL: 4500,
      fuelLPerHour: 32,
      bonus: "36 m — rampe et précision pro. Un passage, la parcelle.",
      constraints: "Il faut le 250 ch (porteur). Investissement d’ETA.",
      compatible: "Tracteur T3+ (180 ch).",
      role: "Pulvé professionnel. La chimie devient un passage rapide.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Pulvé 42 m",
      inspiredBy: "Fendt Rogator 937H",
      maker: "Fendt",
      copy: "Automoteur haute garde, cuve 6 000 L, rampe 42 m, cabine haute.",
      cost: 320000,
      realPriceApprox: 360000,
      requiredHp: 240,
      widthM: 42,
      speedKmh: 15,
      lifeHours: 1020,
      capacityL: 6000,
      fuelLPerHour: 44,
      bonus: "42 m, garde au sol, automatisation.",
      constraints: "Cher à l’heure. Sur 14 ha, la rampe dépasse le champ.",
      compatible: "Tracteur T3+ (240 ch).",
      role: "Grande exploitation / ETA. On vise les 48 m.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 2, fiabilite: 4 },
    },
    5: {
      label: "Pulvé 48 m",
      inspiredBy: "Horsch Leeb PT 8350",
      maker: "Horsch",
      copy: "Automoteur PT, cuve 8 000 L, rampe 48 m carbone, cabine, éclairage LED.",
      cost: 480000,
      realPriceApprox: 520000,
      requiredHp: 280,
      widthM: 48,
      speedKmh: 16,
      lifeHours: 1100,
      capacityL: 8000,
      fuelLPerHour: 58,
      bonus: "48 m, 8 000 L — le plus large du parc. Précision et autonomie max.",
      constraints: "480 k€, soif, 280 ch. Inutile et dangereux d’intérêt sur petite parcelle.",
      compatible: "Tracteur T4+ (280 ch).",
      role: "Sommet pulvé. Une rampe d’usine, pas d’un jardin.",
      stars: { puissance: 4, vitesse: 5, capacite: 5, sobriete: 1, fiabilite: 4 },
    },
  },
  BALER: {
    1: {
      label: "Presse 440",
      inspiredBy: "John Deere 440M",
      maker: "John Deere",
      copy: "Chambre fixe ronde, pickup 2,1 m, capot latéral, béquille.",
      cost: 40000,
      realPriceApprox: 38000,
      requiredHp: 70,
      widthM: 2.1,
      speedKmh: 9,
      lifeHours: 750,
      fuelLPerHour: 14,
      bonus: "Petites balles, rythme de petite ferme.",
      constraints: "Beaucoup de bottes, beaucoup de voyages.",
      compatible: "Tracteur T1+ (70 ch). Remorque T1.",
      role: "Première presse. La paille quitte enfin le champ.",
      stars: { puissance: 2, vitesse: 2, capacite: 2, sobriete: 5, fiabilite: 3 },
    },
    2: {
      label: "Presse ronde",
      inspiredBy: "New Holland Roll-Belt 450",
      maker: "New Holland",
      copy: "Chambre variable, pickup 2,3 m, courroies visibles sur le flanc.",
      cost: 65000,
      realPriceApprox: 60000,
      requiredHp: 95,
      widthM: 2.3,
      speedKmh: 10,
      lifeHours: 800,
      fuelLPerHour: 18,
      bonus: "Plus de balles à l’heure, chambre variable.",
      constraints: "Le 105 ch passe juste.",
      compatible: "Tracteur T1+ (95 ch).",
      role: "On presse sans passer la nuit au champ.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Presse Rollant",
      inspiredBy: "CLAAS Rollant 540",
      maker: "CLAAS",
      copy: "Chambre fixe 1,25 m, pickup 2,5 m, capot, liage filet.",
      cost: 100000,
      realPriceApprox: 95000,
      requiredHp: 120,
      widthM: 2.5,
      speedKmh: 11,
      lifeHours: 850,
      fuelLPerHour: 24,
      bonus: "Chambre fixe pro, cadence qui suit la fauche.",
      constraints: "Il faut le 163 ch pour ne pas patiner.",
      compatible: "Tracteur T2+ (120 ch).",
      role: "Presse professionnelle. L’andain ne attend plus.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Presse Variant",
      inspiredBy: "CLAAS Variant 585 RF",
      maker: "CLAAS",
      copy: "Chambre variable jusqu’à 1,80 m, pickup 2,7 m, capot plus haut.",
      cost: 145000,
      realPriceApprox: 140000,
      requiredHp: 160,
      widthM: 2.7,
      speedKmh: 12.5,
      lifeHours: 920,
      fuelLPerHour: 32,
      bonus: "Grosses balles, moins de voyages, début d’automatisation.",
      constraints: "Toujours de la ronde. Le cube attend le T5.",
      compatible: "Tracteur T3+ (160 ch).",
      role: "Haute performance ronde. Moins de bottes à rentrer.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Presse cubique",
      inspiredBy: "Krone Big Pack 1290 HDP",
      maker: "Krone",
      copy: "Balle cubique 120×90, piston, volant, pickup 3,0 m, caisse longue.",
      cost: 220000,
      realPriceApprox: 240000,
      requiredHp: 250,
      widthM: 3,
      speedKmh: 14,
      lifeHours: 1000,
      fuelLPerHour: 48,
      bonus: "Débit industriel, densité max, balles cubiques, option enrubannage.",
      constraints: "250 ch, 220 k€, soif. Ridicule derrière une GMD 3 m.",
      compatible: "Tracteur T3+ (250 ch). Remorques T4–T5.",
      role: "Sommet pressage. On vide une prairie comme un silo.",
      stars: { puissance: 5, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
  TRAILER: {
    1: {
      label: "Benne 12 m³",
      inspiredBy: "Joskin Trans-CAP 12/50",
      maker: "Joskin",
      copy: "Monocoque 12 m³, simple essieu, hayon, flèche à ressort.",
      cost: 18000,
      realPriceApprox: 16000,
      requiredHp: 60,
      widthM: 2.5,
      speedKmh: 14,
      lifeHours: 1100,
      capacityL: 12000,
      fuelLPerHour: 12,
      bonus: "12 m³ — les bottes et le grain d’un petit champ.",
      constraints: "Beaucoup de voyages dès la première moisson T2.",
      compatible: "Tracteur T1+ (60 ch).",
      role: "Première benne. Le silo n’est plus le champ.",
      stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 4 },
    },
    2: {
      label: "Benne 22 m³",
      inspiredBy: "Fliegl TMK 160",
      maker: "Fliegl",
      copy: "Monocoque 22 m³, un essieu renforcé, hayon hydraulique.",
      cost: 35000,
      realPriceApprox: 32000,
      requiredHp: 80,
      widthM: 2.6,
      speedKmh: 15,
      lifeHours: 1150,
      capacityL: 22000,
      fuelLPerHour: 16,
      bonus: "22 m³ — moins de voyages au silo.",
      constraints: "Encore juste derrière une Tucano.",
      compatible: "Tracteur T1+ (80 ch).",
      role: "On suit une moissonneuse T2 sans vivre sur la route.",
      stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
    },
    3: {
      label: "Benne 35 m³",
      inspiredBy: "Krampe Big Body 650",
      maker: "Krampe",
      copy: "Monocoque 35 m³, tandem, hayon grain, flèche articulée.",
      cost: 65000,
      realPriceApprox: 60000,
      requiredHp: 110,
      widthM: 2.8,
      speedKmh: 16,
      lifeHours: 1200,
      capacityL: 35000,
      fuelLPerHour: 22,
      bonus: "35 m³ — suit une moisson professionnelle.",
      constraints: "Tandem : il faut de la place pour tourner.",
      compatible: "Tracteur T2+ (110 ch).",
      role: "La benne d’une exploitation qui moissonne elle-même.",
      stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    4: {
      label: "Benne 52 m³",
      inspiredBy: "Fliegl ASW 271",
      maker: "Fliegl",
      copy: "Poussière / ensilage 52 m³, tandem, caisse haute, fond poussant.",
      cost: 110000,
      realPriceApprox: 100000,
      requiredHp: 180,
      widthM: 3.1,
      speedKmh: 17.5,
      lifeHours: 1260,
      capacityL: 52000,
      fuelLPerHour: 32,
      bonus: "52 m³ — grande exploitation, fond poussant.",
      constraints: "180 ch. Inutile si l’ensileuse est encore T1.",
      compatible: "Tracteur T3+ (180 ch).",
      role: "On suit une 7,5 m sans trou dans le train.",
      stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
    },
    5: {
      label: "Benne 70 m³",
      inspiredBy: "Fliegl ASW 391",
      maker: "Fliegl",
      copy: "70 m³, tridem, caisse d’ensilage très haute, fond poussant, jumelage.",
      cost: 190000,
      realPriceApprox: 180000,
      requiredHp: 260,
      widthM: 3.4,
      speedKmh: 19,
      lifeHours: 1340,
      capacityL: 70000,
      fuelLPerHour: 48,
      bonus: "70 m³ — suit la 9900 et la CR11. Un voyage, un silo.",
      constraints: "260 ch, 190 k€, gabarit routier. Une seule parcelle la sous-occupe.",
      compatible: "Tracteur T3+ (260 ch). Obligatoire derrière T5 automoteurs.",
      role: "Sommet transport. Sans elle, les géants s’arrêtent.",
      stars: { puissance: 4, vitesse: 5, capacite: 5, sobriete: 2, fiabilite: 4 },
    },
  },
};

/**
 * Chargeurs télescopiques — matériel de cour, hors travaux de champ.
 *
 * Pas un `MachineType` jouable : un travail = un outil, et le ramassage est
 * déjà la remorque. Ces fiches ancrent la progression (et les futurs assets)
 * sans casser la boucle de chantier.
 */
export const TELEHANDLER_CATALOG: Record<MachineTier, MachineVariant> = {
  1: {
    label: "Télescopique 2,5 t",
    inspiredBy: "Manitou MLT 625-75H",
    maker: "Manitou",
    copy: "Petit agri, flèche 6 m, fourches, cabine étroite, un essieu directeur.",
    cost: 70000,
    realPriceApprox: 75000,
    powerHp: 75,
    widthM: 0,
    speedKmh: 25,
    lifeHours: 900,
    capacityL: 2500,
    fuelLPerHour: 12,
    bonus: "2,5 t / 6 m — bottes et palettes d’une petite cour.",
    constraints: "Pas un engin de champ. Hauteur limitée au hangar.",
    compatible: "Cour, hangar, fourche à fumier. Hors parcelles.",
    role: "Premier chargeur. On range sans atteler la fourche au tracteur.",
    stars: { puissance: 2, vitesse: 3, capacite: 2, sobriete: 5, fiabilite: 3 },
  },
  2: {
    label: "Télescopique 3,6 t",
    inspiredBy: "JCB 536-60 Agri",
    maker: "JCB",
    copy: "Flèche 6,2 m, 3,6 t, cabine latérale, ponts agri.",
    cost: 95000,
    realPriceApprox: 100000,
    powerHp: 109,
    widthM: 0,
    speedKmh: 33,
    lifeHours: 940,
    capacityL: 3600,
    fuelLPerHour: 16,
    bonus: "3,6 t / 6 m — bottes cubiques, big-bags.",
    constraints: "Toujours un outil de cour.",
    compatible: "Cour et hangar.",
    role: "La cour s’équipe en même temps que le champ T2.",
    stars: { puissance: 3, vitesse: 3, capacite: 3, sobriete: 4, fiabilite: 4 },
  },
  3: {
    label: "Télescopique 4 t",
    inspiredBy: "CLAAS Scorpion 741",
    maker: "CLAAS",
    copy: "4,1 t / 7,1 m, cabine Scorpion, flèche en Z, hydraulique plus forte.",
    cost: 130000,
    realPriceApprox: 140000,
    powerHp: 136,
    widthM: 0,
    speedKmh: 40,
    lifeHours: 980,
    capacityL: 4100,
    fuelLPerHour: 22,
    bonus: "4 t / 7 m — silo, bottes, chargement camion.",
    constraints: "Stabilite à grande hauteur : on ne joue pas au grue.",
    compatible: "Cour, silo, quai.",
    role: "Chargeur d’exploitation professionnelle.",
    stars: { puissance: 3, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
  },
  4: {
    label: "Télescopique 4,2 t",
    inspiredBy: "Merlo TF42.7 CS",
    maker: "Merlo",
    copy: "4,2 t / 7,1 m, cabine CS, suspension, hydrostatique.",
    cost: 175000,
    realPriceApprox: 185000,
    powerHp: 170,
    widthM: 0,
    speedKmh: 40,
    lifeHours: 1040,
    capacityL: 4200,
    fuelLPerHour: 28,
    bonus: "Hydraulique et stabilité de grande ferme.",
    constraints: "Cher pour ne sortir que de la cour.",
    compatible: "Cour, silo, quai, godet à ensilage.",
    role: "Grande exploitation — la cour suit le champ T4.",
    stars: { puissance: 4, vitesse: 4, capacite: 4, sobriete: 3, fiabilite: 4 },
  },
  5: {
    label: "Télescopique 6 t",
    inspiredBy: "Manitou MLT 961-160",
    maker: "Manitou",
    copy: "6,0 t / 9,0 m, flèche massive, cabine haute, ponts lourds, 160 ch.",
    cost: 280000,
    realPriceApprox: 300000,
    powerHp: 160,
    widthM: 0,
    speedKmh: 40,
    lifeHours: 1120,
    capacityL: 6000,
    fuelLPerHour: 36,
    bonus: "6 t / 9 m — sommet agri. On charge un camion sans y penser.",
    constraints: "280 k€ pour un engin qui ne sème rien. Prestige de cour.",
    compatible: "Cour industrielle, silo, quai, godets lourds.",
    role: "Le géant de cour. Même logique que le 9RX : trop, sauf si on en a besoin.",
    stars: { puissance: 5, vitesse: 4, capacite: 5, sobriete: 2, fiabilite: 4 },
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

/**
 * De combien un palier grossit à l'écran, par rapport à son T1.
 *
 * ## Le défaut que cette fonction corrige
 *
 * Les vignettes 3D cadraient la caméra sur la boîte englobante du modèle.
 * Autrement dit : quelle que soit la taille de l'engin, la caméra reculait
 * pour le faire tenir, et **un T5 occupait exactement la même place qu'un
 * T1**. Toute la montée en gamme — plus de corps de charrue, une rampe plus
 * large, quatre chenilles — se voyait dans le détail, jamais dans la
 * stature. Le joueur qui paie quatre-vingt-dix mille euros voulait voir une
 * machine plus grosse, et voyait la même en plus fourni.
 *
 * ## D'où vient le chiffre
 *
 * Pas d'une table écrite à la main : du **catalogue lui-même**, c'est-à-dire
 * de ce que la fiche annonce au joueur. La puissance pour les porteurs, la
 * largeur de travail pour les outils. Une taille inventée à côté finirait
 * par contredire la fiche au premier réglage ; celle-ci ne peut pas.
 *
 * ## Pourquoi le logarithme, et pas la proportion
 *
 * Un tracteur passe de 105 à 830 chevaux, un semoir de 3 à 24,4 mètres : à
 * l'échelle exacte, un T5 écraserait tout. Et la largeur d'un pulvérisateur
 * mesure sa **rampe déployée**, pas son encombrement — quarante-huit mètres
 * de traitement tiennent sur une machine de six.
 *
 * On garde donc l'ordre et la forme de la progression, pas son amplitude :
 * chaque type s'étale sur le même écart visuel, de 1 à `TIER_SCALE_MAX`, et
 * les paliers intermédiaires se placent selon le rythme du catalogue. Un
 * type qui bondit entre T3 et T4 montre ce bond.
 */
export const TIER_SCALE_MAX = 1.62;

/** Les types que le catalogue couvre — plus étroit que `MachineType`. */
export type CatalogMachine = keyof MachineCatalog;

function referenceTaille(type: CatalogMachine): number[] {
  const paliers = CATALOGUE[type];
  const largeurs = MACHINE_TIERS.map((t) => paliers[t]?.widthM ?? 0);
  if (largeurs.every((w) => w > 0)) return largeurs;
  const puissances = MACHINE_TIERS.map((t) => paliers[t]?.powerHp ?? 0);
  return puissances.every((p) => p > 0) ? puissances : MACHINE_TIERS.map((t) => t);
}

export function machineTierScale(type: CatalogMachine, tier: MachineTier): number {
  const ref = referenceTaille(type);
  const base = ref[0]!;
  const haut = ref[MACHINE_TIERS.length - 1]!;
  const ici = ref[tier - 1]!;
  // Un catalogue plat — ou incohérent — retombe sur un étalement régulier
  // plutôt que sur une division par zéro : la vignette doit rendre quelque
  // chose même si quelqu'un met cinq fois la même largeur.
  const etendue = Math.log(haut / base);
  const t =
    Number.isFinite(etendue) && etendue > 1e-6
      ? Math.log(ici / base) / etendue
      : (tier - 1) / (MACHINE_TIERS.length - 1);
  const borne = Math.min(1, Math.max(0, t));
  return 1 + borne * (TIER_SCALE_MAX - 1);
}

/** Cinq paliers, comme les bâtiments : T5 est le plafond. */
export const MAX_MACHINE_TIER: MachineTier = 5;

/** Le palier suivant, ou `null` si on tient déjà le sommet. */
export function nextMachineTier(tier: MachineTier): MachineTier | null {
  return tier < MAX_MACHINE_TIER ? ((tier + 1) as MachineTier) : null;
}

/**
 * Ce que coûte le passage au palier suivant : la différence de catalogue.
 *
 * L'engin est repris, le suivant arrive neuf. On ne paie pas un deuxième
 * exemplaire : on paie l'écart, comme on agrandit un hangar. `null` au T5.
 */
export function machineUpgradeCost(
  type: keyof MachineCatalog,
  currentTier: MachineTier,
): number | null {
  const next = nextMachineTier(currentTier);
  if (!next) return null;
  return CATALOGUE[type][next].cost - CATALOGUE[type][currentTier].cost;
}

/** Révision complète, 22 % du neuf — le chiffre que le joueur voit à l’atelier. */
export function machineOverhaulCost(cost: number): number {
  return Math.round(cost * 0.22);
}
