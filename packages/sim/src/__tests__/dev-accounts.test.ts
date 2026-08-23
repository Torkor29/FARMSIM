import {
  DEV_OWNER_EMAIL,
  canAfford,
  isDevAccount,
  isDevEmail,
  normalizeEmail,
  testerEmails,
} from "@farmsim/shared";

describe("comptes développeurs", () => {
  it("reconnaît le compte nominatif, sans tenir à la casse", () => {
    expect(isDevEmail("Juju.dolou@gmail.com")).toBe(true);
    expect(isDevEmail(`  ${DEV_OWNER_EMAIL.toUpperCase()}  `)).toBe(true);
    expect(isDevEmail("autre@example.com")).toBe(false);
  });

  it("accepte des adresses supplémentaires via FARMSIM_TESTERS", () => {
    const extra = "Alice@ferme.fr, bob@ferme.fr";
    expect(testerEmails(extra).has("alice@ferme.fr")).toBe(true);
    expect(isDevEmail("bob@ferme.fr", extra)).toBe(true);
    expect(isDevEmail("carol@ferme.fr", extra)).toBe(false);
  });

  it("ne débite jamais le compte nominatif, même à 0 €", () => {
    const dev = { email: DEV_OWNER_EMAIL, crd: 0 };
    expect(isDevAccount(dev)).toBe(true);
    expect(canAfford(dev, 50_000)).toBe(true);
    expect(canAfford({ email: "joueur@ferme.fr", crd: 100 }, 200)).toBe(false);
    expect(canAfford({ email: "joueur@ferme.fr", crd: 200 }, 200)).toBe(true);
  });

  it("laisse un testeur listé payer avec son vrai solde", () => {
    const extra = "alice@ferme.fr";
    expect(isDevEmail("alice@ferme.fr", extra)).toBe(true);
    expect(canAfford({ email: "alice@ferme.fr", crd: 0 }, 10, extra)).toBe(false);
  });

  it("normalise les espaces", () => {
    expect(normalizeEmail("  Juju.Dolou@Gmail.com ")).toBe(DEV_OWNER_EMAIL);
  });
});
