/**
 * Un engin au champ ne peut pas être à deux endroits.
 *
 * ## L'aller-retour
 *
 * Ce filtre a existé, a été retiré, et revient. Les deux signalements avaient
 * raison, sur deux choses différentes.
 *
 * Il refusait d'abord tout engin déjà occupé, **sans un mot** : un chantier en
 * cours interdisait d'en ouvrir un second sur une autre parcelle, et le joueur
 * qui venait d'acheter une seconde terre ne comprenait pas pourquoi elle était
 * inutilisable. D'où sa suppression — « oui il peut utiliser le même engin
 * pour plusieurs parcelles ».
 *
 * Le remède a produit l'inverse, signalé en jouant le 28 août : « tu peux
 * lancer deux choses qui nécessitent le tracteur alors que t'as qu'un seul
 * tracteur, c'est pas censé être possible. Dire qu'il faut deux tracteurs. »
 * Un semoir cessait d'être une ressource physique, et le palier de l'engin se
 * contournait en achetant du temps : deux chantiers étroits au lieu d'un
 * large.
 *
 * Ce qui n'allait pas la première fois n'était donc pas la règle, c'était le
 * silence. Ces tests tiennent les deux moitiés du remède : la contrainte, et
 * la phrase qui la rend supportable.
 */

import {
  delaiEnClair,
  explainNoMachine,
  type MachineForWork,
} from "@farmsim/shared";

const MAINTENANT = Date.UTC(2026, 7, 28, 12, 0, 0);
/** Un engin en parfait état : ce qui est testé ici, c'est l'occupation. */
const NEUF = { condition: 100, grease: 100, dirt: 0, breakdown: null } as const;

function tracteur(busyUntil: Date | null = null): MachineForWork {
  return { type: "TRACTOR", tier: 3, ...NEUF, busyUntil };
}

function semoir(busyUntil: Date | null = null): MachineForWork {
  return { type: "SEEDER", tier: 1, ...NEUF, busyUntil };
}

/** Dans `n` minutes, du point de vue de `MAINTENANT`. */
function dans(n: number): Date {
  return new Date(MAINTENANT + n * 60_000);
}

describe("le délai en clair", () => {
  it("compte en secondes sous une minute et demie, en minutes au-delà", () => {
    expect(delaiEnClair(40_000)).toBe("40 s");
    expect(delaiEnClair(89_000)).toBe("89 s");
    expect(delaiEnClair(90_000)).toBe("2 min");
    expect(delaiEnClair(5 * 60_000)).toBe("5 min");
  });

  it("ne rend jamais de négatif", () => {
    // Une date déjà passée n'est pas une attente : c'est zéro.
    expect(delaiEnClair(-10_000)).toBe("0 s");
  });
});

describe("un attelage occupé ne repart pas", () => {
  it("refuse le semis quand le seul semoir est au champ", () => {
    const message = explainNoMachine(
      [tracteur(), semoir(dans(3))],
      "PLANT",
      MAINTENANT,
    );
    expect(message).toMatch(/au champ/);
    expect(message).toMatch(/3 min/);
    // Et il dit quoi faire, pas seulement ce qui bloque.
    expect(message).toMatch(/second/);
  });

  it("refuse quand le semoir est libre mais le seul tracteur au champ", () => {
    /*
     * C'est le cas exact du signalement : deux travaux qui demandent le même
     * tracteur. L'outil n'est pas le goulot — le porteur l'est — et le message
     * doit désigner le tracteur, sinon le joueur achète un second semoir.
     */
    const message = explainNoMachine(
      [tracteur(dans(2)), semoir()],
      "PLANT",
      MAINTENANT,
    );
    expect(message).toMatch(/tracteur/i);
    expect(message).toMatch(/2 min/);
  });

  it("laisse partir dès qu'un second attelage existe", () => {
    expect(
      explainNoMachine(
        [tracteur(dans(2)), tracteur(), semoir(dans(2)), semoir()],
        "PLANT",
        MAINTENANT,
      ),
    ).toBeNull();
  });

  it("ne retient rien quand l'heure de retour est passée", () => {
    // `busyUntil` reste posé jusqu'à ce que le chantier soit réclamé : une
    // date échue ne doit pas immobiliser l'engin une minute de plus.
    expect(
      explainNoMachine([tracteur(dans(-1)), semoir(dans(-1))], "PLANT", MAINTENANT),
    ).toBeNull();
  });

  it("parle du matériel manquant avant de parler d'occupation", () => {
    // Un joueur sans semoir doit s'entendre dire d'en acheter un, pas
    // d'attendre le retour d'un engin qu'il ne possède pas.
    const message = explainNoMachine([tracteur(dans(2))], "PLANT", MAINTENANT);
    expect(message).toMatch(/garage/);
    expect(message).not.toMatch(/au champ/);
  });

  it("parle de l'état avant de parler d'occupation", () => {
    /*
     * Un semoir en panne et au champ pose deux problèmes, mais un seul se
     * règle en attendant. Annoncer le retour d'un engin qui ne pourra pas
     * repartir enverrait le joueur patienter pour rien.
     */
    const casse: MachineForWork = {
      type: "SEEDER",
      tier: 1,
      condition: 3,
      grease: 0,
      dirt: 90,
      breakdown: "ENGINE",
      busyUntil: dans(2),
    };
    const message = explainNoMachine([tracteur(), casse], "PLANT", MAINTENANT);
    expect(message).not.toMatch(/au champ/);
  });
});
