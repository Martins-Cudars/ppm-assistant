import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["src/**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.chrome,
      },
    },
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["eslint.config.mjs", "vite.config.mts", "vite.player-report.config.mts"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
