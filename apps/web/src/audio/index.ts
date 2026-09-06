/**
 * Le moteur audio : un seul contexte, trois bus, un portier.
 *
 * ## La règle qui gouverne tout
 *
 * Rien ne sort sans passer par ici. Ni un composant qui appellerait
 * `new Audio()` dans son coin, ni un effet qui jouerait deux fois. C'est ce
 * qui permet de tenir la promesse faite au joueur : les curseurs du menu
 * règlent *vraiment* tout, et aucun événement ne peut transformer la ferme
 * en brouhaha.
 *
 * ## Le démarrage différé
 *
 * Un navigateur refuse de faire du bruit avant que le joueur ait cliqué
 * quelque part — et il a raison. Le contexte se crée donc au premier geste,
 * pas au chargement. Avant ce geste, tous les appels ici sont sans effet et
 * sans erreur : le jeu ne doit jamais dépendre du son pour fonctionner.
 *
 * ## L'onglet caché
 *
 * Un onglet en arrière-plan ne joue rien. Sans cela, revenir sur le jeu
 * après une heure déclencherait d'un coup tout ce qui s'est accumulé, et
 * la première impression serait un vacarme.
 */

import {
  gainDuBus,
  readAudioPrefs,
  writeAudioPrefs,
  type AudioPrefs,
  type Bus,
} from "./prefs";
import { Portier } from "./portier";
import { CATALOGUE, type SonId } from "./voix";
import { Musique, type SaisonMusicale } from "./musique";

export {
  DEFAULT_AUDIO,
  gainDuBus,
  parseAudioPrefs,
  readAudioPrefs,
  writeAudioPrefs,
  type AudioPrefs,
  type Bus,
} from "./prefs";
export { Portier, VOIX_MAX, RAFALE_MAX } from "./portier";
export { CATALOGUE, SONS_AMBIANCE, type SonId } from "./voix";
export {
  SAISONS,
  composerMesure,
  basseAudible,
  dureeMesure,
  hz,
  recalerMesure,
  tirage,
  FONDU_S,
  type Note,
  type SaisonMusicale,
} from "./musique";

type Moteur = {
  ctx: AudioContext;
  bus: Record<Bus, GainNode>;
  musique: Musique;
};

let moteur: Moteur | null = null;
let prefs: AudioPrefs = readAudioPrefs();
const portier = new Portier();

/** L'ambiance ne joue que si l'onglet est devant. */
function ongletVisible(): boolean {
  try {
    return typeof document === "undefined" || document.visibilityState !== "hidden";
  } catch {
    return true;
  }
}

function creer(): Moteur | null {
  if (moteur) return moteur;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();

    /**
     * Un limiteur en bout de chaîne.
     *
     * Le portier borne le nombre de sons, pas leur somme : quatre effets qui
     * tombent ensemble peuvent encore saturer. Le compresseur rattrape ce
     * cas au lieu de le laisser craquer dans le haut-parleur.
     */
    const limiteur = ctx.createDynamicsCompressor();
    limiteur.threshold.value = -10;
    limiteur.knee.value = 6;
    limiteur.ratio.value = 8;
    limiteur.attack.value = 0.004;
    limiteur.release.value = 0.18;
    limiteur.connect(ctx.destination);

    const bus = {
      musique: ctx.createGain(),
      effets: ctx.createGain(),
      ambiance: ctx.createGain(),
    } as Record<Bus, GainNode>;
    for (const k of Object.keys(bus) as Bus[]) {
      bus[k].gain.value = gainDuBus(prefs, k);
      bus[k].connect(limiteur);
    }

    moteur = { ctx, bus, musique: new Musique(ctx, bus.musique) };
    return moteur;
  } catch {
    // Pas de Web Audio : le jeu se joue en silence, et c'est tout.
    return null;
  }
}

/**
 * À appeler au premier geste du joueur.
 *
 * Le navigateur suspend le contexte créé sans interaction ; il faut donc le
 * réveiller, et pas seulement le créer.
 */
export function reveillerAudio(): void {
  const m = creer();
  if (!m) return;
  if (m.ctx.state === "suspended") void m.ctx.resume().catch(() => undefined);
}

/** Les préférences courantes, telles que le moteur les applique. */
export function prefsAudio(): AudioPrefs {
  return prefs;
}

/** Change un réglage, l'écrit, et l'applique tout de suite. */
export function reglerAudio(next: Partial<AudioPrefs>): AudioPrefs {
  prefs = writeAudioPrefs(next);
  const m = moteur;
  if (m) {
    const t = m.ctx.currentTime;
    for (const k of Object.keys(m.bus) as Bus[]) {
      const g = m.bus[k].gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      // Un quart de seconde de rampe : un volume qui saute claque.
      g.linearRampToValueAtTime(gainDuBus(prefs, k), t + 0.25);
    }
    // La musique se relance si elle redevient audible : sinon, remonter le
    // curseur ne donnerait rien jusqu'au prochain changement de saison.
    if (gainDuBus(prefs, "musique") > 0 && derniereSaison) saisonAudio(derniereSaison);
    else if (gainDuBus(prefs, "musique") <= 0) m.musique.arreter();
  }
  return prefs;
}

/**
 * Joue un son — si le portier le permet.
 *
 * Ne lève jamais : un bruit raté ne doit pas casser un geste de jeu.
 */
export function jouerSon(id: SonId): void {
  const def = CATALOGUE[id];
  if (!def) return;
  if (gainDuBus(prefs, def.bus) <= 0) return;
  if (def.bus === "ambiance" && !ongletVisible()) return;

  const m = moteur;
  if (!m || m.ctx.state !== "running") return;
  if (
    !portier.autorise({
      cle: id,
      bus: def.bus,
      maintenant: Date.now(),
      dureeMs: def.dureeMs,
      delaiMs: def.delaiMs,
    })
  ) {
    return;
  }

  try {
    const g = m.ctx.createGain();
    g.gain.value = def.gain;
    g.connect(m.bus[def.bus]);
    def.rendre(m.ctx, g, m.ctx.currentTime + 0.005);
    // Le sous-graphe se débranche tout seul : sans ça, une longue partie
    // accumulerait des milliers de nœuds morts.
    setTimeout(() => {
      try {
        g.disconnect();
      } catch {
        /* déjà parti */
      }
    }, def.dureeMs + 2500);
  } catch {
    /* le geste de jeu continue sans son */
  }
}

/**
 * La saison courante, donnée au moteur.
 *
 * Idempotent : l'écran recalcule la saison chaque minute et peut appeler
 * ceci autant qu'il veut. Le fondu ne part qu'au vrai changement.
 */
export function saisonAudio(s: SaisonMusicale): void {
  derniereSaison = s;
  const m = moteur;
  if (!m || m.ctx.state !== "running") return;
  if (prefs.muted || prefs.volume <= 0 || prefs.musique <= 0) return;
  m.musique.saisonDevient(s);
}

/**
 * La dernière saison annoncée, même si la musique était coupée à ce
 * moment-là. Sans elle, remonter le curseur « Musique » ne relancerait rien
 * avant le prochain changement de saison — dix heures de jeu plus tard.
 */
let derniereSaison: SaisonMusicale | null = null;

/* ------------------------------------------------------------------ */
/* L'ambiance                                                          */
/* ------------------------------------------------------------------ */

let minuteurAmbiance: ReturnType<typeof setTimeout> | null = null;
let cheptel: SonId[] = [];

/**
 * Les bêtes présentes sur la ferme, et rien d'autre.
 *
 * On n'entend que ce qu'on possède : une poule sur une exploitation sans
 * volaille est un mensonge, et un mensonge sonore décrédibilise tout le
 * reste du décor.
 */
export function reglerCheptel(especes: SonId[]): void {
  cheptel = especes.filter((e) => CATALOGUE[e]?.bus === "ambiance");
  if (cheptel.length === 0) {
    if (minuteurAmbiance) clearTimeout(minuteurAmbiance);
    minuteurAmbiance = null;
    return;
  }
  if (!minuteurAmbiance) programmerBete();
}

/**
 * Une bête, de temps en temps, et jamais deux d'affilée.
 *
 * Entre vingt-cinq et soixante-dix secondes. C'est long — volontairement.
 * Une vache qui meugle toutes les cinq secondes devient insupportable en
 * deux minutes, et le joueur coupe alors *tout* le son, musique comprise.
 * Le silence est ce qui rend le meuglement agréable quand il arrive.
 */
function programmerBete(): void {
  const attente = 25_000 + Math.random() * 45_000;
  minuteurAmbiance = setTimeout(() => {
    if (cheptel.length && ongletVisible()) {
      jouerSon(cheptel[Math.floor(Math.random() * cheptel.length)]!);
    }
    if (cheptel.length) programmerBete();
    else minuteurAmbiance = null;
  }, attente);
}

/* ------------------------------------------------------------------ */
/* Compatibilité                                                       */
/* ------------------------------------------------------------------ */

/**
 * L'ancien appel, conservé.
 *
 * Une poignée d'endroits du jeu l'utilisent déjà ; les réécrire tous d'un
 * coup n'apporterait rien, et casserait des tests qui vérifient autre chose.
 */
export function playUiSound(kind: "click" | "place"): void {
  jouerSon(kind === "click" ? "clic" : "pose");
}
