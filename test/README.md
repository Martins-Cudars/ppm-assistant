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
| `backup-parse.check.ts` | `parseBackup()` — envelope rejection and row filtering, v1 files and v2 per-sport history, 14 assertions | 2026-10-01, all pass |
| `player-cache-import.check.ts` | `importCaches()` / `exportAllCaches()` — merge, replace, key handling, the roster read the team filter uses, basketball caches in export/import, 11 assertions | 2026-10-01, all pass |
| `growth-pace.check.ts` | `sports/hockey/growthPace.ts` (the shared `base/growthModel.ts` with hockey's config; unedited through the refactor) — skill-point pace (incl. catch-up and non-bottleneck cases, bonus growth and the bonus cap), the balanced solver, projection (incl. the on-curve and age-adjusted invariants), no-training and camp days, provisional pace, the camp allowance, age factors, overall rating, the @25 lookups, XP and potential, 52 assertions | 2026-09-30, all pass (rerun after camp and no-training cleaning moved to `base/gainCleaning.ts`) |
| `squad-rank.check.ts` | `squadRank.ts` — rank at position, neighbours and gaps, the 4-neighbour standings slice (shifting at the top and bottom), ties, the subject's cached copy ignored, ordinals, 13 assertions | 2026-09-25, all pass |
| `basketball-capture.check.ts` | `sports/basketball/capture.ts` — player-id normalising (links, data=, path, rejects), the daily entry incl. height and XP, unread fields left out, rebuilding a cached player, 8 assertions | 2026-10-01, all pass |
| `soccer-growth.check.ts` | `sports/soccer/growthPace.ts` — the reference (table to 23, squad shape from 24), junior age factors, one-skill-a-day pace at the SM ratios, per-skill camp detection, the camp allowance, projection monotone and capped, a 15-year-old's pace not carried to 25, an elite-team junior's XP not extrapolated, potential at 32, 9 checks | 2026-10-01, all pass |
| `soccer-capture.check.ts` | `sports/soccer/capture.ts` + `base/captureUtils.ts` — ids (profile link, plain, flag rejected, parser fallback), the daily entry, an unscouted OR-only day without estimated XP, rebuilding a cached player; `sports/soccer/historyChart.ts` day rating, OR fallback, 112-day ages and thinning, 7 checks | 2026-10-01, all pass |
| `history-precision.check.ts` | `storage/historyMerge.ts` (decimals survive a same-day whole-number capture, decimals replace whole numbers, differing values win, OR-only merge) and `base/gainCleaning.ts` (whole-number captures told by source, whole-number daily history measured without skipping, a real flat day still skipped, a mixed window), 8 checks | 2026-10-01, all pass |
| `scout-reference.check.ts` | Scouted rosters behind basketball's ELITE and LEAGUE lines: `parsers/teamRoster.ts` (a roster row by column position, thousands separators, rejected rows, season text, the league identity), `scoutCapture.ts` (a row as today's snapshot), `storage/scoutMerge.ts` (same-day merge; the league list - default page, full table adding to it, another league ignored, a new season replacing it, a past season's table ignored), `scoutReference.ts` (best OR per age at the exact age, a player at two ages, the league filter with a player who moved, captions for empty and stale data), 13 checks | 2026-10-02, all pass |
| `history-repair.check.ts` | `base/captureUtils.ts` stripThousands + `storage/historyRepair.ts` — English thousands commas vs decimals, restoring a cut OR from the floored skills, leaving correct/unrepairable entries alone, 3 checks (dry run on the 2026-10-01 backup: 8,436 soccer days repaired, 0 mismatches left) | 2026-10-01, all pass |
| `public-account.check.ts` | `storage/publicAccount.ts` — the public-account link (slug, name, per-sport known id), picking the user's cache when the public one sorts first, an unlisted public team found by team name, the newest of two real teams, the cleanup's key list, 5 checks | 2026-10-01, all pass |
| `basketball-growth.check.ts` | `sports/basketball/growthModel.ts` and the shared `base/gainCleaning.ts` — the per-skill camp baseline, flat days, the reference curve (best per age, non-increasing after the peak, default fill), pace and provisional pace, skill shares, the 10-day camp cap, height growth, reference points, the balanced solver, projection bookkeeping, the height stop, typical-only future XP, potential, the 70-day season, chart data (history points, squad best, projection line), 20 checks | 2026-09-30, all pass |

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
