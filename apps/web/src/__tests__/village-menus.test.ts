import fs from "node:fs";

import { RAIL_GROUPS, TOOL_GROUPS } from "../ui/tool-options";

/**
 * Le marché, le garage et le bureau vivent au village.
 *
 * Ils avaient chacun un bouton — Ventes dans le dock et le rail, Garage et
 * Bureau dans « Mon exploitation », Garage et Missions dans le tiroir Plus —
 * en plus de la coopérative, de la concession et de la mairie. Un bouton qui
 * double un bâtiment apprend à ignorer le bâtiment : les boutons partent, et
 * la vue se charge de mener au village quand il sort du cadre.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");
const VUE = fs.readFileSync("src/IsoFarmView.tsx", "utf8");
const DOCK = fs.readFileSync("src/FieldDock.tsx", "utf8");
const RAIL = fs.readFileSync("src/ui/desktop/ToolRail.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");

describe("le village remplace les menus", () => {
  it("retire Ventes du dock et du rail, sans perdre la touche 5", () => {
    expect(RAIL_GROUPS.map((g) => g.id)).toEqual(["SELECT", "PLANT", "SOIL", "HARVEST"]);
    expect(TOOL_GROUPS.find((g) => g.id === "SELL")?.hotkey).toBe("5");
    expect(DOCK).toMatch(/RAIL_GROUPS\.map/);
    expect(RAIL).toMatch(/RAIL_GROUPS\.map/);
    expect(DOCK).not.toMatch(/onSell/);
    expect(RAIL).not.toMatch(/onMarket/);
  });

  it("retire Garage, Bureau et Missions des panneaux", () => {
    const onglets = APP.match(/const SHEET_TABS[^;]+;/)?.[0] ?? "";
    expect(onglets).not.toMatch(/GARAGE|OFFICE/);
    expect(APP).not.toMatch(/id: "GARAGE",\s*label: "Garage"/);
    expect(APP).not.toMatch(/id: "OFFICE",\s*label: "Bureau"/);
  });

  it("ouvre le Bureau depuis la mairie au téléphone aussi", () => {
    // Le tiroir « OFFICE » n'affichait plus rien : toucher la mairie au
    // téléphone n'ouvrait rien du tout.
    expect(APP).not.toMatch(/setSheet\("OFFICE"\)/);
    expect(APP).toMatch(/genre === "MAIRIE"\) \{[\s\S]{0,300}setShowEta\(true\)/);
  });

  it("n'a plus de grosse pastille pour montrer le village", () => {
    // « La flèche est très grosse, je ne pense pas qu'on en ait besoin. »
    expect(VUE).not.toMatch(/village-pastille|NOMS_LIEUX|majPastille/);
    expect(CSS).not.toMatch(/\.village-pastille/);
    // Sans le village dans les bornes, la vue y glisserait puis serait
    // rappelée aussitôt.
    expect(VUE).toMatch(/for \(const l of campagne\.plan\.lieux\)/);
  });
});
