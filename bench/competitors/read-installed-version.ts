// ===========================================================================
// bench/competitors/read-installed-version.ts
//
// Reads each competitor's version **from what is actually installed**.
//
// Requiring a package's own package.json works for some and not others: not
// every package lists "./package.json" in its exports. Branching on that would
// leave exactly the unreadable ones with an unknown version. Reading from disk
// puts every library on the same path.
//
// The devDependencies are not read, because what is written there is a range
// and not the version that was measured.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");

export function readInstalledVersion(packageName: string): string {
  const manifest = path.join(
    REPOSITORY_ROOT,
    "node_modules",
    packageName,
    "package.json"
  );
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      typeof (parsed as { version: unknown }).version === "string"
    ) {
      return (parsed as { version: string }).version;
    }
  } catch {
    // Unreadable becomes "unknown", which beats an empty string in a report.
  }
  return "unknown";
}
