import {
  SPECIALIZATION_LABELS,
  type Specialization,
} from "@farmsim/shared";
import { ZoneMap } from "./ZoneMap";

type Zone = {
  id: string;
  code: string;
  name: string;
  koppen: string;
  mapW: number;
  mapH: number;
  parcels: {
    id: string;
    label: string;
    mapX: number;
    mapY: number;
    landPrice: number;
    farmId?: string | null;
    gridW: number;
    gridH: number;
    fertility?: number;
    zone?: { code: string; name: string; koppen: string };
  }[];
};

type FreeParcel = Zone["parcels"][number] & {
  zone?: { code: string; name: string; koppen: string };
};

type Props = {
  authMode: "register" | "login";
  onAuthModeChange: (mode: "register" | "login") => void;
  spe: Specialization;
  onSpeChange: (spe: Specialization) => void;
  name: string;
  onNameChange: (name: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  accessCode: string;
  onAccessCodeChange: (code: string) => void;
  selectedParcelId: string | null;
  onSelectParcel: (id: string | null) => void;
  zones: Zone[];
  selectedFree?: FreeParcel;
  busy: boolean;
  msg: string | null;
  err: string | null;
  onRegister: () => void;
  onLogin: () => void;
};

export function AuthScreen({
  authMode,
  onAuthModeChange,
  spe,
  onSpeChange,
  name,
  onNameChange,
  email,
  onEmailChange,
  accessCode,
  onAccessCodeChange,
  selectedParcelId,
  onSelectParcel,
  zones,
  selectedFree,
  busy,
  msg,
  err,
  onRegister,
  onLogin,
}: Props) {
  return (
    <div className="auth-screen">
      <header className="auth-header">
        <img className="auth-logo" src="/logo.svg" alt="" width={120} height={120} />
        <h1 className="auth-brand">Farming Navigateur</h1>
        <p className="auth-lede">Élevage · Cultivation · Gestion</p>
        <p className="auth-lede auth-lede-sub">Créez votre compte ou connectez-vous pour jouer</p>
      </header>

      {(msg || err) && (
        <p className={`auth-alert ${err ? "error" : "ok"}`}>{err ?? msg}</p>
      )}

      <div className="auth-card">
        <div className="auth-tabs" role="tablist" aria-label="Authentification">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "register"}
            className={`auth-tab ${authMode === "register" ? "active" : ""}`}
            onClick={() => onAuthModeChange("register")}
          >
            Créer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "login"}
            className={`auth-tab ${authMode === "login" ? "active" : ""}`}
            onClick={() => onAuthModeChange("login")}
          >
            Connexion
          </button>
        </div>

        {authMode === "login" ? (
          <section className="auth-panel" role="tabpanel">
            <h2>Connexion</h2>
            <div className="auth-fields">
              <input
                placeholder="Email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                autoComplete="email"
              />
              <input
                placeholder="Code d'accès"
                value={accessCode}
                onChange={(e) => onAccessCodeChange(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <p className="auth-hint">
              Code par défaut à l'inscription : <code>ferme</code>
            </p>
            <button type="button" className="auth-submit" disabled={busy} onClick={onLogin}>
              Entrer dans ma ferme
            </button>
          </section>
        ) : (
          <div className="auth-onboard">
            <section className="auth-panel">
              <h2>Métier</h2>
              <div className="spe-cards">
                {(Object.keys(SPECIALIZATION_LABELS) as Specialization[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`spe ${spe === k ? "active" : ""}`}
                    onClick={() => onSpeChange(k)}
                  >
                    <strong>{SPECIALIZATION_LABELS[k]}</strong>
                    <div className="muted">
                      {k === "ETA"
                        ? "Missions sans terre obligatoire."
                        : "Parcelle de départ sur la carte."}
                    </div>
                  </button>
                ))}
              </div>
              <div className="auth-fields" style={{ marginTop: "1rem" }}>
                <input placeholder="Nom" value={name} onChange={(e) => onNameChange(e.target.value)} />
                <input
                  placeholder="Email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  autoComplete="email"
                />
                <input
                  placeholder="Code d'accès"
                  value={accessCode}
                  onChange={(e) => onAccessCodeChange(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </section>

            <section className="auth-panel">
              <h2>Parcelle de départ</h2>
              {spe === "ETA" ? <p className="muted">Optionnel pour ETA.</p> : null}
              <div className="zone-maps">
                {zones.map((z) => (
                  <ZoneMap
                    key={z.id}
                    zone={z}
                    selectedParcelId={selectedParcelId}
                    onSelect={onSelectParcel}
                  />
                ))}
              </div>
              {selectedFree ? (
                <p className="zone-select-hint muted">
                  Sélection : <strong>{selectedFree.label}</strong> · {selectedFree.zone?.name} ·{" "}
                  {selectedFree.landPrice} CRD
                </p>
              ) : (
                <p className="zone-select-hint muted">Clique une case libre sur la carte.</p>
              )}
              <button type="button" className="auth-submit" disabled={busy} onClick={onRegister}>
                Créer mon compte
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
