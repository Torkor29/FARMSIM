/**
 * Menu du joueur — compte, son, aide, déconnexion.
 *
 * L'ancien tiroir empilait une fiche (niveau, trésorerie, badge développeur)
 * et trois gros boutons. L'argent est déjà dans le bandeau ; ici on range
 * les **réglages**, avec une croix pour partir et des pages pour changer
 * le pseudo, l'e-mail, le code d'accès, et le son.
 */

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { jouerSon, prefsAudio, reglerAudio, type AudioPrefs } from "./audio";
import {
  qualityChoice,
  qualityDowngraded,
  setQualityChoice,
  type QualityChoice,
} from "./render-quality";
import { MenuClose } from "./ui/MenuClose";

export type ProfilePlayer = {
  displayName: string;
  email?: string;
  level: number;
  xp: number;
  bonuses?: {
    storageGrain: number;
    yieldBonus: number;
  };
  unlimitedCrd?: boolean;
  dev?: boolean;
};

export type AccountPatch = {
  displayName?: string;
  email?: string;
  accessCode?: string;
  currentAccessCode?: string;
};

type Page = "home" | "account" | "sound" | "graphics";

type Notifications = {
  state: NotificationPermission | "unsupported";
  ask: () => void | Promise<void>;
};

type Gesture = {
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp?: (e: ReactPointerEvent<HTMLElement>) => void;
};

type Props = {
  className?: string;
  gesture?: Gesture;
  player: ProfilePlayer;
  notifications: Notifications;
  /** Fenêtre bureau : le cadre porte déjà la croix et le titre. */
  embedded?: boolean;
  onClose: () => void;
  onGuide: () => void;
  onTutorial: () => void;
  onLogout: () => void;
  onPatchAccount: (body: AccountPatch) => Promise<ProfilePlayer>;
  onFlash: (text: string, isError?: boolean | "warn") => void;
  /**
   * La qualité vient de changer : la scène doit se remonter pour en tenir
   * compte. Les réglages du rendu — ombres, anticrénelage, densité de pixels —
   * sont lus à la création du contexte WebGL et n'y reviennent plus ; sans ce
   * signal, le joueur choisirait « Élevée » et ne verrait rien bouger.
   */
  onQualityChange?: () => void;
};

function initial(name: string): string {
  const t = name.trim();
  return t ? t.slice(0, 1).toUpperCase() : "?";
}

export function ProfilePanel({
  className,
  gesture,
  player,
  notifications,
  embedded = false,
  onClose,
  onGuide,
  onTutorial,
  onLogout,
  onPatchAccount,
  onFlash,
  onQualityChange,
}: Props) {
  const [page, setPage] = useState<Page>("home");

  return (
    <aside className={className} {...gesture}>
      {page === "home" ? (
        <Home
          player={player}
          notifications={notifications}
          embedded={embedded}
          onClose={onClose}
          onOpen={setPage}
          onGuide={onGuide}
          onTutorial={onTutorial}
          onLogout={onLogout}
        />
      ) : page === "account" ? (
        <AccountPage
          player={player}
          embedded={embedded}
          onBack={() => setPage("home")}
          onClose={onClose}
          onPatchAccount={onPatchAccount}
          onFlash={onFlash}
        />
      ) : page === "sound" ? (
        <SoundPage embedded={embedded} onBack={() => setPage("home")} onClose={onClose} />
      ) : (
        <GraphicsPage
          embedded={embedded}
          onBack={() => setPage("home")}
          onClose={onClose}
          onChange={onQualityChange}
        />
      )}
    </aside>
  );
}

function Home({
  player,
  notifications,
  embedded,
  onClose,
  onOpen,
  onGuide,
  onTutorial,
  onLogout,
}: {
  player: ProfilePlayer;
  notifications: Notifications;
  embedded: boolean;
  onClose: () => void;
  onOpen: (p: Page) => void;
  onGuide: () => void;
  onTutorial: () => void;
  onLogout: () => void;
}) {
  const bonus = player.bonuses;
  const alertLine =
    notifications.state === "granted"
      ? "Activées"
      : notifications.state === "denied"
        ? "Refusées dans le navigateur"
        : notifications.state === "unsupported"
          ? "Indisponibles ici"
          : "Désactivées";

  return (
    <>
      <header className="profile-head">
        <div className="profile-ident">
          <span className="profile-avatar" aria-hidden="true">
            {initial(player.displayName)}
          </span>
          <div>
            <h3>{player.displayName}</h3>
            <p>Nv.{player.level}</p>
          </div>
        </div>
        {!embedded && <MenuClose onClose={onClose} />}
      </header>

      <ul className="profile-meta">
        <li>{player.xp} XP</li>
        {bonus && (
          <li>
            grain {bonus.storageGrain} t · +{Math.round(bonus.yieldBonus * 100)} % rendement
          </li>
        )}
        {(player.dev || player.unlimitedCrd) && <li className="dev">Compte développeur</li>}
      </ul>

      <nav className="profile-groups" aria-label="Réglages">
        <div className="profile-group">
          <button type="button" className="profile-row" onClick={() => onOpen("account")}>
            <span>
              <strong>Compte</strong>
              <em>Pseudo, e-mail, code d’accès</em>
            </span>
            <i aria-hidden="true">›</i>
          </button>
          <button type="button" className="profile-row" onClick={() => onOpen("sound")}>
            <span>
              <strong>Son</strong>
              <em>Musique, effets, ambiance</em>
            </span>
            <i aria-hidden="true">›</i>
          </button>
          <button type="button" className="profile-row" onClick={() => onOpen("graphics")}>
            <span>
              <strong>Qualité graphique</strong>
              <em>Ombres, fluidité, effets de chantier</em>
            </span>
            <i aria-hidden="true">›</i>
          </button>
          {notifications.state === "default" ? (
            <button type="button" className="profile-row" onClick={() => void notifications.ask()}>
              <span>
                <strong>Alertes</strong>
                <em>M’alerter si la ferme va mal</em>
              </span>
              <i aria-hidden="true">›</i>
            </button>
          ) : (
            <div className="profile-row static">
              <span>
                <strong>Alertes</strong>
                <em>{alertLine}</em>
              </span>
            </div>
          )}
        </div>

        <div className="profile-group">
          <button type="button" className="profile-row" onClick={onGuide}>
            <span>
              <strong>Guide de ferme</strong>
              <em>Cultures, sol, métier</em>
            </span>
            <i aria-hidden="true">›</i>
          </button>
          <button type="button" className="profile-row" onClick={onTutorial}>
            <span>
              <strong>Revoir le tutoriel</strong>
              <em>Les gestes de départ</em>
            </span>
            <i aria-hidden="true">›</i>
          </button>
        </div>
      </nav>

      <button type="button" className="profile-logout" onClick={onLogout}>
        Se déconnecter
      </button>
    </>
  );
}

function SubHead({
  title,
  embedded,
  onBack,
  onClose,
}: {
  title: string;
  embedded: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <header className="profile-head sub">
      <button type="button" className="profile-back" onClick={onBack} aria-label="Retour">
        ‹
      </button>
      <h3>{title}</h3>
      {!embedded && <MenuClose onClose={onClose} />}
    </header>
  );
}

function AccountPage({
  player,
  embedded,
  onBack,
  onClose,
  onPatchAccount,
  onFlash,
}: {
  player: ProfilePlayer;
  embedded: boolean;
  onBack: () => void;
  onClose: () => void;
  onPatchAccount: (body: AccountPatch) => Promise<ProfilePlayer>;
  onFlash: (text: string, isError?: boolean | "warn") => void;
}) {
  const [displayName, setDisplayName] = useState(player.displayName);
  const [email, setEmail] = useState(player.email ?? "");
  const [currentAccessCode, setCurrent] = useState("");
  const [accessCode, setAccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDisplayName(player.displayName);
    setEmail(player.email ?? "");
  }, [player.displayName, player.email]);

  const nameDirty = displayName.trim() !== player.displayName;
  const emailDirty = email.trim() !== (player.email ?? "");
  const codeDirty = accessCode.length > 0;
  const needsCurrent = emailDirty || codeDirty;
  const canSave =
    !busy &&
    (nameDirty || emailDirty || codeDirty) &&
    displayName.trim().length >= 2 &&
    email.includes("@") &&
    (!codeDirty || accessCode.length >= 3) &&
    (!needsCurrent || currentAccessCode.length >= 1);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      const body: AccountPatch = {};
      if (nameDirty) body.displayName = displayName.trim();
      if (emailDirty) body.email = email.trim();
      if (codeDirty) body.accessCode = accessCode;
      if (needsCurrent) body.currentAccessCode = currentAccessCode;
      await onPatchAccount(body);
      setCurrent("");
      setAccess("");
      onFlash("Compte mis à jour");
      onBack();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SubHead title="Compte" embedded={embedded} onBack={onBack} onClose={onClose} />
      <p className="profile-hint">
        L’e-mail est votre identifiant de connexion. Le code d’accès ouvre la ferme — ce n’est pas
        l’identifiant technique du serveur, et il n’y a pas à le changer.
      </p>
      <form
        className="profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Pseudo
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            autoComplete="nickname"
          />
        </label>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          Nouveau code d’accès
          <input
            type="password"
            value={accessCode}
            onChange={(e) => setAccess(e.target.value)}
            minLength={3}
            maxLength={32}
            autoComplete="new-password"
            placeholder="Laisser vide pour ne pas changer"
          />
        </label>
        {needsCurrent && (
          <label>
            Code actuel
            <input
              type="password"
              value={currentAccessCode}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              placeholder="Pour confirmer e-mail ou code"
            />
          </label>
        )}
        <button type="submit" className="accent" disabled={!canSave}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </>
  );
}

const QUALITES: { valeur: QualityChoice; nom: string; quoi: string }[] = [
  {
    valeur: "auto",
    nom: "Automatique",
    quoi: "Le jeu allège le rendu s’il voit des images trop lentes",
  },
  {
    valeur: "full",
    nom: "Élevée",
    quoi: "Ombres, anticrénelage, fluidité sans bride",
  },
  {
    valeur: "reduced",
    nom: "Sobre",
    quoi: "Pour un appareil modeste : 30 images/s, sans ombres",
  },
];

/**
 * Le rendu, décidé par le joueur.
 *
 * L'observation automatique était seule à décider, et sans retour possible :
 * une minute de lenteur — un serveur qui rame, un onglet en arrière-plan — et
 * la partie se terminait en mode sobre, sans que rien ne le dise. Signalé en
 * jouant comme une régression du jeu : « il n'y a plus d'animation douce
 * quand il tourne ni les petits trucs de terre ».
 *
 * Le choix est retenu d'une partie à l'autre, et il l'emporte sur
 * l'observation — y compris sur la détection des rasteriseurs logiciels :
 * c'est sa machine, il a le droit de l'essayer.
 */
function GraphicsPage({
  embedded,
  onBack,
  onClose,
  onChange,
}: {
  embedded: boolean;
  onBack: () => void;
  onClose: () => void;
  onChange?: () => void;
}) {
  const [choix, setChoix] = useState<QualityChoice>(() => qualityChoice());
  const [allege] = useState(() => qualityDowngraded());

  function choisir(valeur: QualityChoice) {
    setQualityChoice(valeur);
    setChoix(valeur);
    onChange?.();
  }

  return (
    <>
      <SubHead title="Qualité graphique" embedded={embedded} onBack={onBack} onClose={onClose} />
      <p className="profile-hint">
        Les effets de chantier — la terre projetée derrière la charrue, le grain qui saute au
        battage — restent affichés dans tous les cas. Ce réglage ne touche qu’à ce qui coûte
        vraiment : les ombres, le lissage des bords et la fluidité.
      </p>
      <div className="profile-choices" role="radiogroup" aria-label="Qualité graphique">
        {QUALITES.map((q) => (
          <button
            key={q.valeur}
            type="button"
            role="radio"
            aria-checked={choix === q.valeur}
            className={`profile-choice${choix === q.valeur ? " on" : ""}`}
            onClick={() => choisir(q.valeur)}
          >
            <strong>{q.nom}</strong>
            <em>{q.quoi}</em>
          </button>
        ))}
      </div>
      {choix === "auto" && allege && (
        <p className="profile-hint warn">
          Le rendu a été allégé tout seul pendant cette partie. Si l’image te paraît moins belle
          qu’avant, c’est de là que ça vient : choisis « Élevée » pour le forcer.
        </p>
      )}
    </>
  );
}

function SoundPage({
  embedded,
  onBack,
  onClose,
}: {
  embedded: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState<AudioPrefs>(() => prefsAudio());

  /**
   * Régler, c'est entendre le réglage.
   *
   * `reglerAudio` applique le volume au moteur en cours de route, sans
   * coupure : le joueur bouge le curseur et entend le résultat tout de
   * suite, au lieu de deviner puis de vérifier plus tard.
   */
  function set(next: Partial<AudioPrefs>) {
    setPrefs(reglerAudio(next));
    // Un repère à l'oreille pour les deux curseurs qu'on ne peut pas juger
    // en silence. La musique, elle, s'entend d'elle-même.
    if (next.effets !== undefined || next.volume !== undefined) jouerSon("clic");
    if (next.ambiance !== undefined) jouerSon("poule");
  }

  return (
    <>
      <SubHead title="Son" embedded={embedded} onBack={onBack} onClose={onClose} />
      <p className="profile-hint">
        Trois réglages plutôt qu’un, parce que trois choses très différentes sortent du même
        haut-parleur. L’ambiance — les bêtes, au loin — part volontairement basse&nbsp;: elle est
        là pour qu’une ferme ne soit pas muette, pas pour qu’on l’écoute.
      </p>
      <div className="profile-form">
        <label className="profile-switch">
          <span>Son</span>
          <input
            type="checkbox"
            checked={!prefs.muted}
            onChange={(e) => set({ muted: !e.target.checked })}
          />
        </label>
        <label>
          Volume général
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs.volume * 100)}
            disabled={prefs.muted}
            onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
          />
        </label>
        <label>
          Musique
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs.musique * 100)}
            disabled={prefs.muted}
            onChange={(e) => set({ musique: Number(e.target.value) / 100 })}
          />
        </label>
        <label>
          Effets
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs.effets * 100)}
            disabled={prefs.muted}
            onChange={(e) => set({ effets: Number(e.target.value) / 100 })}
          />
        </label>
        <label>
          Ambiance
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(prefs.ambiance * 100)}
            disabled={prefs.muted}
            onChange={(e) => set({ ambiance: Number(e.target.value) / 100 })}
          />
        </label>
      </div>
      <p className="profile-hint">
        La musique change avec la saison, et les deux se croisent en fondu plutôt que de se couper
        net. Elle ne se répète jamais&nbsp;: chaque mesure est composée au moment de la jouer.
      </p>
    </>
  );
}
