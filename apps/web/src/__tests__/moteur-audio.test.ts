/**
 * Ce qu'on vérifie ici, c'est le confort — pas le grésillement.
 *
 * On ne peut pas écouter un test. Mais tout ce qui rend un jeu insupportable
 * à l'oreille est une **règle**, et une règle se vérifie : combien de sons
 * dans la même seconde, à quel volume les uns par rapport aux autres, et
 * combien de temps entre deux meuglements. C'est ce que couvre ce fichier.
 *
 * Le grésillement, lui, se juge à l'oreille et se règle dans le menu.
 */

import {
  CATALOGUE,
  DEFAULT_AUDIO,
  Portier,
  RAFALE_MAX,
  SAISONS,
  SONS_AMBIANCE,
  VOIX_MAX,
  basseAudible,
  composerMesure,
  dureeMesure,
  gainDuBus,
  hz,
  recalerMesure,
  tirage,
  type SonId,
} from "../audio";

describe("le portier", () => {
  it("refuse le même son deux fois dans son délai", () => {
    const p = new Portier();
    const opts = { cle: "clic", bus: "effets" as const, dureeMs: 70, delaiMs: 100 };
    expect(p.autorise({ ...opts, maintenant: 1000 })).toBe(true);
    expect(p.autorise({ ...opts, maintenant: 1050 })).toBe(false);
    expect(p.autorise({ ...opts, maintenant: 1100 })).toBe(true);
  });

  it("plafonne les voix par bus, et libère la place à la fin du son", () => {
    const p = new Portier();
    for (let i = 0; i < VOIX_MAX.effets; i++) {
      expect(
        p.autorise({ cle: `s${i}`, bus: "effets", maintenant: 0, dureeMs: 500, delaiMs: 0 }),
      ).toBe(true);
    }
    expect(
      p.autorise({ cle: "trop", bus: "effets", maintenant: 0, dureeMs: 500, delaiMs: 0 }),
    ).toBe(false);
    // Une fois les cinq cents millisecondes écoulées, la place se libère.
    expect(
      p.autorise({ cle: "trop", bus: "effets", maintenant: 600, dureeMs: 500, delaiMs: 0 }),
    ).toBe(true);
  });

  it("compte les bus séparément", () => {
    const p = new Portier();
    for (let i = 0; i < VOIX_MAX.effets; i++) {
      p.autorise({ cle: `e${i}`, bus: "effets", maintenant: 0, dureeMs: 500, delaiMs: 0 });
    }
    // Les effets sont pleins ; l'ambiance ne l'est pas pour autant.
    expect(
      p.autorise({ cle: "vache", bus: "ambiance", maintenant: 0, dureeMs: 500, delaiMs: 0 }),
    ).toBe(true);
  });

  /**
   * Le cas qui motive tout le fichier : vingt chantiers finissent coup sur
   * coup. Chacun a une clé différente, donc aucun délai ne les arrête ; ils
   * sont assez courts et assez espacés pour que le plafond de voix ne morde
   * jamais. Seule la fenêtre glissante peut encore les arrêter — et elle le
   * fait.
   */
  it("coupe une rafale de sons tous différents", () => {
    const p = new Portier();
    let passes = 0;
    for (let i = 0; i < 20; i++) {
      const t = 10 + i * 20;
      if (p.autorise({ cle: `fin${i}`, bus: "effets", maintenant: t, dureeMs: 5, delaiMs: 0 })) {
        passes++;
      }
      // La voix précédente est bien retombée : ce n'est pas elle qui bloque.
      expect(p.voixVivantes("effets", t + 10)).toBe(0);
    }
    expect(passes).toBe(RAFALE_MAX);
    // Une seconde après le dernier passage, la fenêtre a glissé : le son
    // revient. Le portier étouffe une rafale, il ne condamne pas le son.
    expect(
      p.autorise({ cle: "apres", bus: "effets", maintenant: 1500, dureeMs: 5, delaiMs: 0 }),
    ).toBe(true);
  });

  it("oublie tout sur demande", () => {
    const p = new Portier();
    p.autorise({ cle: "a", bus: "effets", maintenant: 0, dureeMs: 9999, delaiMs: 9999 });
    p.vider();
    expect(p.autorise({ cle: "a", bus: "effets", maintenant: 1, dureeMs: 10, delaiMs: 9999 })).toBe(
      true,
    );
  });
});

describe("les volumes", () => {
  it("mettent l'ambiance nettement sous les effets et la musique", () => {
    // La consigne « beaucoup moins fort que la musique » est écrite dans les
    // nombres, pas laissée à la bonne volonté de chaque appel.
    expect(DEFAULT_AUDIO.ambiance).toBeLessThan(DEFAULT_AUDIO.musique);
    expect(DEFAULT_AUDIO.ambiance).toBeLessThan(DEFAULT_AUDIO.effets);
  });

  it("coupent tout d'un seul geste", () => {
    const muet = { ...DEFAULT_AUDIO, muted: true };
    expect(gainDuBus(muet, "musique")).toBe(0);
    expect(gainDuBus(muet, "effets")).toBe(0);
    expect(gainDuBus(muet, "ambiance")).toBe(0);
  });

  it("multiplient le curseur du bus par le volume général", () => {
    const p = { ...DEFAULT_AUDIO, volume: 0.5, effets: 0.8 };
    expect(gainDuBus(p, "effets")).toBeCloseTo(0.4);
  });
});

describe("le catalogue", () => {
  const ids = Object.keys(CATALOGUE) as SonId[];

  it("couvre les machines, les bâtiments et les bêtes", () => {
    for (const attendu of [
      "tracteur",
      "moissonneuse",
      "presse",
      "semoir",
      "charrue",
      "pulverisateur",
      "remorque",
      "construction",
      "porte",
      "livraison",
      "vache",
      "mouton",
      "cochon",
      "poule",
    ]) {
      expect(ids).toContain(attendu);
    }
  });

  it("range toutes les bêtes sur le bus ambiance", () => {
    for (const bete of ["vache", "mouton", "cochon", "poule"] as SonId[]) {
      expect(CATALOGUE[bete].bus).toBe("ambiance");
    }
    expect(SONS_AMBIANCE.sort()).toEqual(["cochon", "mouton", "poule", "vache"]);
  });

  /**
   * Un cri de bête ne doit pas pouvoir se répéter en rafale, même si le jeu
   * le demandait : quatre secondes de délai minimum, contre un dixième pour
   * un clic auquel le joueur attend une réponse immédiate.
   */
  it("impose un long silence entre deux bêtes", () => {
    for (const bete of SONS_AMBIANCE) {
      expect(CATALOGUE[bete].delaiMs).toBeGreaterThanOrEqual(4000);
    }
    expect(CATALOGUE.clic.delaiMs).toBeLessThanOrEqual(100);
  });

  it("garde chaque son court et son gain sous l'unité", () => {
    for (const id of ids) {
      const d = CATALOGUE[id];
      expect(d.dureeMs).toBeGreaterThan(0);
      // Rien ne dure plus de deux secondes : au-delà, ce n'est plus un effet,
      // c'est une nappe, et une nappe se superpose mal à la musique.
      expect(d.dureeMs).toBeLessThanOrEqual(2000);
      expect(d.gain).toBeGreaterThan(0);
      expect(d.gain).toBeLessThanOrEqual(1);
      expect(typeof d.rendre).toBe("function");
    }
  });

  it("ne met aucun effet d'interface sur le bus ambiance", () => {
    for (const id of ["clic", "pose", "piece", "refus", "chantier", "niveau"] as SonId[]) {
      expect(CATALOGUE[id].bus).toBe("effets");
    }
  });
});

describe("la musique", () => {
  it("descend chaque saison sous le do de départ, sauf l'été", () => {
    // « Un poil plus grave car trop aigu » : trois demi-tons de moins
    // partout. L'été reste le plus haut des quatre, il ne pouvait pas passer
    // sous les autres sans perdre son caractère.
    expect(SAISONS.SPRING.tonique).toBe(-3);
    expect(SAISONS.SUMMER.tonique).toBe(2);
    expect(SAISONS.AUTUMN.tonique).toBe(-8);
    expect(SAISONS.WINTER.tonique).toBe(-6);
  });

  it("ralentit du printemps à l'hiver", () => {
    expect(SAISONS.SPRING.bpm).toBeGreaterThan(SAISONS.SUMMER.bpm);
    expect(SAISONS.SUMMER.bpm).toBeGreaterThan(SAISONS.AUTUMN.bpm);
    expect(SAISONS.AUTUMN.bpm).toBeGreaterThan(SAISONS.WINTER.bpm);
  });

  it("ferme le filtre à mesure que l'année avance", () => {
    expect(SAISONS.SPRING.clarte).toBeGreaterThan(SAISONS.AUTUMN.clarte);
    expect(SAISONS.AUTUMN.clarte).toBeGreaterThan(SAISONS.WINTER.clarte);
  });

  it("fait de l'hiver le seul mode mineur", () => {
    // Une tierce mineure — trois demi-tons — au premier accord.
    expect(SAISONS.WINTER.accords[0]![1]).toBe(3);
    expect(SAISONS.SPRING.accords[0]![1]).toBe(4);
  });

  it("donne un pouls à chaque mesure", () => {
    for (const s of Object.values(SAISONS)) {
      const notes = composerMesure(s, 0, tirage(1));
      // Huit croches d'arpège : c'est ce qui remplace le flottement de la
      // première version, celle qui « faisait trop mystique ».
      expect(notes.filter((n) => n.role === "arpege")).toHaveLength(8);
      expect(notes.filter((n) => n.role === "basse")).toHaveLength(1);
    }
  });

  it("ne laisse aucune note déborder de sa mesure", () => {
    for (const s of Object.values(SAISONS)) {
      const m = dureeMesure(s);
      for (let i = 0; i < 40; i++) {
        for (const n of composerMesure(s, i, tirage(i + 1))) {
          expect(n.t).toBeGreaterThanOrEqual(0);
          expect(n.t).toBeLessThan(m);
        }
      }
    }
  });

  it("garde la basse sous la mélodie, toujours", () => {
    const rnd = tirage(7);
    for (let i = 0; i < 60; i++) {
      const notes = composerMesure(SAISONS.SPRING, i, rnd);
      const basse = notes.find((n) => n.role === "basse")!;
      for (const n of notes.filter((x) => x.role === "melodie")) {
        expect(n.f).toBeGreaterThan(basse.f);
      }
    }
  });

  /**
   * Le silence fait partie de la musique. Une mesure sur trois environ ne
   * porte pas de mélodie : sans ces respirations, trois heures de jeu
   * deviennent trois heures de sollicitation.
   */
  it("laisse respirer : des mesures sans mélodie", () => {
    const rnd = tirage(3);
    let vides = 0;
    const total = 200;
    for (let i = 1; i <= total; i++) {
      if (!composerMesure(SAISONS.WINTER, i, rnd).some((n) => n.role === "melodie")) vides++;
    }
    expect(vides).toBeGreaterThan(total * 0.3);
    expect(vides).toBeLessThan(total * 0.8);
  });

  it("ne se répète pas d'une mesure à l'autre", () => {
    const rnd = tirage(11);
    const signatures = new Set<string>();
    for (let i = 0; i < 60; i++) {
      signatures.add(
        composerMesure(SAISONS.SPRING, i, rnd)
          .map((n) => `${n.role}:${n.f.toFixed(1)}@${n.t.toFixed(2)}`)
          .join("|"),
      );
    }
    // Une boucle donnerait une poignée de signatures ; on en veut beaucoup.
    expect(signatures.size).toBeGreaterThan(20);
  });

  it("rejoue à l'identique avec la même graine", () => {
    const a = composerMesure(SAISONS.AUTUMN, 5, tirage(42));
    const b = composerMesure(SAISONS.AUTUMN, 5, tirage(42));
    expect(a).toEqual(b);
  });

  it("place le do de référence à 261,63 Hz", () => {
    expect(hz(0)).toBeCloseTo(261.626, 2);
    expect(hz(12)).toBeCloseTo(523.25, 1);
  });

  /**
   * L'onglet caché est le pire cas de tout le moteur : le navigateur ralentit
   * le minuteur à un battement par minute, et la reprise doit repartir de
   * maintenant plutôt que de rattraper deux cents mesures d'un coup.
   */
  it("repart de maintenant après un long passage en arrière-plan", () => {
    const mesure = dureeMesure(SAISONS.SPRING);
    // Dix minutes de retard : on renonce à rattraper.
    expect(recalerMesure(100, 700, mesure)).toBe(700);
    // Un simple décalage entre deux battements : on rattrape, la mesure
    // reste en place et le pouls ne bouge pas.
    expect(recalerMesure(699.5, 700, mesure)).toBe(699.5);
    expect(recalerMesure(700 - mesure, 700, mesure)).toBe(700 - mesure);
    // Une mesure encore à venir n'est jamais touchée.
    expect(recalerMesure(701, 700, mesure)).toBe(701);
  });

  it("remonte une basse inaudible d'une octave", () => {
    // L'hiver descendait à 37 Hz, sous ce que rend un haut-parleur
    // d'ordinateur : la note mangeait de la place sans s'entendre.
    expect(hz(basseAudible(-34))).toBeGreaterThan(45);
    expect(basseAudible(-34)).toBe(-22);
    // Une basse déjà audible ne bouge pas.
    expect(basseAudible(-24)).toBe(-24);
  });

  it("garde toutes les notes dans une plage écoutable", () => {
    for (const s of Object.values(SAISONS)) {
      for (let i = 0; i < 40; i++) {
        for (const n of composerMesure(s, i, tirage(i + 9))) {
          // Rien sous 40 Hz (un grondement qu'on ne fait que sentir) ni
          // au-dessus de 2500 Hz (la bande qui fatigue le plus vite).
          expect(n.f).toBeGreaterThan(40);
          expect(n.f).toBeLessThan(2500);
        }
      }
    }
  });
});
