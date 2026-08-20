import {
  JOB_ARRIVAL_MAX_MS,
  JOB_ARRIVAL_MIN_MS,
  jobArrivalMs,
  workAnimationMs,
} from "@farmsim/shared";

/**
 * L'engin doit passer **pendant** le chrono.
 *
 * Signalé en jouant, vidéo à l'appui : « je presse, le chrono s'écoule, puis
 * le véhicule apparaît à la fin du chrono ». L'attente montrait un champ vide
 * et le passage arrivait une fois le travail déjà fait — l'inverse de ce qui
 * se passe dans un champ.
 *
 * La cause était dans l'enchaînement : ouvrir le chantier et attendre sa fin
 * étaient un seul geste, et l'animation partait après. Ce sont deux gestes,
 * et l'engin entre entre les deux.
 *
 * Ce fichier tient l'arithmétique de ce découpage : arrivée puis traversée
 * doivent remplir le chrono, sans le dépasser ni laisser de trou.
 */
describe("le tempo d’un chantier", () => {
  // Un déchaumage de 73 cases, une presse, un petit passage : les trois
  // ordres de grandeur que le jeu produit vraiment.
  const durees = [500, 2_000, 20_000, 100_000, 170_000, 500_000];

  it("laisse toujours le temps d’amener le matériel", () => {
    for (const d of durees) {
      expect(`${d} → ${jobArrivalMs(d) > 0}`).toBe(`${d} → true`);
    }
  });

  it("ne laisse jamais l’arrivée manger plus de la moitié du chantier", () => {
    // Sinon un petit chantier passerait son temps à « arriver » sans jamais
    // rien faire à l'écran.
    for (const d of durees) {
      expect(`${d} → ${jobArrivalMs(d) <= d / 2}`).toBe(`${d} → true`);
    }
  });

  it("borne l’arrivée pour que les gros chantiers travaillent vite", () => {
    // Sur un très gros champ, 15 % ferait une minute de champ vide.
    expect(jobArrivalMs(600_000)).toBe(JOB_ARRIVAL_MAX_MS);
    // Et sur un chantier moyen, elle ne descend pas sous le seuil visible.
    expect(jobArrivalMs(20_000)).toBeGreaterThanOrEqual(JOB_ARRIVAL_MIN_MS);
  });

  it("fait tenir arrivée et traversée dans le chrono, sans trou", () => {
    /**
     * L'invariant qui compte pour l'œil : l'engin entre à la fin de l'arrivée
     * et sort à la fin du chantier. `workAnimationMs` porte un plancher de
     * 900 ms — c'est le seul cas où le total peut dépasser, et il ne concerne
     * que les chantiers plus courts que ce plancher.
     */
    for (const d of durees) {
      const arrivee = jobArrivalMs(d);
      const traversee = workAnimationMs(1, d - arrivee);
      const total = arrivee + traversee;
      const attendu = Math.max(d, arrivee + 900);
      expect(`${d} → ${total}`).toBe(`${d} → ${attendu}`);
    }
  });

  it("ne fait pas traverser le champ avant que le chrono existe", () => {
    // Un chantier de durée nulle n'a rien à montrer : pas d'arrivée non plus.
    expect(jobArrivalMs(0)).toBe(0);
    expect(jobArrivalMs(-1)).toBe(0);
  });
});
