// vite.player-report.config.ts
// Separate build configuration for the Player Report extension page
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't delete existing dist files
    rollupOptions: {
      input: path.resolve(__dirname, "src/player-report-entry.ts"),
      output: {
        entryFileNames: "playerReport.js",
        chunkFileNames: "chunk.js",
        assetFileNames: "[name].[ext]",
        format: "es", // ES modules for extension page
      },
    },
  },
  plugins: [vue()],
});
