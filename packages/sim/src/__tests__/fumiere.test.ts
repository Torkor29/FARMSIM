import {
  BUILDING_DEFS,
  BUILDING_LEVELS,
  MANURE_PER_CELL,
  MANURE_LOCAL_PRICE,
  MANURE_SMELL_START,
  MANURE_STORE_BASE_TONS,
  manurePitCapacity,
  manureStoreCapacity,
  pitCapacityWithStores,
  MAX_BUILDING_LEVEL,
} from "@farmsim/shared";

/**
 * La fumière : le fumier cesse de tenir dans l'étable.
 *
 * ## D'où ça vient
 *
 * Demandé en jouant : « il faudrait ajouter un bâtiment fosse à lisier ».
 * Jusqu'ici la contenance se déduisait des **places de l'étable** — pour
 * stocker quelques tonnes de plus, il fallait agrandir son bâtiment d'élevage
 * et payer des places de bêtes dont on n'avait pas l'usage. Deux besoins
 * différents payés par le même mur.
 *
 * ## Le mot
 *
 * Fumière, et non fosse à lisier. Le jeu a de la litière de paille ; paille
 * plus déjections font du **fumier**, solide, qui se stocke sur une dalle. Le
 * lisier est ce qu'on obtient sans litière, et lui se stocke en fosse. Tout le
 * code dit « fumier » ; le bâtiment suit, sinon un joueur agriculteur relèvera
 * l'incohérence avant nous.
 */

const MULT = BUILDING_LEVELS.map((l) => l.capacityMult);

describe("ce que la fumière apporte", () => {
  it("tient six tonnes au premier niveau, près de vingt-huit au dernier", () => {
    expect(manureStoreCapacity(1, MULT[0]!)).toBe(MANURE_STORE_BASE_TONS);
    const dernier = manureStoreCapacity(MAX_BUILDING_LEVEL, MULT[MAX_BUILDING_LEVEL - 1]!);
    expect(dernier).toBeGreaterThan(25);
    expect(dernier).toBeLessThan(30);
  });

  it("elle change vraiment la vie d’une étable de premier niveau", () => {
    /*
     * L'étalon : une étable bovine de premier niveau tient 1,5 t. Si la
     * fumière n'apportait qu'une fraction de cela, elle ne vaudrait pas sa
     * pose et personne n'en bâtirait — on aurait ajouté un bâtiment sans
     * ajouter un choix.
     */
    const etable = manurePitCapacity("COW", 12);
    expect(etable).toBeCloseTo(1.5, 3);
    expect(manureStoreCapacity(1, MULT[0]!) / etable).toBeGreaterThanOrEqual(4);
  });

  it("six tonnes valent cent cinquante cases à fertiliser", () => {
    // Un chiffre en tonnes ne dit rien tout seul. En cases, il se compare à
    // une parcelle de 12×12 : une fumière pleine en couvre largement une.
    expect(MANURE_STORE_BASE_TONS / MANURE_PER_CELL).toBe(150);
  });

  it("son prix se lit en jours de blé, comme le reste", () => {
    // ~260 € nets par jour de jeu et par parcelle de blé. Seize jours pour un
    // ouvrage qu'on garde toute la partie : c'est un investissement, pas un
    // achat d'impulsion.
    const jours = BUILDING_DEFS.MANURE_STORE.cost / 260;
    expect(jours).toBeGreaterThan(10);
    expect(jours).toBeLessThan(20);
  });

  it("elle coûte moins cher que le bâtiment qu’elle évite d’agrandir", () => {
    // C'est tout l'argument : avant elle, la seule façon de stocker plus était
    // de payer une étable plus grande.
    expect(BUILDING_DEFS.MANURE_STORE.cost).toBeLessThan(BUILDING_DEFS.CATTLE_BARN.cost);
  });
});

describe("le partage entre abris", () => {
  const base = manurePitCapacity("COW", 12);

  it("un seul abri prend toute la fumière", () => {
    expect(pitCapacityWithStores({ kind: "COW", slots: 12, storeTons: 6, barns: 1 })).toBeCloseTo(
      base + 6,
      3,
    );
  });

  it("deux abris se la partagent", () => {
    /*
     * Sans partage, une seule fumière offrirait sa pleine contenance à six
     * étables à la fois, et il n'y aurait plus jamais de raison d'en bâtir une
     * seconde. Le bâtiment cesserait d'être une décision.
     */
    expect(pitCapacityWithStores({ kind: "COW", slots: 12, storeTons: 6, barns: 2 })).toBeCloseTo(
      base + 3,
      3,
    );
  });

  it("on compte les abris, pas les lots", () => {
    // Une étable qu'on vient de vider ne doit pas doubler la capacité de sa
    // voisine du jour au lendemain.
    const a = pitCapacityWithStores({ kind: "COW", slots: 12, storeTons: 12, barns: 3 });
    expect(a).toBeCloseTo(base + 4, 3);
  });

  it("sans fumière, la capacité est exactement celle d’avant", () => {
    /*
     * L'invariant qui protège les fermes existantes : la fumière ajoute, elle
     * ne redéfinit rien. Une partie en cours doit se comporter à l'identique
     * tant que le joueur n'a rien bâti.
     */
    for (const kind of ["COW", "PIG", "HEN", "SHEEP"] as const) {
      for (const slots of [0, 12, 55, 110]) {
        expect(
          pitCapacityWithStores({ kind, slots, storeTons: 0, barns: 4 }),
        ).toBeCloseTo(manurePitCapacity(kind, slots), 3);
      }
    }
  });

  it("zéro abri ne divise pas par zéro", () => {
    const c = pitCapacityWithStores({ kind: "COW", slots: 12, storeTons: 6, barns: 0 });
    expect(Number.isFinite(c)).toBe(true);
    expect(c).toBeCloseTo(base + 6, 3);
  });
});

describe("ce que l’équipe en tire", () => {
  it("une fumière pleine vaut quelques centaines d’euros chez le voisin", () => {
    /*
     * L'employé d'élevage vend ce qui dépasse le seuil d'odeur et redescend le
     * tas à la moitié. Sur une fumière de premier niveau, cela fait un revenu
     * modeste et régulier — assez pour qu'on le remarque, trop peu pour qu'on
     * embauche uniquement pour ça.
     */
    const capacite = manurePitCapacity("COW", 12) + MANURE_STORE_BASE_TONS;
    const vendu = capacite * MANURE_SMELL_START - capacite * 0.5;
    expect(vendu).toBeGreaterThan(0);
    expect(Math.round(vendu * MANURE_LOCAL_PRICE)).toBeGreaterThan(100);
    expect(Math.round(vendu * MANURE_LOCAL_PRICE)).toBeLessThan(400);
  });

  it("il ne vide jamais complètement", () => {
    // Le fumier vaut plus épandu sur ses terres que vendu au voisin. Un
    // employé qui liquiderait tout priverait le joueur de cet arbitrage : il
    // évite la corvée, il ne décide pas à la place.
    expect(MANURE_SMELL_START).toBeGreaterThan(0.5);
  });
});
