import { readFileSync } from "node:fs";
import { SEASON_REAL_HOURS } from "@farmsim/shared";
import { GUIDE_FLAGS_KEY, TUTORIAL_KEY, playerStorageKey } from "../storage-keys";

const APP = readFileSync("src/App.tsx", "utf8");
const TUTORIAL = readFileSync("src/tutorial-steps.ts", "utf8");
const LIVESTOCK = readFileSync("src/LivestockPanel.tsx", "utf8");
const OFFICE = readFileSync("src/OfficePanel.tsx", "utf8");
const TSX = [
  "src/App.tsx",
  "src/EmployeesPanel.tsx",
  "src/FieldDock.tsx",
  "src/LivestockPanel.tsx",
  "src/MachineSheet.tsx",
  "src/MachineShowcase.tsx",
  "src/ZoneMap.tsx",
  "src/ui/desktop/ToolRail.tsx",
].map((file) => readFileSync(file, "utf8"));

describe("les incohérences repérées pendant l’audit", () => {
  it("isole le tutoriel et la progression du guide pour chaque joueur", () => {
    expect(playerStorageKey(GUIDE_FLAGS_KEY, "joueur-a")).toBe(
      "farmsim_guide_flags_v1:joueur-a",
    );
    expect(playerStorageKey(TUTORIAL_KEY, "joueur-b")).toBe("farmsim_tutorial_v1:joueur-b");
    expect(APP).toContain("readGuideFlags(player.id)");
    expect(APP).toContain("writeGuideFlags(player.id, next)");
  });

  it("ne confond plus un stock acheté avec une récolte", () => {
    const harvestLine = APP.match(/hasHarvested:[^\n]+/)?.[0] ?? "";
    expect(harvestLine).toContain("guideFlags.harvested");
    expect(harvestLine).toContain("hasStubble");
    expect(harvestLine).not.toContain("stock(");
  });

  it("annonce la durée réellement utilisée par le moteur de saisons", () => {
    expect(SEASON_REAL_HOURS).toBe(10);
    expect(TUTORIAL).toContain("${SEASON_REAL_HOURS} heures réelles");
    expect(TUTORIAL).not.toContain("15 minutes");
  });

  it("distingue le bonus du bâtiment de la production réelle du troupeau", () => {
    expect(LIVESTOCK).toContain("Aucun bonus d’installation pour l’instant");
    expect(LIVESTOCK).toContain("seulement si le troupeau est nourri, abreuvé et propre");
    expect(LIVESTOCK).not.toContain("le troupeau tourne à 100 %");
  });

  it("emploie les mêmes noms que les boutons réellement visibles", () => {
    expect(TUTORIAL).toContain("Onglet Bâtir");
    expect(TUTORIAL).toContain("L’onglet Missions");
    expect(TUTORIAL).toContain("Onglet Troupeau");
    expect(TUTORIAL).toContain("Onglet Personnel");
    expect(OFFICE).toContain('className="hdv-kicker">Bureau');
    expect(OFFICE).not.toContain("Hôtel du travail");
  });

  it("expose les choix exclusifs comme des radios et les bascules comme des interrupteurs", () => {
    expect(TSX.join("\n")).not.toContain("aria-pressed");
    expect(TSX.join("\n")).toContain('role="radiogroup"');
    expect(TSX.join("\n")).toContain('role="switch"');
  });
});
