import fs from "node:fs";

export const packagePath = new URL("../package.json", import.meta.url);
export const manifestPath = new URL("../src/manifest.json", import.meta.url);

export function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

export function writeJson(path, data) {
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

  if (!match) {
    throw new Error(`Expected semver version x.y.z, received: ${version}`);
  }

  return match.slice(1).map(Number);
}

export function getPackageVersion() {
  return readJson(packagePath).version;
}

export function syncManifestVersion(version) {
  const manifest = readJson(manifestPath);
  manifest.version = version;
  writeJson(manifestPath, manifest);
}
