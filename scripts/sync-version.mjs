import {
  getPackageVersion,
  manifestPath,
  syncManifestVersion,
} from "./version-utils.mjs";

const version = getPackageVersion();
syncManifestVersion(version);

console.log(`Synced ${manifestPath.pathname} to ${version}`);
