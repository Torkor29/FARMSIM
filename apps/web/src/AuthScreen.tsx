import { useState } from "react";

import {
  MDP_AIDE,
  MDP_MAX,
  MDP_MIN,
  RECOVERY_HELP,
  formatRecovery,
  isRecoveryCode,
  motDePasseValide,
} from "@farmsim/shared";

/**
 * Les cinq états de la porte d'entrée.
 *
 * `recover` et `forgot` répondent à la même question — « j'ai oublié mon mot
 * de passe » — par deux moyens qui ne se remplacent pas. Le code de secours
 * fonctionne sans réseau de messagerie et sans que le joueur ait accès à sa
 * boîte ; le lien par courriel ne demande rien à conserver. On garde les deux
 * parce qu'ils tombent en panne pour des raisons différentes : un papier se
 * perd, une boîte se ferme.
 *
 * `reset` n'est jamais choisi par le joueur : c'est l'état dans lequel
 * l'adresse du lien met l'écran.
 */
export type AuthMode = "register" | "login" | "recover" | "forgot" | "reset";

type Props = {
  authMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
  name: string;
  onNameChange: (name: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  accessCode: string;
  onAccessCodeChange: (code: string) => void;
  recoveryInput: string;
  onRecoveryInputChange: (code: string) => void;
  busy: boolean;
  msg: string | null;
  err: string | null;
  onRegister: () => void;
  onLogin: () => void;
  onRecover: () => void;
  /**
   * Le serveur sait-il envoyer du courrier ?
   *
   * Posé par le serveur, jamais supposé. Offrir le lien sur une instance sans
   * SMTP promettrait « un secours qui n'arrivera jamais » — l'expression est
   * de `recovery.ts`, qui refusait déjà ce bouton pour cette raison.
   */
  courrielDisponible?: boolean;
  /** Demander un lien de réinitialisation. */
  onForgot: () => void;
  /** Poser le nouveau mot de passe, depuis le lien reçu. */
  onReset: () => void;
};

/**
 * Première page du jeu : rien d'autre que se connecter ou créer un compte.
 * Le choix du métier et de la terre arrive ensuite, dans l'installation guidée.
 */
export function AuthScreen({
  authMode,
  onAuthModeChange,
  name,
  onNameChange,
  email,
  onEmailChange,
  accessCode,
  onAccessCodeChange,
  recoveryInput,
  onRecoveryInputChange,
  busy,
  msg,
  err,
  onRegister,
  onLogin,
  onRecover,
  courrielDisponible = false,
  onForgot,
  onReset,
}: Props) {
  const [showCode, setShowCode] = useState(false);
  const isRegister = authMode === "register";
  const isRecover = authMode === "recover";
  const isForgot = authMode === "forgot";
  const isReset = authMode === "reset";
  /** Les trois écrans où l'on **pose** un mot de passe neuf. */
  const posePassword = isRegister || isRecover || isReset;
  // Le plancher ne vaut qu'aux endroits où l'on *pose* un mot de passe. La
  // connexion accepte ce qui existe : les comptes d'avant en ont de plus
  // courts, et griser leur bouton les enfermerait dehors sans un mot
  // d'explication.
  const canSubmit = isReset
    ? motDePasseValide(accessCode)
    : isForgot
      ? email.includes("@")
      : isRecover
        ? email.includes("@") && isRecoveryCode(recoveryInput) && motDePasseValide(accessCode)
        : isRegister
          ? name.trim().length >= 2 && email.includes("@") && motDePasseValide(accessCode)
          : email.includes("@") && accessCode.length >= 1;

  function submit() {
    if (!canSubmit || busy) return;
    if (isReset) onReset();
    else if (isForgot) onForgot();
    else if (isRecover) onRecover();
    else if (isRegister) onRegister();
    else onLogin();
  }

  return (
    <div className="gate">
      <div className="gate-sky" aria-hidden="true">
        <span className="gate-sun" />
        <span className="gate-cloud c1" />
        <span className="gate-cloud c2" />
        <span className="gate-cloud c3" />
        <span className="gate-hill h1" />
        <span className="gate-hill h2" />
        <span className="gate-field" />
      </div>

      <main className="gate-inner">
        <img className="gate-logo" src="/logo.webp" alt="Farming Navigator" />

        <div className="gate-card">
          {/* Les onglets disparaissent sur les écrans de dépannage : ils
              n'offrent aucun des deux chemins qu'on est en train de suivre, et
              un clic dessus ferait perdre le lien qu'on vient d'ouvrir. */}
          <div
            className="gate-tabs"
            role="tablist"
            aria-label="Accès au jeu"
            hidden={isRecover || isForgot || isReset}
          >
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={`gate-tab ${isRegister ? "active" : ""}`}
              onClick={() => onAuthModeChange("register")}
            >
              Je débute
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={`gate-tab ${!isRegister ? "active" : ""}`}
              onClick={() => onAuthModeChange("login")}
            >
              J'ai un compte
            </button>
          </div>

          {isRecover && (
            <p className="gate-note">
              <strong>Avec votre code de secours.</strong> C'est le code remis à la création
              de votre ferme, sur un bout de papier ou dans vos notes. Vous choisissez un
              nouveau mot de passe dans la foulée, et un code neuf vous est remis.
            </p>
          )}

          {isForgot && (
            <p className="gate-note">
              {/*
                La phrase dit ce qui arrive **et** ce qui n'arrivera pas. « Nous
                ne pouvons pas vous renvoyer votre mot de passe » a l'air d'un
                aveu de faiblesse ; c'est l'inverse, et le dire évite qu'on
                cherche dans le message un mot de passe qui n'y sera jamais.
              */}
              <strong>Par e-mail.</strong> Nous vous envoyons un lien pour choisir un nouveau
              mot de passe. Nous ne pouvons pas vous renvoyer l'ancien : le serveur ne le
              détient pas, il n'en garde qu'une empreinte illisible.
            </p>
          )}

          {isReset && (
            <p className="gate-note">
              <strong>Nouveau mot de passe.</strong> Vous êtes arrivé par le lien reçu par
              e-mail. Choisissez votre mot de passe : il remplace l'ancien tout de suite, et
              toutes les sessions ouvertes ailleurs sont fermées.
            </p>
          )}

          <form
            className="gate-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {isRegister && (
              <label className="field">
                <span className="field-label">Votre nom d'exploitant</span>
                <input
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Jean Terroir"
                  autoComplete="nickname"
                  maxLength={32}
                />
              </label>
            )}

            {/* En mode « reset », l'adresse ne sert à rien : le jeton dit déjà
                de quel compte il s'agit. La demander inviterait à se tromper,
                et laisserait croire qu'elle est vérifiée. */}
            <label className="field" hidden={isReset}>
              <span className="field-label">Adresse e-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="vous@exemple.fr"
                autoComplete="email"
              />
            </label>

            {isRecover && (
              <label className="field">
                <span className="field-label">Code de secours</span>
                <input
                  className="mono"
                  value={recoveryInput}
                  onChange={(e) => onRecoveryInputChange(e.target.value)}
                  placeholder="A1B2-C3D4-E5F6-G7H8"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  maxLength={32}
                />
                <span className="field-help">
                  Les tirets, les espaces et les minuscules sont sans importance.
                </span>
              </label>
            )}

            <label className="field" hidden={isForgot}>
              <span className="field-label">
                {isRecover || isReset
                  ? "Nouveau mot de passe"
                  : isRegister
                    ? "Choisissez un mot de passe"
                    : "Mot de passe"}
              </span>
              <span className="field-row">
                <input
                  type={showCode ? "text" : "password"}
                  value={accessCode}
                  onChange={(e) => onAccessCodeChange(e.target.value)}
                  placeholder={
                    posePassword ? `au moins ${MDP_MIN} caractères` : "votre mot de passe"
                  }
                  autoComplete={posePassword ? "new-password" : "current-password"}
                  minLength={posePassword ? MDP_MIN : undefined}
                  maxLength={MDP_MAX}
                />
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => setShowCode((v) => !v)}
                  aria-label={showCode ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showCode ? "Masquer" : "Voir"}
                </button>
              </span>
              {posePassword && <span className="field-help">{MDP_AIDE}</span>}
            </label>

            {(msg || err) && (
              <p className={`gate-alert ${err ? "bad" : "good"}`} role="status">
                {err ?? msg}
              </p>
            )}

            <button type="submit" className="btn-primary big" disabled={busy || !canSubmit}>
              {busy
                ? "Un instant…"
                : isForgot
                  ? "Recevoir le lien"
                  : isRecover || isReset
                    ? "Changer mon mot de passe"
                    : isRegister
                      ? "Créer ma ferme"
                      : "Reprendre ma ferme"}
            </button>
          </form>

          {!isRegister && (
            <p className="gate-forgot">
              {isRecover || isForgot || isReset ? (
                <>
                  {/*
                    Les deux voies se renvoient l'une à l'autre, parce qu'elles
                    tombent en panne pour des raisons différentes : le papier
                    se perd, la boîte se ferme. Celui qui échoue d'un côté doit
                    trouver l'autre sans repasser par la connexion.
                  */}
                  {isRecover && courrielDisponible && (
                    <button
                      type="button"
                      className="link"
                      onClick={() => onAuthModeChange("forgot")}
                    >
                      Recevoir plutôt un lien par e-mail
                    </button>
                  )}
                  {isForgot && (
                    <button
                      type="button"
                      className="link"
                      onClick={() => onAuthModeChange("recover")}
                    >
                      J'ai mon code de secours
                    </button>
                  )}
                  <button type="button" className="link" onClick={() => onAuthModeChange("login")}>
                    Revenir à la connexion
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="link"
                  /* Le lien par e-mail d'abord quand il existe : il ne demande
                     rien à avoir conservé. Le code de secours reste à un clic. */
                  onClick={() => onAuthModeChange(courrielDisponible ? "forgot" : "recover")}
                >
                  Mot de passe oublié ?
                </button>
              )}
            </p>
          )}

          <p className="gate-switch" hidden={isRecover || isForgot || isReset}>
            {isRegister ? (
              <>
                Déjà installé ?{" "}
                <button type="button" className="link" onClick={() => onAuthModeChange("login")}>
                  Se connecter
                </button>
              </>
            ) : (
              <>
                Première visite ?{" "}
                <button type="button" className="link" onClick={() => onAuthModeChange("register")}>
                  Créer un compte
                </button>
              </>
            )}
          </p>
        </div>

        <ul className="gate-pitch">
          <li>
            <strong>6 continents</strong>
            <span>Climats réels, saisons inversées</span>
          </li>
          <li>
            <strong>2 métiers</strong>
            <span>Céréalier ou éleveur — aidez les voisins pour gagner un peu</span>
          </li>
          <li>
            <strong>Marché vivant</strong>
            <span>Les cours bougent en continu</span>
          </li>
        </ul>
      </main>
    </div>
  );
}

/**
 * Le code de secours, remis une seule fois.
 *
 * Il barre l'écran et ne se ferme que par un bouton explicite. Un bandeau
 * discret serait balayé d'un clic distrait, et ce code-là ne se redemande
 * pas : le serveur n'en garde qu'une empreinte. Un joueur qui le rate perd
 * son unique filet.
 */
export function RecoveryNotice({ code, onClose }: { code: string; onClose: () => void }) {
  const [copie, setCopie] = useState(false);
  const lisible = formatRecovery(code);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lisible);
      setCopie(true);
    } catch {
      // Presse-papiers refusé (page non sécurisée, permission) : le code
      // reste affiché en gros, il est recopiable à la main. Rien à signaler.
      setCopie(false);
    }
  }

  return (
    <div className="recovery-veil" role="dialog" aria-modal="true" aria-label="Code de secours">
      <div className="recovery-card">
        <h2>Votre code de secours</h2>
        <p className="recovery-why">{RECOVERY_HELP}</p>
        <p className="recovery-code mono">{lisible}</p>
        <div className="recovery-actions">
          <button type="button" className="btn-ghost" onClick={copier}>
            {copie ? "Copié" : "Copier"}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Je l'ai noté
          </button>
        </div>
      </div>
    </div>
  );
}
