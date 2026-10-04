/**
 * Runs every test/*.check.ts: bundles each with Vite's SSR build (they import
 * via the "@/" alias and pull in real modules), runs it with node, and prints
 * one line per file. Exits non-zero when any check fails or won't build.
 *
 *   pnpm check                 # all files
 *   pnpm check growth-pace     # files whose name contains "growth-pace"
 *
 * There is no test runner in this project yet - see test/README.md.
 */

import { build } from "vite";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDir = path.join(root, "test");
const outRoot = path.join(testDir, ".tmp");
const filter = process.argv[2] ?? "";

const files = readdirSync(testDir)
  .filter((name) => name.endsWith(".check.ts") && name.includes(filter))
  .sort();

if (files.length === 0) {
  console.error(`No check files match "${filter}"`);
  process.exit(1);
}

let failedFiles = 0;
for (const file of files) {
  const name = file.replace(/\.check\.ts$/, "");
  const outDir = path.join(outRoot, name);
  try {
    await build({
      configFile: false,
      logLevel: "error",
      root,
      resolve: { alias: { "@": path.join(root, "src") } },
      build: {
        target: "esnext", // player-cache-import.check.ts uses top-level await
        outDir,
        emptyOutDir: true,
        ssr: true,
        rollupOptions: {
          input: path.join(testDir, file),
          output: { entryFileNames: "check.mjs", format: "es" },
        },
      },
    });
  } catch (error) {
    failedFiles++;
    console.log(`BUILD FAIL  ${name}: ${error.message.split("\n")[0]}`);
    continue;
  }

  let output;
  try {
    output = execFileSync(process.execPath, [path.join(outDir, "check.mjs")], { encoding: "utf8" });
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  const lines = output.split(/\r?\n/);
  const passed = lines.filter((line) => line.startsWith("PASS")).length;
  const failures = lines.filter((line) => line.startsWith("FAIL"));
  const allPass = lines.some((line) => line.trim() === "ALL PASS");

  if (allPass && failures.length === 0) {
    console.log(`ok    ${name} (${passed})`);
  } else {
    failedFiles++;
    console.log(`FAIL  ${name} (${passed} passed)`);
    (failures.length > 0 ? failures : lines.slice(-5)).forEach((line) => console.log(`        ${line}`));
  }
}

if (existsSync(outRoot)) rmSync(outRoot, { recursive: true, force: true });

console.log(
  failedFiles === 0
    ? `\nAll ${files.length} check files pass.`
    : `\n${failedFiles} of ${files.length} check files failed.`
);
process.exit(failedFiles === 0 ? 0 : 1);
