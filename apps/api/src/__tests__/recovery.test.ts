/**
 * L'empreinte du code de secours : elle ne doit rien rendre du code, et ne
 * doit jamais valoir pour un autre compte.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizeRecovery, isRecoveryCode } from "@farmsim/shared";

import { empreinteSecours, nouveauCodeSecours, secoursCorrespond } from "../recovery.js";

describe("code de secours", () => {
  it("tire un code de la bonne forme", () => {
    for (let i = 0; i < 50; i += 1) {
      assert.ok(isRecoveryCode(nouveauCodeSecours()));
    }
  });

  it("ne retombe pas deux fois sur le même", () => {
    const vus = new Set<string>();
    for (let i = 0; i < 500; i += 1) vus.add(nouveauCodeSecours());
    assert.equal(vus.size, 500);
  });
});

describe("empreinte", () => {
  it("ne contient pas le code", () => {
    const code = nouveauCodeSecours();
    const h = empreinteSecours("u1", code);
    assert.equal(h.length, 64);
    assert.ok(!h.toUpperCase().includes(code));
  });

  it("dépend du compte : la même empreinte ne vaut pas ailleurs", () => {
    // Sans le sel, un code volé sur un compte servirait de clé passe-partout
    // dès que deux comptes le partagent, et une table pré-calculée suffirait.
    const code = nouveauCodeSecours();
    assert.notEqual(empreinteSecours("u1", code), empreinteSecours("u2", code));
    assert.ok(!secoursCorrespond(empreinteSecours("u2", code), "u1", code));
  });
});

describe("vérification", () => {
  it("accepte le code recopié à la main, tirets et casse compris", () => {
    const code = nouveauCodeSecours();
    const h = empreinteSecours("u1", code);
    const recopie = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12)}`;
    assert.ok(secoursCorrespond(h, "u1", recopie.toLowerCase()));
    assert.equal(normalizeRecovery(recopie.toLowerCase()), code);
  });

  it("refuse un compte qui n'a pas encore de code de secours", () => {
    assert.ok(!secoursCorrespond(null, "u1", nouveauCodeSecours()));
  });

  it("refuse un code faux", () => {
    const h = empreinteSecours("u1", nouveauCodeSecours());
    assert.ok(!secoursCorrespond(h, "u1", nouveauCodeSecours()));
  });
});
