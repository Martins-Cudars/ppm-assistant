// vite.config.ts
import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./", // Use relative paths for Chrome extension
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        entryFileNames: "main.js",
        assetFileNames: "[name].[ext]",
        chunkFileNames: "chunk.js",
        format: "iife", // IIFE format for content script (no imports)
        inlineDynamicImports: true, // Inline everything into main.js
      },
    },
  },
  plugins: [
    vue(),
    {
      name: "copy-manifest",
      buildStart() {
        this.addWatchFile(path.resolve(__dirname, "src/manifest.json"));
      },
      writeBundle() {
        try {
          fs.copyFileSync(
            path.resolve(__dirname, "src/manifest.json"),
            path.resolve(__dirname, "dist/manifest.json")
          );
        } catch (error) {
          console.error("Failed to copy manifest.json:", error);
        }
      },
    },
  ],
});
