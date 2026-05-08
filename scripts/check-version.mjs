import {
  getPackageVersion,
  manifestPath,
  packagePath,
  readJson,
} from "./version-utils.mjs";

const packageVersion = getPackageVersion();
const manifestVersion = readJson(manifestPath).version;

if (packageVersion !== manifestVersion) {
  console.error("Version mismatch:");
  console.error(`${packagePath.pathname}: ${packageVersion}`);
  console.error(`${manifestPath.pathname}: ${manifestVersion}`);
  process.exit(1);
}

console.log(`Version check passed: ${packageVersion}`);
