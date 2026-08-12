// vite.background.config.ts
// Separate build configuration for the background service worker
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false, // Don't delete existing dist files
    rollupOptions: {
      input: path.resolve(__dirname, "src/background.ts"),
      output: {
        entryFileNames: "background.js",
        chunkFileNames: "chunk.js",
        assetFileNames: "[name].[ext]",
        format: "es", // ES module for MV3 service worker
      },
    },
  },
});
