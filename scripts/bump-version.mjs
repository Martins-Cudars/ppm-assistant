import {
  manifestPath,
  packagePath,
  parseVersion,
  readJson,
  syncManifestVersion,
  writeJson,
} from "./version-utils.mjs";

const bumpType = process.argv[2];
const allowedBumpTypes = new Set(["patch", "minor", "major"]);

if (!allowedBumpTypes.has(bumpType)) {
  console.error("Usage: node scripts/bump-version.mjs <patch|minor|major>");
  process.exit(1);
}

const packageJson = readJson(packagePath);
const [major, minor, patch] = parseVersion(packageJson.version);

const nextVersion =
  bumpType === "major"
    ? `${major + 1}.0.0`
    : bumpType === "minor"
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

packageJson.version = nextVersion;
writeJson(packagePath, packageJson);
syncManifestVersion(nextVersion);

console.log(`Version bumped to ${nextVersion}`);
console.log(`Updated ${packagePath.pathname}`);
console.log(`Updated ${manifestPath.pathname}`);
