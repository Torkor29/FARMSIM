/**
 * Le catalogue : tous les bruits du jeu, calculés dans le navigateur.
 *
 * ## Pourquoi rien n'est téléchargé
 *
 * Quatre musiques de saison en WAV pèsent seize mégaoctets. Compressées,
 * encore deux ou trois — pour un jeu dont tous les dessins réunis en font
 * vingt-six. Or chacun de ces sons **est** une formule : une hauteur qui
 * descend, un filtre qui se ferme, une amplitude hachée. On envoie donc la
 * formule, pas son résultat. Zéro octet, et un meuglement jamais tout à fait
 * identique au précédent — ce qui vaut mieux qu'un échantillon qu'on
 * reconnaît à la troisième écoute.
 *
 * ## Le procédé
 *
 * Presque tout suit le même chemin : une source riche en harmoniques (dent de
 * scie ou bruit blanc) passe dans un ou deux **résonateurs étroits**, qui
 * imitent une bouche, un tuyau ou une tôle. C'est le résonateur qui fait
 * « vache » plutôt que « synthé », et la courbe de hauteur qui fait le reste.
 *
 * ## Le parti pris des animaux
 *
 * Une banque de sons aurait donné de vrais enregistrements de basse-cour. Ils
 * auraient sonné faux : le jeu est dessiné à la main, et une vache
 * photographique dans un décor au trait s'entend comme une pièce rapportée.
 * On cherche donc le **signe** de l'animal, comme un dessin cherche le trait
 * plutôt que le grain de la peau. (Accessoirement, les banques gratuites de
 * cris de ferme sont en CC-BY-SA — contaminante, donc inutilisable ici.)
 */

import type { Bus } from "./prefs";

export type SonId =
  // Interface
  | "clic"
  | "fenetre"
  | "pose"
  | "piece"
  | "refus"
  | "chantier"
  | "niveau"
  | "recolte"
  // Machines
  | "tracteur"
  | "moissonneuse"
  | "presse"
  | "semoir"
  | "charrue"
  | "pulverisateur"
  | "remorque"
  // Bâtiments
  | "construction"
  | "porte"
  | "livraison"
  // Animaux
  | "vache"
  | "mouton"
  | "cochon"
  | "poule";

export type DefSon = {
  bus: Bus;
  /** Durée réelle, pour libérer la voix au bon moment. */
  dureeMs: number;
  /** Délai minimal avant de rejouer le même son. */
  delaiMs: number;
  /** Volume propre au son, avant les curseurs du joueur. */
  gain: number;
  /** Monte le graphe. Le contexte n'existe pas pendant les tests. */
  rendre: (ctx: BaseAudioContext, dest: AudioNode, t0: number) => void;
};

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

let bruitCache: AudioBuffer | null = null;
let bruitCtx: BaseAudioContext | null = null;

/** Deux secondes de bruit blanc, taillées une fois et rejouées en boucle. */
function bruitBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (bruitCache && bruitCtx === ctx) return bruitCache;
  const n = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  bruitCache = buf;
  bruitCtx = ctx;
  return buf;
}

function source(ctx: BaseAudioContext, t0: number, duree: number): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = bruitBuffer(ctx);
  s.loop = true;
  s.start(t0);
  s.stop(t0 + duree);
  return s;
}

function osc(
  ctx: BaseAudioContext,
  type: OscillatorType,
  f: number,
  t0: number,
  duree: number,
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  o.start(t0);
  o.stop(t0 + duree);
  return o;
}

/**
 * L'enveloppe : montée courte, descente exponentielle.
 *
 * `setTargetAtTime` plutôt qu'une rampe droite — une descente droite
 * s'entend comme un couperet, une exponentielle comme un son qui s'éteint.
 */
function enveloppe(
  ctx: BaseAudioContext,
  t0: number,
  attaque: number,
  chute: number,
  crete: number,
): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(crete, t0 + attaque);
  g.gain.setTargetAtTime(0, t0 + attaque, chute);
  return g;
}

/** Un résonateur étroit : c'est lui qui donne un corps au bruit. */
function formant(ctx: BaseAudioContext, f: number, q: number): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = "bandpass";
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function passeBas(ctx: BaseAudioContext, f: number, q = 0.8): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = "lowpass";
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function passeHaut(ctx: BaseAudioContext, f: number): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = "highpass";
  b.frequency.value = f;
  return b;
}

function chaine(...noeuds: AudioNode[]): void {
  for (let i = 0; i < noeuds.length - 1; i++) noeuds[i]!.connect(noeuds[i + 1]!);
}

/**
 * Brancher un oscillateur sur un réglage plutôt que sur un haut-parleur.
 *
 * C'est le geste qui fait toutes les modulations du fichier : un trémolo,
 * c'est une onde lente branchée sur un gain.
 */
function versParam(source: AudioNode, gain: number, cible: AudioParam): void {
  const g = source.context.createGain();
  g.gain.value = gain;
  source.connect(g);
  g.connect(cible);
}

/**
 * Un hachoir d'amplitude.
 *
 * Un moteur diesel, un grognement de cochon et une batteuse de moissonneuse
 * sont le même geste à trois vitesses : un souffle continu coupé en tranches
 * régulières. On module donc le gain par un oscillateur lent.
 */
function hachoir(
  ctx: BaseAudioContext,
  hz: number,
  profondeur: number,
  t0: number,
  duree: number,
): GainNode {
  // Le gain oscille entre `1 - profondeur` et `1`, jamais en dessous de
  // zéro : un gain négatif retourne la phase du signal, ce qui ajoute une
  // couleur parasite au moteur sans rien apporter au hachage.
  const g = ctx.createGain();
  g.gain.value = 1 - profondeur / 2;
  versParam(osc(ctx, "sine", hz, t0, duree), profondeur / 2, g.gain);
  return g;
}

/** Une note de cloche : sinus, harmonique, descente franche. */
function cloche(
  ctx: BaseAudioContext,
  dest: AudioNode,
  f: number,
  t0: number,
  duree: number,
  gain: number,
): void {
  const g = enveloppe(ctx, t0, 0.004, duree / 3, gain);
  chaine(osc(ctx, "sine", f, t0, duree), g, dest);
  const h = enveloppe(ctx, t0, 0.004, duree / 5, gain * 0.28);
  chaine(osc(ctx, "sine", f * 2, t0, duree), h, dest);
}

/**
 * Un cri d'animal : dent de scie, deux formants, une hauteur qui bouge.
 *
 * Les cinq arguments suffisent à écrire les quatre bêtes ; le reste — le
 * trémolo du mouton, les saccades de la poule — se pose par-dessus.
 */
function bete(
  ctx: BaseAudioContext,
  dest: AudioNode,
  opts: {
    t0: number;
    duree: number;
    /** Hauteur au départ, à mi-course, à la fin. */
    hauteurs: [number, number, number];
    formants: [number, number];
    q: [number, number];
    clarte: number;
    attaque: number;
    chute: number;
    gain: number;
    /** Un souffle mêlé à la dent de scie : le cochon en veut beaucoup. */
    souffle?: number;
  },
): GainNode {
  const { t0, duree } = opts;
  const o = osc(ctx, "sawtooth", opts.hauteurs[0], t0, duree);
  o.frequency.linearRampToValueAtTime(opts.hauteurs[1], t0 + duree * 0.35);
  o.frequency.linearRampToValueAtTime(opts.hauteurs[2], t0 + duree);

  const melange = ctx.createGain();
  melange.gain.value = 1;
  o.connect(melange);
  if (opts.souffle) {
    const s = ctx.createGain();
    s.gain.value = opts.souffle;
    chaine(source(ctx, t0, duree), s, melange);
  }

  const f1 = formant(ctx, opts.formants[0], opts.q[0]);
  const f2 = formant(ctx, opts.formants[1], opts.q[1]);
  const g1 = ctx.createGain();
  g1.gain.value = 0.9;
  const g2 = ctx.createGain();
  // Le second formant reste discret : c'est lui qui rendait tout criard
  // quand il montait, et « criard » est exactement ce qu'on ne veut pas
  // d'un son qui reviendra mille fois.
  g2.gain.value = 0.2;

  const somme = ctx.createGain();
  somme.gain.value = 1;
  chaine(melange, f1, g1, somme);
  chaine(melange, f2, g2, somme);

  const env = enveloppe(ctx, t0, opts.attaque, opts.chute, opts.gain);
  chaine(somme, passeBas(ctx, opts.clarte), env, dest);
  return env;
}

/* ------------------------------------------------------------------ */
/* Le catalogue                                                        */
/* ------------------------------------------------------------------ */

export const CATALOGUE: Record<SonId, DefSon> = {
  /* --- Interface ------------------------------------------------- */

  /** Un clic : très court, très discret. Il revient mille fois par partie. */
  clic: {
    bus: "effets",
    dureeMs: 70,
    delaiMs: 45,
    gain: 0.18,
    rendre(ctx, dest, t0) {
      const env = enveloppe(ctx, t0, 0.001, 0.012, 1);
      chaine(source(ctx, t0, 0.07), passeHaut(ctx, 1400), formant(ctx, 2600, 3), env, dest);
    },
  },

  /** Ouverture d'un panneau : un souffle qui monte, rien de plus. */
  fenetre: {
    bus: "effets",
    dureeMs: 200,
    delaiMs: 120,
    gain: 0.12,
    rendre(ctx, dest, t0) {
      const pb = passeBas(ctx, 700, 4);
      pb.frequency.linearRampToValueAtTime(2400, t0 + 0.16);
      const env = enveloppe(ctx, t0, 0.03, 0.05, 1);
      chaine(source(ctx, t0, 0.2), pb, env, dest);
    },
  },

  /** Un bâtiment se pose : une masse qui touche le sol. */
  pose: {
    bus: "effets",
    dureeMs: 320,
    delaiMs: 150,
    gain: 0.5,
    rendre(ctx, dest, t0) {
      const o = osc(ctx, "sine", 110, t0, 0.3);
      o.frequency.exponentialRampToValueAtTime(48, t0 + 0.26);
      chaine(o, enveloppe(ctx, t0, 0.004, 0.07, 1), dest);
      // La poussière : sans elle, le choc est une note, pas un impact.
      const env = enveloppe(ctx, t0, 0.002, 0.04, 0.5);
      chaine(source(ctx, t0, 0.2), passeBas(ctx, 900), env, dest);
    },
  },

  /** De l'argent rentre : une quinte qui monte, brillante et brève. */
  piece: {
    bus: "effets",
    dureeMs: 380,
    delaiMs: 160,
    gain: 0.3,
    rendre(ctx, dest, t0) {
      cloche(ctx, dest, 1318.5, t0, 0.18, 1);
      cloche(ctx, dest, 1975.5, t0 + 0.075, 0.3, 0.8);
    },
  },

  /**
   * Un refus : deux notes qui descendent.
   *
   * Grave et courte. Un buzz strident punirait le joueur d'avoir essayé —
   * or il a le droit d'essayer ; on lui dit juste non.
   */
  refus: {
    bus: "effets",
    dureeMs: 260,
    delaiMs: 220,
    gain: 0.26,
    rendre(ctx, dest, t0) {
      const un = enveloppe(ctx, t0, 0.006, 0.05, 1);
      chaine(osc(ctx, "triangle", 233, t0, 0.12), passeBas(ctx, 1200), un, dest);
      const deux = enveloppe(ctx, t0 + 0.1, 0.006, 0.06, 0.9);
      chaine(osc(ctx, "triangle", 175, t0 + 0.1, 0.16), passeBas(ctx, 1000), deux, dest);
    },
  },

  /** Un chantier part : trois notes qui montent, comme on se met en route. */
  chantier: {
    bus: "effets",
    dureeMs: 460,
    delaiMs: 250,
    gain: 0.26,
    rendre(ctx, dest, t0) {
      [523.25, 659.25, 784].forEach((f, i) => cloche(ctx, dest, f, t0 + i * 0.09, 0.26, 0.9));
    },
  },

  /** Une montée de niveau : quatre notes, et un peu de fierté. */
  niveau: {
    bus: "effets",
    dureeMs: 900,
    delaiMs: 600,
    gain: 0.34,
    rendre(ctx, dest, t0) {
      [523.25, 659.25, 784, 1046.5].forEach((f, i) =>
        cloche(ctx, dest, f, t0 + i * 0.11, i === 3 ? 0.55 : 0.3, 1),
      );
    },
  },

  /** Une récolte encaissée : le grain qui coule, puis la caisse. */
  recolte: {
    bus: "effets",
    dureeMs: 620,
    delaiMs: 350,
    gain: 0.3,
    rendre(ctx, dest, t0) {
      const pb = passeBas(ctx, 3000, 1);
      pb.frequency.linearRampToValueAtTime(900, t0 + 0.34);
      const env = enveloppe(ctx, t0, 0.02, 0.11, 0.55);
      chaine(source(ctx, t0, 0.4), passeHaut(ctx, 700), pb, env, dest);
      cloche(ctx, dest, 1046.5, t0 + 0.26, 0.3, 0.75);
      cloche(ctx, dest, 1568, t0 + 0.35, 0.32, 0.6);
    },
  },

  /* --- Machines ---------------------------------------------------- */

  /**
   * Un tracteur : le teuf-teuf.
   *
   * Un diesel n'est pas un bourdon continu, c'est une explosion répétée. Tout
   * tient dans le hachoir à douze coups par seconde ; sans lui on obtient un
   * ronflement d'aspirateur.
   */
  tracteur: {
    bus: "effets",
    dureeMs: 1400,
    delaiMs: 900,
    gain: 0.3,
    rendre(ctx, dest, t0) {
      const d = 1.4;
      const o = osc(ctx, "sawtooth", 42, t0, d);
      o.frequency.linearRampToValueAtTime(58, t0 + 0.5);
      o.frequency.linearRampToValueAtTime(52, t0 + d);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(1, t0 + 0.18);
      env.gain.setValueAtTime(1, t0 + d - 0.35);
      env.gain.linearRampToValueAtTime(0, t0 + d);
      chaine(o, passeBas(ctx, 320, 3), hachoir(ctx, 12, 0.6, t0, d), env, dest);
    },
  },

  /** Une moissonneuse : le batteur, plus vite et plus large que le moteur. */
  moissonneuse: {
    bus: "effets",
    dureeMs: 1600,
    delaiMs: 1000,
    gain: 0.24,
    rendre(ctx, dest, t0) {
      const d = 1.6;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(1, t0 + 0.25);
      env.gain.setValueAtTime(1, t0 + d - 0.4);
      env.gain.linearRampToValueAtTime(0, t0 + d);
      chaine(
        source(ctx, t0, d),
        formant(ctx, 480, 1.6),
        hachoir(ctx, 9, 0.7, t0, d),
        env,
        dest,
      );
      const o = osc(ctx, "sawtooth", 66, t0, d);
      chaine(o, passeBas(ctx, 260, 2), hachoir(ctx, 9, 0.5, t0, d), env, dest);
    },
  },

  /**
   * Une presse : le silence, puis le claquement.
   *
   * Deux temps, parce que c'est deux gestes : la chambre qui se ferme d'un
   * coup sec, la balle qui tombe une demi-seconde après.
   */
  presse: {
    bus: "effets",
    dureeMs: 700,
    delaiMs: 400,
    gain: 0.32,
    rendre(ctx, dest, t0) {
      const clac = enveloppe(ctx, t0, 0.001, 0.03, 1);
      chaine(source(ctx, t0, 0.15), formant(ctx, 1600, 6), clac, dest);
      const chute = osc(ctx, "sine", 140, t0 + 0.34, 0.3);
      chute.frequency.exponentialRampToValueAtTime(55, t0 + 0.58);
      chaine(chute, enveloppe(ctx, t0 + 0.34, 0.004, 0.08, 0.85), dest);
      const paille = enveloppe(ctx, t0 + 0.34, 0.01, 0.08, 0.35);
      chaine(source(ctx, t0 + 0.34, 0.3), passeHaut(ctx, 2000), paille, dest);
    },
  },

  /** Un semoir : une pluie de graines, fine et rapide. */
  semoir: {
    bus: "effets",
    dureeMs: 1000,
    delaiMs: 700,
    gain: 0.2,
    rendre(ctx, dest, t0) {
      const d = 1.0;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(1, t0 + 0.12);
      env.gain.setValueAtTime(1, t0 + d - 0.3);
      env.gain.linearRampToValueAtTime(0, t0 + d);
      chaine(
        source(ctx, t0, d),
        passeHaut(ctx, 2600),
        formant(ctx, 4200, 1.2),
        hachoir(ctx, 26, 0.55, t0, d),
        env,
        dest,
      );
    },
  },

  /** Une charrue : la terre qui se retourne — grave, mat, et qui se ferme. */
  charrue: {
    bus: "effets",
    dureeMs: 1300,
    delaiMs: 800,
    gain: 0.3,
    rendre(ctx, dest, t0) {
      const d = 1.3;
      const pb = passeBas(ctx, 900, 1.4);
      pb.frequency.linearRampToValueAtTime(220, t0 + d);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(1, t0 + 0.2);
      env.gain.setValueAtTime(1, t0 + d - 0.45);
      env.gain.linearRampToValueAtTime(0, t0 + d);
      chaine(source(ctx, t0, d), pb, hachoir(ctx, 5.5, 0.35, t0, d), env, dest);
    },
  },

  /** Un pulvérisateur : un jet, donc du souffle et presque pas de hauteur. */
  pulverisateur: {
    bus: "effets",
    dureeMs: 1000,
    delaiMs: 700,
    gain: 0.17,
    rendre(ctx, dest, t0) {
      const d = 1.0;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t0);
      env.gain.linearRampToValueAtTime(1, t0 + 0.14);
      env.gain.setValueAtTime(1, t0 + d - 0.35);
      env.gain.linearRampToValueAtTime(0, t0 + d);
      chaine(source(ctx, t0, d), passeHaut(ctx, 3200), formant(ctx, 6000, 0.9), env, dest);
    },
  },

  /** Une remorque qui bascule : la tôle grince, le chargement coule. */
  remorque: {
    bus: "effets",
    dureeMs: 1200,
    delaiMs: 800,
    gain: 0.24,
    rendre(ctx, dest, t0) {
      const grince = formant(ctx, 900, 14);
      grince.frequency.linearRampToValueAtTime(1500, t0 + 0.45);
      const env1 = enveloppe(ctx, t0, 0.05, 0.2, 0.7);
      chaine(source(ctx, t0, 0.6), grince, env1, dest);
      const pb = passeBas(ctx, 2200, 1);
      pb.frequency.linearRampToValueAtTime(700, t0 + 1.1);
      const env2 = enveloppe(ctx, t0 + 0.4, 0.06, 0.22, 0.6);
      chaine(source(ctx, t0 + 0.4, 0.75), passeHaut(ctx, 500), pb, env2, dest);
    },
  },

  /* --- Bâtiments --------------------------------------------------- */

  /** Un chantier de construction : trois coups de marteau sur du bois. */
  construction: {
    bus: "effets",
    dureeMs: 900,
    delaiMs: 500,
    gain: 0.3,
    rendre(ctx, dest, t0) {
      [0, 0.24, 0.46].forEach((d, i) => {
        const env = enveloppe(ctx, t0 + d, 0.001, 0.035, i === 2 ? 1 : 0.8);
        chaine(source(ctx, t0 + d, 0.2), formant(ctx, 420 + i * 40, 5), env, dest);
        const bois = enveloppe(ctx, t0 + d, 0.001, 0.02, 0.5);
        chaine(source(ctx, t0 + d, 0.12), passeHaut(ctx, 1800), bois, dest);
      });
    },
  },

  /** Une porte de grange : elle coulisse et elle grince un peu. */
  porte: {
    bus: "effets",
    dureeMs: 800,
    delaiMs: 500,
    gain: 0.2,
    rendre(ctx, dest, t0) {
      const f = formant(ctx, 350, 9);
      f.frequency.linearRampToValueAtTime(620, t0 + 0.55);
      const env = enveloppe(ctx, t0, 0.08, 0.22, 0.8);
      chaine(source(ctx, t0, 0.7), f, env, dest);
      const butee = enveloppe(ctx, t0 + 0.6, 0.002, 0.05, 0.7);
      chaine(source(ctx, t0 + 0.6, 0.2), passeBas(ctx, 500), butee, dest);
    },
  },

  /** Une livraison : la cloche du silo, et le chargement qui tombe. */
  livraison: {
    bus: "effets",
    dureeMs: 900,
    delaiMs: 600,
    gain: 0.26,
    rendre(ctx, dest, t0) {
      cloche(ctx, dest, 880, t0, 0.5, 0.7);
      cloche(ctx, dest, 1174.7, t0 + 0.13, 0.55, 0.5);
      const env = enveloppe(ctx, t0 + 0.3, 0.03, 0.12, 0.45);
      chaine(source(ctx, t0 + 0.3, 0.5), passeBas(ctx, 700), env, dest);
    },
  },

  /* --- Animaux ----------------------------------------------------- */

  /** Meuh : ça monte à peine, puis ça retombe longuement. */
  vache: {
    bus: "ambiance",
    dureeMs: 1600,
    delaiMs: 4000,
    gain: 0.55,
    rendre(ctx, dest, t0) {
      bete(ctx, dest, {
        t0,
        duree: 1.5,
        hauteurs: [112, 132, 92],
        formants: [470, 1080],
        q: [9, 11],
        clarte: 1300,
        attaque: 0.1,
        chute: 0.5,
        gain: 1,
      });
    },
  },

  /** Bêê : un trémolo rapide sur une note qui descend. */
  mouton: {
    bus: "ambiance",
    dureeMs: 1150,
    delaiMs: 4000,
    gain: 0.42,
    rendre(ctx, dest, t0) {
      const env = bete(ctx, dest, {
        t0,
        duree: 1.05,
        hauteurs: [305, 288, 238],
        formants: [880, 2100],
        q: [10, 13],
        clarte: 2000,
        attaque: 0.045,
        chute: 0.36,
        gain: 1,
      });
      // Le tremblement — dix-sept fois par seconde — est la signature. Sans
      // lui, c'est une chèvre en plastique.
      versParam(osc(ctx, "sine", 17, t0, 1.05), 0.16, env.gain);
    },
  },

  /** Groin : du souffle haché quinze fois par seconde. */
  cochon: {
    bus: "ambiance",
    dureeMs: 900,
    delaiMs: 4000,
    gain: 0.4,
    rendre(ctx, dest, t0) {
      const env = bete(ctx, dest, {
        t0,
        duree: 0.85,
        hauteurs: [152, 146, 137],
        formants: [620, 1400],
        q: [7, 9],
        clarte: 1250,
        attaque: 0.03,
        chute: 0.38,
        gain: 1,
        souffle: 0.5,
      });
      versParam(osc(ctx, "sine", 15.5, t0, 0.85), 0.5, env.gain);
    },
  },

  /**
   * Cot-cot : trois saccades, chacune un petit glissando descendant.
   *
   * C'est le rythme qui fait la poule. Une seule saccade sonne comme un
   * couinement de jouet ; trois, et l'oreille reconnaît la basse-cour.
   */
  poule: {
    bus: "ambiance",
    dureeMs: 800,
    delaiMs: 4000,
    gain: 0.3,
    rendre(ctx, dest, t0) {
      const saccades: [number, number][] = [
        [0, 0.13],
        [0.2, 0.11],
        [0.4, 0.2],
      ];
      for (const [depart, longueur] of saccades) {
        const o = osc(ctx, "sawtooth", 700, t0 + depart, longueur);
        o.frequency.linearRampToValueAtTime(440, t0 + depart + longueur);
        const f1 = formant(ctx, 1750, 14);
        const f2 = formant(ctx, 2600, 16);
        const somme = ctx.createGain();
        somme.gain.value = 0.8;
        chaine(o, f1, somme);
        const g2 = ctx.createGain();
        g2.gain.value = 0.45;
        chaine(o, f2, g2, somme);
        const env = enveloppe(ctx, t0 + depart, 0.01, 0.045, 1);
        chaine(somme, passeBas(ctx, 3200), env, dest);
      }
    },
  },
};

/** Pour les tests : le catalogue est-il cohérent avec ses bus ? */
export const SONS_AMBIANCE: SonId[] = (Object.keys(CATALOGUE) as SonId[]).filter(
  (k) => CATALOGUE[k].bus === "ambiance",
);
