import { execFileSync } from "node:child_process";
import { getPackageVersion, parseVersion, readJson } from "./version-utils.mjs";

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  for (const index of [0, 1, 2]) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }

  return 0;
}

function getBaseRef() {
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  return "origin/main";
}

function getBaseVersion(baseRef) {
  const packageJson = execFileSync(
    "git",
    ["show", `${baseRef}:package.json`],
    { encoding: "utf8" }
  );
  const parsedPackageJson = JSON.parse(packageJson);

  if (parsedPackageJson.version) {
    return parsedPackageJson.version;
  }

  const manifestJson = execFileSync(
    "git",
    ["show", `${baseRef}:src/manifest.json`],
    { encoding: "utf8" }
  );

  return JSON.parse(manifestJson).version;
}

const currentVersion = getPackageVersion();
const baseRef = getBaseRef();
const baseVersion = getBaseVersion(baseRef);

if (!currentVersion) {
  console.error("Current package.json is missing a version field.");
  process.exit(1);
}

if (!baseVersion) {
  console.error(`${baseRef}:package.json is missing a version field.`);
  process.exit(1);
}

if (compareVersions(currentVersion, baseVersion) <= 0) {
  console.error(
    `Version must be bumped above ${baseVersion}; current version is ${currentVersion}.`
  );
  process.exit(1);
}

const manifestVersion = readJson(new URL("../src/manifest.json", import.meta.url)).version;
console.log(
  `Version bump check passed: ${baseVersion} -> ${currentVersion} (${manifestVersion} in manifest)`
);
