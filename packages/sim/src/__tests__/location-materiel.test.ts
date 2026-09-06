/**
 * Louer le matériel d'un chantier.
 *
 * ## Le mur que ceci ouvre
 *
 * Le tableau publie trois offres, et le parc de départ n'a que tracteur,
 * semoir et charrue. Une offre de moisson ou d'épandage se lisait, se
 * chiffrait, et se refusait au clic : « Il faut une moissonneuse-batteuse ».
 * Le générateur garantit désormais qu'une des trois soit à portée d'un
 * débutant — mais cela réduit la fréquence du mur sans donner de chemin pour
 * le franchir. Or c'est justement par les contrats qu'un débutant est censé
 * financer sa première moissonneuse.
 *
 * ## Les trois propriétés à tenir en même temps
 *
 * Une rampe doit monter quelque part, coûter quelque chose, et ne pas devenir
 * un raccourci. Ce fichier tient les trois :
 *
 *   - **elle monte** : le salaire loué reste franchement positif ;
 *   - **elle coûte** : posséder rapporte nettement plus que louer ;
 *   - **elle ne raccourcit rien** : posséder l'engin ferme la location, ce qui
 *     empêche de mener deux chantiers avec un seul attelage.
 */

import {
  MACHINE_DEFS,
  MISSION_RENTAL_SHARE,
  libelleMaterielLoue,
  missionPayout,
  missionRentalFee,
  missionRentedPayout,
  peutLouerPourCeTravail,
  type FarmWork,
  type MachineForWork,
  type MachineType,
} from "@farmsim/shared";

/** Un engin neuf et libre, réduit à ce dont la règle a besoin. */
const engin = (type: MachineType): MachineForWork => ({ type, tier: 1, condition: 1 });

/** Le parc de départ (`STARTER_KIT`) : de quoi semer, labourer, déchaumer. */
const DEBUTANT: MachineForWork[] = [
  engin("TRACTOR"),
  engin("SEEDER"),
  engin("PLOUGH"),
  engin("DISC_HARROW"),
];

const TRAVAUX: FarmWork[] = [
  "PLANT",
  "FERTILIZE",
  "HARVEST",
  "PLOW",
  "STUBBLE",
  "MOW",
  "BALE",
  "COLLECT",
  "SILAGE",
  "WEED",
];

/** Le premier engin du catalogue qui sait faire ce travail. */
function outilPour(work: FarmWork): MachineType {
  return (Object.keys(MACHINE_DEFS) as MachineType[]).find((t) =>
    MACHINE_DEFS[t].works.includes(work as never),
  )!;
}

describe("qui peut louer", () => {
  it("laisse louer ce qu’on n’a pas — la moissonneuse du débutant", () => {
    expect(peutLouerPourCeTravail(DEBUTANT, "HARVEST")).toBe(true);
    expect(libelleMaterielLoue("HARVEST")).toMatch(/moissonneuse/i);
  });

  it("ferme la location dès qu’on possède l’engin", () => {
    // Le semoir est là : semer se fait chez soi, pas en location.
    expect(peutLouerPourCeTravail(DEBUTANT, "PLANT")).toBe(false);
    expect(peutLouerPourCeTravail(DEBUTANT, "PLOW")).toBe(false);
  });

  it("la ferme aussi quand l’engin est au champ — c’est tout l’intérêt", () => {
    /*
     * La règle qu'il a fallu remettre après l'avoir retirée : « tu peux lancer
     * deux choses qui nécessitent le tracteur alors que t'as qu'un seul
     * tracteur, c'est pas censé être possible ». Si la location regardait la
     * disponibilité plutôt que la possession, elle rouvrirait cette porte par
     * la fenêtre — on louerait un second semoir pour doubler.
     */
    const occupe: MachineForWork[] = [
      { ...engin("TRACTOR"), busyUntil: new Date(Date.now() + 600_000) },
      { ...engin("SEEDER"), busyUntil: new Date(Date.now() + 600_000) },
    ];
    expect(peutLouerPourCeTravail(occupe, "PLANT")).toBe(false);
  });

  it("la ferme encore quand l’engin est en panne — on répare, on ne loue pas", () => {
    const casse: MachineForWork[] = [
      engin("TRACTOR"),
      { ...engin("SEEDER"), condition: 0.05, breakdown: "BELT" },
    ];
    expect(peutLouerPourCeTravail(casse, "PLANT")).toBe(false);
  });

  it("donne un nom à ce qu’on loue, pour les dix travaux", () => {
    for (const work of TRAVAUX) {
      const nom = libelleMaterielLoue(work);
      expect({ work, nom: nom !== "du matériel" }).toEqual({ work, nom: true });
      expect({ work, article: /^(un|une|des) /.test(nom) }).toEqual({ work, article: true });
    }
  });

  it("laisse louer chacun des dix travaux à qui n’a rien", () => {
    // Sinon un joueur sans parc se retrouverait bloqué sur un travail précis
    // sans qu'aucun écran ne sache le dire.
    for (const work of TRAVAUX) {
      expect({ work, louable: peutLouerPourCeTravail([], work) }).toEqual({ work, louable: true });
    }
  });
});

describe("ce que la location coûte", () => {
  it("prend 45 % du salaire, et le reste tombe sur le compte", () => {
    for (const work of TRAVAUX) {
      for (const cells of [8, 16, 24]) {
        const brut = missionPayout(work, cells, "NPC");
        const frais = missionRentalFee(work, cells, "NPC");
        const net = missionRentedPayout(work, cells, "NPC");
        expect({ work, cells, somme: frais + net }).toEqual({ work, cells, somme: brut });
        // La part réelle s'écarte de quelques millièmes du taux nominal :
        // l'arrondi à l'euro pèse d'autant plus que le chantier est petit
        // (32 € sur 70 € font 0,457). Ce qui compte est la bande, pas la
        // décimale.
        expect({ work, cells, dansLaBande: Math.abs(frais / brut - MISSION_RENTAL_SHARE) < 0.02 })
          .toEqual({ work, cells, dansLaBande: true });
      }
    }
  });

  it("laisse la soirée valoir la peine — plus de la moitié du salaire reste", () => {
    /*
     * Une rampe qui ne mène nulle part n'est pas une rampe. La propriété est
     * exprimée en **part** et non en euros : les dix travaux ne sont pas payés
     * pareil — un ramassage vaut 70 €, un ensilage 167 —, si bien qu'un seuil
     * absolu ne dirait rien du ramassage et tout de l'ensilage.
     */
    for (const work of TRAVAUX) {
      const brut = missionPayout(work, 16, "NPC");
      const net = missionRentedPayout(work, 16, "NPC");
      expect({ work, majorite: net > brut / 2 }).toEqual({ work, majorite: true });
    }
  });

  it("rend la moisson accessible — c’est elle, le mur du débutant", () => {
    /*
     * Le cas concret pour lequel tout ceci existe : le parc de départ ne
     * moissonne pas, et c'est la moisson qui paie le mieux. En location, un
     * chantier de vingt-quatre cases rapporte de quoi sentir la différence.
     */
    expect(missionRentedPayout("HARVEST", 24, "NPC")).toBeGreaterThan(100);
    expect(missionRentedPayout("HARVEST", 16, "NPC")).toBeGreaterThan(75);
  });

  it("garde l’achat nettement meilleur que la location", () => {
    /*
     * L'autre garde-fou. Le propriétaire paie l'usure du passage — de l'ordre
     * d'un dixième du salaire, réparation comprise — et garde donc près de
     * 90 %. Si la location s'en approchait, la moissonneuse ne s'achèterait
     * jamais et le tableau deviendrait le jeu.
     */
    const USURE_ESTIMEE = 0.15;
    expect(MISSION_RENTAL_SHARE).toBeGreaterThan(USURE_ESTIMEE * 2);
    for (const work of TRAVAUX) {
      const possede = missionPayout(work, 16, "NPC") * (1 - USURE_ESTIMEE);
      const loue = missionRentedPayout(work, 16, "NPC");
      expect({ work, mieux: possede > loue * 1.3 }).toEqual({ work, mieux: true });
    }
  });

  it("suit la taille du chantier — pas de forfait qui se contourne", () => {
    // Un forfait se contournerait en ne prenant que de gros chantiers.
    for (const work of TRAVAUX) {
      expect(missionRentalFee(work, 24, "NPC")).toBeGreaterThan(missionRentalFee(work, 8, "NPC"));
    }
  });

  it("arrondit sans perdre ni créer d’euro", () => {
    // Le net est calculé par soustraction, pas par un second arrondi : deux
    // arrondis indépendants feraient apparaître ou disparaître un euro.
    for (const work of TRAVAUX) {
      for (let cells = 8; cells <= 24; cells++) {
        const brut = missionPayout(work, cells, "NPC");
        expect(missionRentalFee(work, cells, "NPC") + missionRentedPayout(work, cells, "NPC")).toBe(
          brut,
        );
      }
    }
  });
});

describe("le mur du débutant", () => {
  it("existe bel et bien : le parc de départ ne moissonne pas", () => {
    // La prémisse de tout ce fichier. Si elle cessait d'être vraie — un parc
    // de départ enrichi —, la location n'aurait plus de raison d'exister sous
    // cette forme, et il vaudrait mieux le savoir ici qu'en la maintenant.
    const outil = outilPour("HARVEST");
    expect(DEBUTANT.some((m) => m.type === outil)).toBe(false);
    expect(peutLouerPourCeTravail(DEBUTANT, "HARVEST")).toBe(true);
  });
});
