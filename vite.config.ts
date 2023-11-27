// vite.config.ts
import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "main.js",
        assetFileNames: "styles.css",
        chunkFileNames: "chunk.js",
        manualChunks: undefined,
      },
    },
  },
  plugins: [
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
          console.error('Failed to copy manifest.json:', error);
        }
        );
      },
    },
  ],
});
