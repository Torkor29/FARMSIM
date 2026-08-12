import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@farmsim/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  build: {
    // Three.js pèse 520 kB minifié à lui seul et n'est plus dans le chargement
    // initial : il est isolé et chargé à la demande. Le seuil par défaut de
    // 500 kB n'a donc plus rien à signaler d'utile ici.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Three.js pèse à lui seul plus que tout le reste et ne change
        // jamais : l'isoler lui donne son propre cache navigateur et
        // supprime l'avertissement de taille de bundle.
        manualChunks: {
          three: ["three"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
