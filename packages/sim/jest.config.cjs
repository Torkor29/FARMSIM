module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@farmsim/shared$": "<rootDir>/../shared/src/index.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        // Les tests importent aussi les sources de @farmsim/shared : la racine
        // doit englober les deux paquets.
        tsconfig: { module: "ESNext", moduleResolution: "Bundler", rootDir: ".." },
      },
    ],
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
};
