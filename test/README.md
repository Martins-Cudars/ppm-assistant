# Checks

Assertion scripts for the pure logic behind backup and restore. **There is no test runner
in this project yet** — these are kept because the *cases* were the expensive part to work
out, not the harness. Wiring them to Vitest is item 4 in
[../docs/skill-history.md](../docs/skill-history.md#outstanding-work).

They live outside `src/` deliberately: `tsconfig.json` has `include: ["src"]` and `pnpm lint`
only targets `src` plus the vite configs, so nothing here affects `pnpm type-check`,
`pnpm lint` or `pnpm build`.

| File | Covers | Last run |
|---|---|---|
| `backup-parse.check.ts` | `parseBackup()` — envelope rejection and row filtering, 12 assertions | 2026-08-30, all pass |
| `player-cache-import.check.ts` | `importCaches()` / `exportAllCaches()` — merge, replace, key handling, 8 assertions | 2026-08-30, all pass |

## Running them until there's a runner

They import via the `@/` alias and pull in real modules, so they need bundling first. Build
one as an SSR bundle with a throwaway vite config, then run it with node:

```js
// vite.check.mts, at the repo root
import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    target: "esnext", // player-cache-import.check.ts uses top-level await
    outDir: process.env.OUT_DIR,
    emptyOutDir: true,
    ssr: true,
    rollupOptions: {
      input: path.resolve(__dirname, "test/backup-parse.check.ts"),
      output: { entryFileNames: "check.mjs", format: "es" },
    },
  },
});
```

```bash
OUT_DIR=/tmp/checks npx vite build --config vite.check.mts && node /tmp/checks/check.mjs
```

Each file prints `PASS`/`FAIL` per case and a final `ALL PASS` or failure count.

`player-cache-import.check.ts` stubs `chrome.storage.local` before importing the module under
test — that's why it uses a dynamic import rather than a static one at the top.

## What these do not cover

Everything that needs a browser: the restore path end to end, Clear All Data, squad-overview
capture, and the dialogs. See the verification-status table in
[../docs/skill-history.md](../docs/skill-history.md#verification-status) for what has actually
been run.
