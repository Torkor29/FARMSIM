import {
  SKILL_DEFS,
  SKILL_BY_ID,
  SKILL_EFFECT_CAPS,
  bonusesFor,
  emptySnapshot,
  evaluateSkills,
  skillBonuses,
  unlockedSkills,
  type SkillEffectKind,
  type SkillId,
  type SkillSnapshot,
} from "@farmsim/shared";

/**
 * L'arbre de compétences.
 *
 * Il remplace un choix — céréalier ou éleveur — qui ne verrouillait pourtant
 * aucune mécanique : rien n'a jamais empêché un céréalier de bâtir une étable.
 * Il ne filtrait que les quêtes et le guide, cachant la moitié du jeu à chacun
 * tout en la laissant jouable.
 *
 * Ce que ces tests tiennent, c'est ce que le joueur a demandé mot pour mot :
 * qu'aucune voie ne soit fermée, que tout soit atteignable, que rien ne se
 * dépense, et que ce qui se perd se reperde.
 */

const snap = (p: Partial<SkillSnapshot> = {}): SkillSnapshot => ({ ...emptySnapshot(), ...p });

describe("l’arbre de compétences", () => {
  it("ne donne rien à un nouveau joueur", () => {
    // Une ferme neuve part de zéro : aucune compétence, aucun bonus. Sans quoi
    // le premier palier ne se remarquerait pas.
    expect(unlockedSkills(emptySnapshot())).toEqual([]);
    const b = bonusesFor(emptySnapshot());
    for (const cle of Object.keys(b) as SkillEffectKind[]) {
      expect(`${cle}=${b[cle]}`).toBe(`${cle}=0`);
    }
  });

  it("ouvre le semis en semant, sans rien demander d’autre", () => {
    const ouvertes = unlockedSkills(snap({ stats: { cellsPlanted: 24 } }));
    expect(ouvertes).toContain("SOWING_BASICS");
  });

  /**
   * Le cœur de la demande : progresser d'un côté n'interdit pas l'autre.
   */
  it("laisse un joueur qui n’a jamais élevé ouvrir la branche élevage", () => {
    // Une ferme entièrement céréalière, à qui on ajoute un troupeau : la
    // branche élevage doit s'ouvrir sans que rien n'ait été « choisi ».
    const cerealier = snap({
      stats: { cellsPlanted: 600, cellsHarvested: 300, tonsHarvested: 400 },
    });
    expect(unlockedSkills(cerealier)).not.toContain("ANIMAL_KEEPING");

    const puisEleveur = snap({
      ...cerealier,
      stats: { ...cerealier.stats, grazings: 5 },
      herds: [{ species: "COW", size: 3 }],
    });
    expect(unlockedSkills(puisEleveur)).toContain("ANIMAL_KEEPING");
    // Et il garde tout ce qu'il avait gagné aux champs.
    expect(unlockedSkills(puisEleveur)).toContain("SOWING_BASICS");
  });

  it("laisse un éleveur se mettre aux céréales", () => {
    const eleveur = snap({
      stats: { grazings: 40, animalsCollected: 30, feedings: 20 },
      herds: [{ species: "COW", size: 8 }],
    });
    expect(unlockedSkills(eleveur)).toContain("ANIMAL_KEEPING");
    expect(unlockedSkills(eleveur)).not.toContain("SOWING_BASICS");

    const puisCerealier = snap({
      ...eleveur,
      stats: { ...eleveur.stats, cellsPlanted: 24 },
    });
    expect(unlockedSkills(puisCerealier)).toContain("SOWING_BASICS");
    expect(unlockedSkills(puisCerealier)).toContain("ANIMAL_KEEPING");
  });

  it("n’a aucune compétence réservée à un métier", () => {
    /*
     * Le test qui remplace l'ancien système. Aucune condition ne doit
     * mentionner un métier : si l'une le faisait, on aurait recréé la classe
     * qu'on vient de retirer, sous un autre nom.
     */
    const texte = JSON.stringify(SKILL_DEFS);
    expect(texte.includes("CEREALIER")).toBe(false);
    expect(texte.includes("ELEVEUR")).toBe(false);
  });

  /**
   * Ce qui se perd se reperd — et toute la branche avec.
   */
  it("referme la branche quand la condition d’état disparaît", () => {
    const avec = snap({
      stats: { grazings: 40, feedings: 120, animalsCollected: 60 },
      herds: [{ species: "COW", size: 10 }],
      buildings: [{ type: "PADDOCK", level: 1 }, { type: "BUNKER_SILO", level: 1 }],
    });
    expect(unlockedSkills(avec)).toContain("ANIMAL_KEEPING");
    expect(unlockedSkills(avec)).toContain("HERD_COMFORT");
    expect(unlockedSkills(avec)).toContain("FEED_MASTERY");

    // Le troupeau part. La racine se referme, donc la branche entière.
    const sans = snap({ ...avec, herds: [] });
    const restantes = unlockedSkills(sans);
    expect(restantes).not.toContain("ANIMAL_KEEPING");
    expect(restantes).not.toContain("HERD_COMFORT");
    // FEED_MASTERY dépend de FEED_PLAN qui dépend d'ANIMAL_KEEPING : la
    // cascade doit descendre jusqu'au bout, pas d'un cran.
    expect(restantes).not.toContain("FEED_MASTERY");
  });

  it("garde ce qui repose sur un compteur cumulé", () => {
    // La frontière voulue : le savoir-faire reste, l'outillage se perd. Un
    // compteur ne redescend jamais, donc ces compétences-là sont acquises.
    const apres = snap({ stats: { cellsPlanted: 24 }, herds: [] });
    expect(unlockedSkills(apres)).toContain("SOWING_BASICS");
  });

  it("respecte les prérequis, quel que soit l’ordre d’écriture", () => {
    // `IMPROVED_SEED` exige `SOWING_BASICS` : le semoir et le compteur ne
    // suffisent pas si la racine manque.
    const sansRacine = snap({
      stats: { cellsPlanted: 150 },
      machines: [{ type: "SEEDER", tier: 1, hours: 0 }],
    });
    // 150 ≥ 24, donc la racine s'ouvre aussi — et l'enfant suit.
    expect(unlockedSkills(sansRacine)).toContain("SOWING_BASICS");
    expect(unlockedSkills(sansRacine)).toContain("IMPROVED_SEED");

    // Sans le semoir, l'enfant reste fermé même avec le compteur.
    const sansSemoir = snap({ stats: { cellsPlanted: 150 } });
    expect(unlockedSkills(sansSemoir)).not.toContain("IMPROVED_SEED");
  });

  it("borne chaque levier à sa propre enveloppe", () => {
    /*
     * Le plafond des compétences est **séparé** de celui des bâtiments. Même
     * en ouvrant l'arbre entier, aucun levier ne doit dépasser le sien : c'est
     * ce qui permet aux deux enveloppes de s'additionner sans que l'équilibre
     * des bâtiments soit réécrit en silence.
     */
    const tout = SKILL_DEFS.map((d) => d.id);
    const b = skillBonuses(tout);
    for (const cle of Object.keys(b) as SkillEffectKind[]) {
      expect(`${cle} ${b[cle] <= SKILL_EFFECT_CAPS[cle]}`).toBe(`${cle} true`);
    }
  });

  it("n’a aucune compétence sans effet", () => {
    // Un arbre décoratif est exactement ce qu'on ne voulait pas.
    for (const d of SKILL_DEFS) {
      expect(`${d.id} effets=${d.effects.length > 0}`).toBe(`${d.id} effets=true`);
    }
  });

  it("n’a aucun prérequis qui pointe dans le vide", () => {
    // Une compétence qui exige un identifiant inexistant ne s'ouvrirait jamais
    // — un verrou sans serrure, le défaut qu'on vient de corriger ailleurs.
    const connus = new Set(SKILL_DEFS.map((d) => d.id));
    const verifier = (c: unknown): void => {
      if (!c || typeof c !== "object") return;
      const cond = c as { kind?: string; skill?: SkillId; of?: unknown[] };
      if (cond.kind === "skill") expect(connus.has(cond.skill!)).toBe(true);
      for (const sous of cond.of ?? []) verifier(sous);
    };
    for (const d of SKILL_DEFS) verifier(d.condition);
  });

  it("est entièrement atteignable par un joueur qui joue longtemps", () => {
    /*
     * « À très long terme, un joueur qui joue suffisamment doit pouvoir
     * compléter l'intégralité de l'arbre. » Une seule condition impossible —
     * un bâtiment à un palier qui n'existe pas, deux compétences qui
     * s'attendent l'une l'autre — et la promesse tombe. On monte donc une
     * ferme volontairement démesurée, et on exige que tout s'ouvre.
     */
    const veteran: SkillSnapshot = {
      level: 20,
      stats: {
        cellsPlanted: 5000,
        cellsFertilized: 5000,
        cellsPlowed: 5000,
        cellsStubbled: 5000,
        cellsHarvested: 5000,
        cellsWeeded: 5000,
        tonsHarvested: 5000,
        tonsSold: 5000,
        buildingsBuilt: 100,
        buildingsUpgraded: 100,
        machinesServiced: 500,
        animalsCollected: 5000,
        hlCollected: 5000,
        animalsBought: 500,
        grazings: 500,
        feedings: 500,
        deliveries: 200,
        contracts: 100,
      },
      buildings: [
        "SILO", "HAY_BARN", "MACHINE_SHED", "CATTLE_BARN", "PIGSTY", "HENHOUSE",
        "SHEEPFOLD", "WORKSHOP", "FARMHOUSE", "PADDOCK", "COLD_ROOM",
        "BUNKER_SILO", "DAIRY", "MILL",
      ].map((type) => ({ type: type as never, level: 5 })),
      machines: [
        "TRACTOR", "HARVESTER", "FORAGE_HARVESTER", "PLOUGH", "SEEDER", "SPREADER",
        "DISC_HARROW", "MOWER", "SPRAYER", "BALER", "TRAILER",
      ].map((type) => ({ type: type as never, tier: 3, hours: 200 })),
      herds: [
        { species: "COW", size: 40 },
        { species: "PIG", size: 20 },
        { species: "HEN", size: 30 },
        { species: "SHEEP", size: 20 },
      ],
    };
    const manquantes = evaluateSkills(veteran)
      .filter((s) => !s.unlocked)
      .map((s) => s.def.id);
    expect(manquantes).toEqual([]);
  });

  it("dit toujours quoi faire pour avancer", () => {
    // Une compétence fermée sans aucune condition affichée laisserait le
    // joueur devant un cadenas muet.
    for (const s of evaluateSkills(emptySnapshot())) {
      if (s.unlocked) continue;
      expect(`${s.def.id} conditions=${s.progress.length > 0}`).toBe(`${s.def.id} conditions=true`);
    }
  });

  it("chiffre la progression au lieu de la cacher", () => {
    // « 37 / 50 semis » plutôt qu'un cadenas : c'est la demande explicite.
    const presque = snap({ stats: { cellsPlanted: 12 } });
    const semis = evaluateSkills(presque).find((s) => s.def.id === "SOWING_BASICS")!;
    expect(semis.unlocked).toBe(false);
    expect(semis.progress[0]?.have).toBe(12);
    expect(semis.progress[0]?.need).toBe(24);
    expect(semis.ratio).toBeCloseTo(0.5, 5);
  });

  it("relie chaque condition à un compteur que le jeu alimente vraiment", () => {
    /*
     * Le garde-fou qui compte le plus. Le jeu portait déjà un compteur mort —
     * `feedings`, que la quête « Nourrir le troupeau » attendait et que
     * personne n'incrémentait : un verrou sans serrure. Cette liste est celle
     * des compteurs dont on a vérifié, dans les routes, qu'ils sont écrits.
     */
    const alimentes = new Set([
      "cellsPlanted", "cellsFertilized", "cellsPlowed", "cellsStubbled",
      "cellsHarvested", "cellsWeeded", "tonsHarvested", "tonsSold",
      "buildingsBuilt", "buildingsUpgraded", "machinesServiced",
      "animalsCollected", "hlCollected", "grazings", "feedings",
      "deliveries", "contracts",
    ]);
    const verifier = (c: unknown): void => {
      if (!c || typeof c !== "object") return;
      const cond = c as { kind?: string; stat?: string; of?: unknown[] };
      if (cond.kind === "stat") {
        expect(`${cond.stat} alimenté`).toBe(
          alimentes.has(cond.stat!) ? `${cond.stat} alimenté` : `${cond.stat} JAMAIS ÉCRIT`,
        );
      }
      for (const sous of cond.of ?? []) verifier(sous);
    };
    for (const d of SKILL_DEFS) verifier(d.condition);
  });

  it("garde un sommet qui exige d’avoir tout pratiqué", () => {
    // L'aboutissement doit être l'inverse d'un choix de classe : on ne
    // l'atteint qu'en ayant mené les quatre branches.
    const sommet = SKILL_BY_ID.COMPLETE_FARMER;
    expect(sommet).toBeDefined();
    const texte = JSON.stringify(sommet.condition);
    for (const racine of ["AGRONOMY", "STOCKMANSHIP", "FLEET_MASTERY", "NEGOTIATION"]) {
      expect(texte.includes(racine)).toBe(true);
    }
  });
});
