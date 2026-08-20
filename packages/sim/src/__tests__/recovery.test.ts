/**
 * Le code de secours, éprouvé sur ses deux promesses : personne ne le devine,
 * et celui qui l'a recopié à la main sur un carnet peut rentrer chez lui.
 */

import {
  RECOVERY_ALPHABET,
  RECOVERY_GROUP,
  RECOVERY_LEN,
  RECOVERY_REFUSAL,
  formatRecovery,
  isRecoveryCode,
  normalizeRecovery,
  recoveryFromBytes,
} from "@farmsim/shared";

describe("alphabet du code de secours", () => {
  it("compte exactement 32 symboles, sans doublon", () => {
    // Trente-deux, c'est cinq bits pile : un octet donne un symbole sans
    // biais. À 31 ou 33, certains symboles sortiraient plus souvent que
    // d'autres et l'entropie annoncée serait un mensonge.
    expect(RECOVERY_ALPHABET).toHaveLength(32);
    expect(new Set(RECOVERY_ALPHABET).size).toBe(32);
  });

  it("écarte les caractères qui se confondent sur un bout de papier", () => {
    for (const c of ["I", "L", "O", "U"]) {
      expect(RECOVERY_ALPHABET.includes(c)).toBe(false);
    }
  });
});

describe("tirage", () => {
  it("rend un code de la bonne longueur, à partir d'octets connus", () => {
    const octets = Array.from({ length: RECOVERY_LEN }, (_, i) => i);
    const code = recoveryFromBytes(octets);
    expect(code).toHaveLength(RECOVERY_LEN);
    expect(code).toBe("0123456789ABCDEF");
  });

  it("ne perd rien des octets au-delà de 31", () => {
    // 256 étant un multiple de 32, `& 31` replie sans favoriser personne :
    // l'octet 32 doit redonner le premier symbole, pas le dernier.
    expect(recoveryFromBytes(new Array(RECOVERY_LEN).fill(32))).toBe("0".repeat(RECOVERY_LEN));
    expect(recoveryFromBytes(new Array(RECOVERY_LEN).fill(255))).toBe("Z".repeat(RECOVERY_LEN));
  });

  it("refuse de fabriquer un code avec trop peu de hasard", () => {
    expect(() => recoveryFromBytes([1, 2, 3])).toThrow();
  });

  it("couvre tout l'alphabet quand les octets le couvrent", () => {
    const vus = new Set<string>();
    for (let base = 0; base < 256; base += RECOVERY_LEN) {
      const tranche = Array.from({ length: RECOVERY_LEN }, (_, i) => base + i);
      for (const c of recoveryFromBytes(tranche)) vus.add(c);
    }
    expect(vus.size).toBe(RECOVERY_ALPHABET.length);
  });
});

describe("lecture de ce que le joueur tape", () => {
  it("accepte le code tel qu'il est affiché, groupes compris", () => {
    const code = "0123456789ABCDEF";
    expect(normalizeRecovery(formatRecovery(code))).toBe(code);
    expect(isRecoveryCode(formatRecovery(code))).toBe(true);
  });

  it("redresse les lettres recopiées de travers", () => {
    // Aucun code authentique ne contient de O, de I ni de L : un O tapé ne
    // peut donc vouloir dire que zéro. C'est ce qui permet de pardonner sans
    // jamais accepter deux codes différents pour un seul.
    expect(normalizeRecovery("olio")).toBe("0110");
    expect(normalizeRecovery("O1I-l0")).toBe("01110");
  });

  it("pardonne la casse, les espaces et les tirets d'un copier-coller", () => {
    expect(normalizeRecovery("  a1b2 - c3d4\n")).toBe("A1B2C3D4");
  });

  it("ne prend pas un code tronqué pour un code valable", () => {
    expect(isRecoveryCode("A1B2-C3D4")).toBe(false);
    expect(isRecoveryCode("")).toBe(false);
    expect(isRecoveryCode("0123456789ABCDEFG")).toBe(false);
  });
});

describe("affichage", () => {
  it("découpe en groupes recopiables", () => {
    const rendu = formatRecovery("0123456789ABCDEF");
    expect(rendu).toBe("0123-4567-89AB-CDEF");
    for (const groupe of rendu.split("-")) {
      expect(groupe).toHaveLength(RECOVERY_GROUP);
    }
  });
});

describe("refus", () => {
  it("ne distingue pas l'adresse inconnue du mauvais code", () => {
    // Sinon l'écran d'oubli devient un annuaire : mille adresses essayées,
    // et l'on sait lesquelles jouent.
    expect(RECOVERY_REFUSAL).toMatch(/Adresse ou code/);
    expect(RECOVERY_REFUSAL).not.toMatch(/inconnu|introuvable|n'existe/i);
  });
});
