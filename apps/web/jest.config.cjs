/**
 * Tests de la couche visible.
 *
 * Trois n'a besoin d'aucun contexte graphique pour construire une scène :
 * géométries, hiérarchie, matériaux et boîtes englobantes se calculent très
 * bien dans Node. Ce sont précisément ces propriétés-là qu'on veut vérifier —
 * un engin qui pose ses roues au sol, une pièce animée qui existe, une case
 * fauchée qui l'est vraiment. Le rendu lui-même n'est pas testé ici.
 */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@farmsim/shared$": "<rootDir>/../../packages/shared/src/index.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ESNext",
          moduleResolution: "Bundler",
          rootDir: "../..",
          esModuleInterop: true,
        },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};
