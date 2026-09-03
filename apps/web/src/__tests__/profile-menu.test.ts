import fs from "node:fs";
import { parseAudioPrefs, writeAudioPrefs, readAudioPrefs, DEFAULT_AUDIO } from "../audio";

const APP = fs.readFileSync("src/App.tsx", "utf8");
const PROFILE = fs.readFileSync("src/ProfilePanel.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");
const CLOSE = fs.readFileSync("src/ui/MenuClose.tsx", "utf8");

describe("la croix des menus", () => {
  it("existe, petite, avec une cible de quarante-quatre pixels", () => {
    expect(CLOSE).toMatch(/className=\{`menu-close/);
    expect(CLOSE).toMatch(/aria-label=\{label\}/);
    expect(CSS).toMatch(/\.menu-close \{/);
    expect(CSS).toMatch(/width:\s*44px/);
    expect(CSS).toMatch(/height:\s*44px/);
    expect(CSS).toMatch(/opacity:\s*0\.42/);
  });

  it("ferme les fenêtres, le guide, l’hôtel et le calendrier", () => {
    expect(fs.readFileSync("src/ui/desktop/Window.tsx", "utf8")).toMatch(/<MenuClose /);
    expect(fs.readFileSync("src/PlayGuide.tsx", "utf8")).toMatch(/<MenuClose /);
    expect(fs.readFileSync("src/MarketPanel.tsx", "utf8")).toMatch(/<MenuClose /);
    expect(fs.readFileSync("src/CropCalendarPanel.tsx", "utf8")).toMatch(/<MenuClose /);
    expect(fs.readFileSync("src/OfficePanel.tsx", "utf8")).toMatch(/<MenuClose /);
    expect(fs.readFileSync("src/SkillsScreen.tsx", "utf8")).toMatch(/<MenuClose /);
  });
});

describe("le menu du joueur", () => {
  it("n’affiche plus la trésorerie", () => {
    expect(PROFILE).not.toMatch(/Trésorerie/);
    expect(PROFILE).not.toMatch(/walletLabel/);
    expect(PROFILE).not.toMatch(/∞ €/);
  });

  it("ouvre le compte, le son, le guide et la déconnexion", () => {
    expect(PROFILE).toMatch(/>Compte</);
    expect(PROFILE).toMatch(/>Son</);
    expect(PROFILE).toMatch(/Guide de ferme/);
    expect(PROFILE).toMatch(/Revoir le tutoriel/);
    expect(PROFILE).toMatch(/Se déconnecter/);
    expect(PROFILE).toMatch(/onPatchAccount/);
    expect(APP).toMatch(/<ProfilePanel/);
    expect(APP).toMatch(/method: "PATCH"/);
  });

  it("laisse changer pseudo, e-mail et code d’accès", () => {
    expect(PROFILE).toMatch(/Pseudo/);
    expect(PROFILE).toMatch(/E-mail/);
    expect(PROFILE).toMatch(/Nouveau code d’accès/);
    expect(PROFILE).toMatch(/currentAccessCode/);
  });
});

describe("les préférences de son", () => {
  it("lisent un JSON malformé comme le défaut", () => {
    expect(parseAudioPrefs(null)).toEqual(DEFAULT_AUDIO);
    expect(parseAudioPrefs("{")).toEqual(DEFAULT_AUDIO);
  });

  /**
   * Une partie enregistrée avant les trois bus n'a que `muted` et `volume`.
   * Elle doit garder son volume et hériter du reste, sinon le joueur retrouve
   * le son à fond au premier lancement d'après mise à jour.
   */
  it("relisent l'ancien format sans rien perdre", () => {
    expect(parseAudioPrefs('{"muted":true,"volume":0.2}')).toEqual({
      ...DEFAULT_AUDIO,
      muted: true,
      volume: 0.2,
    });
  });

  it("bornent le volume et tiennent dans le stockage", () => {
    const mem = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
      clear: () => mem.clear(),
      key: () => null,
      length: 0,
    };
    const saved = writeAudioPrefs({ muted: true, volume: 2, ambiance: -3 });
    expect(saved).toEqual({ ...DEFAULT_AUDIO, muted: true, volume: 1, ambiance: 0 });
    expect(readAudioPrefs()).toEqual({ ...DEFAULT_AUDIO, muted: true, volume: 1, ambiance: 0 });
  });
});
