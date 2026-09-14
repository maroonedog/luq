// ===========================================================================
// docs-site/scripts/ensure-generated.mjs
//
// Generates src/data/*.ts when it is not there, and otherwise does nothing.
//
// Those files are derived from config/ and from the package itself, and they
// are not committed: a build rewrote them every time, so the copies in git
// drifted from the source of truth and every build left the working tree
// dirty. One of them sat at a competitor ratio of x1.38 while the baseline it
// is generated from said x1.02 — a number nobody had published, but one a
// reader of the repository would have believed.
//
// Not committing them costs a fresh clone the ability to run `astro check` or
// `astro dev` before generating, which is a worse trap than the drift: 52 type
// errors that say nothing about what is wrong. So the commands that need the
// files present go through here first.
//
// It deliberately checks only for PRESENCE, never for freshness. `build`
// regenerates unconditionally and is what CI and the deploy run, so the
// published site is always built from current data; this is the cheap guard
// that keeps a working copy usable, and 32 seconds is too long to spend on
// every `astro dev`.
// ===========================================================================
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "src", "data");

/** Written by `npm run generate-all`; legacy-speedups.ts is hand-written and stays in git. */
const GENERATED = [
  "bundle-size.ts",
  "competitors.ts",
  "conformance.ts",
  "package-info.ts",
  "plugins.ts",
];

const missing = GENERATED.filter((name) => !existsSync(join(DATA, name)));
if (missing.length === 0) {
  process.exit(0);
}

process.stderr.write(
  `src/data is missing ${missing.join(", ")} — running generate-all\n`
);

const result = spawnSync("npm", ["run", "generate-all"], {
  cwd: join(HERE, ".."),
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.stderr.write("generate-all failed; src/data is still incomplete\n");
}
process.exit(result.status ?? 1);
