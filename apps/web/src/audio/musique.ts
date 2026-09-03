/**
 * La musique : quatre saisons, jamais deux fois la même mesure.
 *
 * ## Ce qui a été corrigé en route
 *
 * La première version « faisait un petit peu trop mystique ». Trois causes,
 * toutes réparées ici :
 *
 * 1. **Pas de pulsation.** Les notes tombaient au hasard entre une
 *    demi-seconde et deux et demie. Sans pouls, une musique flotte, et
 *    flotter c'est exactement ce qui fait « mystique ». D'où l'arpège
 *    régulier, qui donne le pouls sans battre la mesure.
 * 2. **Trop de réverbération** — une cathédrale, pas une cour de ferme.
 * 3. **Des notes semées au hasard**, qu'on ne pouvait pas fredonner. D'où de
 *    vraies phrases de quatre notes, reprises avec variations.
 *
 * Puis « trop aigu » : tout est descendu de trois demi-tons et le filtre
 * s'est fermé. Les toniques ci-dessous portent encore cette baisse.
 *
 * ## Pourquoi ce n'est pas une boucle
 *
 * Une boucle de deux minutes se reconnaît au troisième tour et se coupe au
 * quatrième. Ici, chaque mesure est **composée au moment de la jouer** : les
 * accords tournent, mais la mélodie tire ses phrases d'un tirage qui ne
 * revient jamais au même point. Coût : zéro octet téléchargé, contre seize
 * mégaoctets pour quatre saisons enregistrées.
 *
 * ## Le passage d'une saison à l'autre
 *
 * Deux pistes, pas une. L'ancienne saison continue de jouer pendant que la
 * nouvelle démarre à zéro et monte : elles se croisent sur huit secondes. Un
 * fondu au silence puis un redémarrage s'entendrait comme une coupure — et
 * une coupure, dans une musique de fond, se remarque bien plus que la
 * musique elle-même.
 */

export type SaisonMusicale = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";

export type ConfigSaison = {
  /** Décalage en demi-tons depuis do3. */
  tonique: number;
  /** Quatre accords, en demi-tons depuis la tonique. */
  accords: number[][];
  bpm: number;
  /** La gamme dont la mélodie tire ses degrés. */
  gamme: number[];
  /** Fréquence de coupure : c'est le réglage « moins aigu ». */
  clarte: number;
  /** Chance qu'une mesure porte une phrase plutôt qu'un silence. */
  densite: number;
};

/**
 * Chaque saison garde la même famille — chaleureuse, pulsée, jamais
 * flottante. Ce qui change : la teinte de l'accord, le tempo, la hauteur,
 * la densité. L'hiver est mineur, mais le pouls et la rondeur du timbre
 * l'empêchent de tourner au funèbre.
 */
export const SAISONS: Record<SaisonMusicale, ConfigSaison> = {
  SPRING: {
    tonique: -3,
    accords: [
      [0, 4, 7],
      [7, 11, 14],
      [9, 12, 16],
      [5, 9, 12],
    ],
    bpm: 78,
    gamme: [0, 2, 4, 7, 9],
    clarte: 1600,
    densite: 0.72,
  },
  SUMMER: {
    tonique: 2,
    accords: [
      [0, 4, 7],
      [5, 9, 12],
      [7, 11, 14],
      [0, 4, 7],
    ],
    bpm: 72,
    gamme: [0, 2, 4, 7, 9],
    clarte: 1450,
    densite: 0.66,
  },
  AUTUMN: {
    tonique: -8,
    accords: [
      [0, 4, 7],
      [9, 12, 16],
      [5, 9, 12],
      [7, 11, 14],
    ],
    bpm: 66,
    gamme: [0, 2, 4, 7, 9],
    clarte: 1250,
    densite: 0.58,
  },
  WINTER: {
    tonique: -6,
    accords: [
      [0, 3, 7],
      [5, 8, 12],
      [-4, 0, 3],
      [7, 10, 14],
    ],
    bpm: 60,
    gamme: [0, 3, 5, 7, 10],
    clarte: 1150,
    densite: 0.44,
  },
};

/**
 * Cinq phrases de quatre notes, en degrés de la gamme.
 *
 * C'est peu, et c'est voulu : on les transpose sur l'accord courant et on
 * les reprend. Un vocabulaire restreint qui revient, c'est ce qui distingue
 * une mélodie d'une suite de notes justes.
 */
const PHRASES = [
  [0, 1, 2, 1],
  [2, 1, 0, 2],
  [0, 2, 3, 2],
  [3, 2, 1, 0],
  [1, 2, 3, 4],
];

export function hz(demiTons: number): number {
  return 261.626 * Math.pow(2, demiTons / 12);
}

/** Sous ce seuil, un haut-parleur d'ordinateur ne rend plus rien. */
const BASSE_MIN_HZ = 45;

/**
 * Remonte la basse d'une octave tant qu'elle est inaudible.
 *
 * Deux octaves sous la tonique, l'hiver descendait à 37 Hz. Aucun
 * haut-parleur d'ordinateur portable ne descend là : la note ne s'entendait
 * pas, mais elle occupait quand même sa place dans le mélange, et le
 * limiteur baissait tout le reste pour lui faire de la room. On perdait donc
 * du volume au profit d'une note que personne n'entendra jamais.
 */
export function basseAudible(demi: number): number {
  let d = demi;
  while (hz(d) < BASSE_MIN_HZ) d += 12;
  return d;
}

export type Note = {
  /** Départ en secondes depuis le début de la mesure. */
  t: number;
  f: number;
  /** Volume avant les curseurs. */
  vol: number;
  /** Longueur de la descente, en secondes. */
  longueur: number;
  role: "arpege" | "basse" | "melodie";
};

/**
 * Un tirage reproductible.
 *
 * Le hasard du navigateur ferait l'affaire, mais un tirage qu'on peut
 * rejouer rend la composition vérifiable : deux appels avec la même graine
 * donnent la même mesure, et un test peut donc l'examiner.
 */
export function tirage(graine: number): () => number {
  let x = graine >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

export function dureeMesure(cfg: ConfigSaison): number {
  return (60 / cfg.bpm) * 4;
}

/**
 * Où reprendre quand la programmation a pris du retard.
 *
 * Un navigateur ralentit le minuteur d'un onglet en arrière-plan jusqu'à une
 * fois par minute. Sans recalage, revenir sur le jeu après dix minutes
 * rattraperait deux cents mesures d'un coup, toutes empilées sur le même
 * instant : le vacarme que le portier interdit aux effets, et auquel la
 * musique n'échappait pas.
 *
 * Au-delà de deux mesures de retard, on renonce donc à rattraper et on
 * repart de maintenant. En deçà, on rattrape : c'est le décalage normal
 * entre deux battements du minuteur, et le rattraper garde la mesure en
 * place.
 */
export function recalerMesure(prochaine: number, maintenant: number, mesure: number): number {
  return prochaine < maintenant - mesure * 2 ? maintenant : prochaine;
}

/**
 * Compose une mesure, et rien de plus.
 *
 * Pur : ni contexte audio, ni horloge. C'est ce qui permet de vérifier que
 * l'hiver est bien mineur, que la basse reste sous la mélodie et qu'aucune
 * note ne dépasse de la mesure — sans navigateur.
 */
export function composerMesure(
  cfg: ConfigSaison,
  indexMesure: number,
  rnd: () => number,
): Note[] {
  const parTemps = 60 / cfg.bpm;
  const mesure = parTemps * 4;
  // L'accord tient deux mesures : plus court, la marche harmonique se met à
  // courir et le fond devient un premier plan.
  const accord = cfg.accords[Math.floor(indexMesure / 2) % cfg.accords.length]!;
  const notes: Note[] = [];

  // --- L'arpège : le pouls, et rien d'autre ---------------------------
  for (let k = 0; k < 8; k++) {
    notes.push({
      t: k * (parTemps / 2),
      f: hz(cfg.tonique + accord[k % accord.length]!),
      // Un léger creux sur les temps faibles : sans lui, l'arpège tape.
      vol: k % 2 === 0 ? 0.085 : 0.058,
      longueur: 0.42,
      role: "arpege",
    });
  }

  // --- La basse : une note par mesure, deux octaves plus bas -----------
  notes.push({
    t: 0,
    f: hz(basseAudible(cfg.tonique + accord[0]! - 24)),
    vol: 0.16,
    longueur: 1.6,
    role: "basse",
  });

  // --- La mélodie : des phrases, et des silences -----------------------
  //
  // Une mesure sur trois ou presque ne porte rien. Le silence n'est pas un
  // trou : c'est ce qui empêche une musique de trois heures de peser.
  if (indexMesure > 0 && rnd() <= cfg.densite) {
    const phrase = PHRASES[Math.floor(rnd() * PHRASES.length)]!;
    const transpose = accord[0]!;
    phrase.forEach((degre, j) => {
      const demi =
        cfg.gamme[degre % cfg.gamme.length]! + 12 * Math.floor(degre / cfg.gamme.length);
      const t = j * parTemps;
      if (t >= mesure) return;
      notes.push({
        t,
        f: hz(cfg.tonique + transpose + demi + 12),
        vol: 0.2,
        longueur: 0.85,
        role: "melodie",
      });
    });
  }

  return notes;
}

/* ------------------------------------------------------------------ */
/* La partie qui sonne                                                 */
/* ------------------------------------------------------------------ */

/** Combien de temps la nouvelle saison met à remplacer l'ancienne. */
export const FONDU_S = 8;

/** On programme toujours un peu d'avance : sinon, un hoquet à chaque mesure. */
const AVANCE_S = 1.5;

/**
 * Une piste : une saison, son pouls, son gain.
 *
 * Elle sait démarrer, programmer ses mesures à l'avance, et s'éteindre. Deux
 * pistes vivent ensemble le temps d'un fondu, jamais plus.
 */
class Piste {
  readonly gain: GainNode;
  private prochaineMesure: number;
  private index = 0;
  private rnd: () => number;
  /**
   * L'instant après lequel la piste ne compose plus.
   *
   * Elle continue de jouer **pendant** tout le fondu : une piste qui cesse
   * de composer dès qu'on lui demande de s'éteindre laisserait un silence de
   * six secondes au milieu du croisement, ce qui est précisément la coupure
   * qu'on cherche à éviter.
   */
  private finAt: number | null = null;

  constructor(
    private ctx: AudioContext,
    private cfg: ConfigSaison,
    dest: AudioNode,
    depart: number,
    graine: number,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(dest);
    this.prochaineMesure = depart;
    this.rnd = tirage(graine);
  }

  /** Programme tout ce qui commence dans la seconde et demie qui vient. */
  avancer(maintenant: number): void {
    const mesure = dureeMesure(this.cfg);
    this.prochaineMesure = recalerMesure(this.prochaineMesure, maintenant, mesure);
    const limite = Math.min(maintenant + AVANCE_S, this.finAt ?? Infinity);
    while (this.prochaineMesure < limite) {
      const t0 = Math.max(this.prochaineMesure, maintenant);
      for (const n of composerMesure(this.cfg, this.index, this.rnd)) {
        this.jouerNote(n, t0 + n.t);
      }
      this.prochaineMesure += mesure;
      this.index++;
    }
  }

  /**
   * Une note de boîte à musique : attaque douce, descente courte.
   *
   * La descente courte est ce qui empêche les notes de s'empiler en nappe —
   * l'empilement était l'autre moitié du « mystique ».
   */
  private jouerNote(n: Note, quand: number): void {
    const ctx = this.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, quand);
    env.gain.linearRampToValueAtTime(n.vol, quand + 0.006);
    env.gain.setTargetAtTime(0, quand + 0.006, n.longueur / 2.5);
    env.connect(this.gain);

    const fin = quand + n.longueur * 3;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = n.f;
    o.connect(env);
    o.start(quand);
    o.stop(fin);

    // Une seule harmonique, discrète. L'aigu est ce qui fatigue sur trois
    // heures : la deuxième harmonique de la version d'origine est tombée de
    // 0,22 à 0,14, et la troisième a disparu.
    const h = ctx.createGain();
    h.gain.value = 0.14;
    h.connect(env);
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = n.f * 2;
    o2.connect(h);
    o2.start(quand);
    o2.stop(fin);
  }

  monter(quand: number, cible: number, duree: number): void {
    this.gain.gain.cancelScheduledValues(quand);
    this.gain.gain.setValueAtTime(this.gain.gain.value, quand);
    this.gain.gain.linearRampToValueAtTime(cible, quand + duree);
  }

  /** Descend jusqu'au silence, puis se débranche. La piste ne repart pas. */
  eteindre(quand: number, duree: number): void {
    this.finAt = quand + duree;
    this.gain.gain.cancelScheduledValues(quand);
    this.gain.gain.setValueAtTime(this.gain.gain.value, quand);
    this.gain.gain.linearRampToValueAtTime(0, quand + duree);
    setTimeout(
      () => {
        try {
          this.gain.disconnect();
        } catch {
          /* déjà débranché */
        }
      },
      (duree + 4) * 1000,
    );
  }

  /** Vraie une fois le fondu terminé : la piste n'a plus rien à dire. */
  finie(maintenant: number): boolean {
    return this.finAt !== null && maintenant >= this.finAt;
  }

  /** En train de s'éteindre — donc pas candidate à un changement de volume. */
  get sEteint(): boolean {
    return this.finAt !== null;
  }
}

/**
 * Le chef d'orchestre : au plus deux pistes, un filtre, un peu de pièce.
 */
export class Musique {
  private sortie: GainNode;
  private filtre: BiquadFilterNode;
  private pistes: Piste[] = [];
  private saison: SaisonMusicale | null = null;
  private minuteur: ReturnType<typeof setInterval> | null = null;

  constructor(
    private ctx: AudioContext,
    dest: AudioNode,
  ) {
    this.sortie = ctx.createGain();
    this.filtre = ctx.createBiquadFilter();
    this.filtre.type = "lowpass";
    this.filtre.frequency.value = SAISONS.SPRING.clarte;
    this.filtre.Q.value = 0.7;
    this.filtre.connect(this.sortie);
    this.sortie.connect(dest);
  }

  /**
   * Change de saison — ou démarre, si c'est la première.
   *
   * Rappeler avec la même saison ne fait rien : l'écran recalcule la saison
   * à chaque minute, et redémarrer la musique à chaque fois serait absurde.
   */
  saisonDevient(s: SaisonMusicale): void {
    if (this.saison === s) return;
    const premier = this.saison === null;
    this.saison = s;
    const cfg = SAISONS[s];
    const t = this.ctx.currentTime;

    // Le filtre suit la saison en glissant : un timbre qui change d'un coup
    // s'entend, alors qu'on veut justement qu'on ne s'en aperçoive pas.
    this.filtre.frequency.cancelScheduledValues(t);
    this.filtre.frequency.setValueAtTime(this.filtre.frequency.value, t);
    this.filtre.frequency.linearRampToValueAtTime(cfg.clarte, t + FONDU_S);

    for (const p of this.pistes) if (!p.sEteint) p.eteindre(t, FONDU_S);

    const neuve = new Piste(this.ctx, cfg, this.filtre, t + 0.1, (Date.now() ^ 0x9e37) >>> 0);
    // La toute première piste monte plus vite : personne n'attend huit
    // secondes le début de la musique. Une transition, si.
    neuve.monter(t, 1, premier ? 2.5 : FONDU_S);
    this.pistes.push(neuve);

    if (!this.minuteur) {
      this.minuteur = setInterval(() => this.battre(), 250);
    }
    this.battre();
  }

  arreter(): void {
    if (this.minuteur) clearInterval(this.minuteur);
    this.minuteur = null;
    const t = this.ctx.currentTime;
    for (const p of this.pistes) p.eteindre(t, 1.5);
    this.pistes = [];
    this.saison = null;
  }

  private battre(): void {
    const maintenant = this.ctx.currentTime;
    this.pistes = this.pistes.filter((p) => !p.finie(maintenant));
    for (const p of this.pistes) p.avancer(maintenant);
  }
}
