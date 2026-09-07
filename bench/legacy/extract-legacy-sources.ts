// ===========================================================================
// bench/legacy/extract-legacy-sources.ts
//
// Puts the 1.x SOURCES somewhere they can be required, by exporting them out
// of git rather than by trusting anything in the working tree.
//
// This exists because of a defect this harness had and this file removes. The
// first version compared against `dist/`, on the reasoning that dist/index.js
// was dated 2025-08-16 and therefore was the 1.x artefact. Halfway through
// authoring, a parallel release-stage step rebuilt dist/ FROM THE CURRENT
// SOURCES, and the comparison went on producing numbers — it was measuring the
// rewrite against itself and reporting a 0.9x "regression against 1.x". A
// build output is not a historical record. `git archive <ref> src` is.
// ===========================================================================
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const REPOSITORY_ROOT = join(__dirname, "..", "..");
const DEFAULT_REF = process.env["LUQ_LEGACY_REF"] ?? "master";
const EXTRACT_ROOT = join(tmpdir(), "luq-legacy-sources");
const STAMP_FILE = "extracted-from.txt";

export interface LegacySourcesExtracted {
  readonly extracted: true;
  readonly sourceRoot: string;
  readonly ref: string;
  readonly commit: string;
}

export interface LegacySourcesUnavailable {
  readonly extracted: false;
  readonly detail: string;
}

export type LegacySources = LegacySourcesExtracted | LegacySourcesUnavailable;

function runGit(args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Extracts `<ref>:src` into a temp directory, once per commit. The stamp file
 * carries the resolved commit rather than the ref name, so a moving branch
 * re-extracts instead of silently measuring last week's checkout.
 */
export function extractLegacySources(ref: string = DEFAULT_REF): LegacySources {
  let commit: string;
  try {
    commit = runGit(["rev-parse", `${ref}^{commit}`]);
  } catch (failure) {
    return {
      extracted: false,
      detail: `cannot resolve ${ref}: ${failure instanceof Error ? failure.message : String(failure)}`,
    };
  }

  const target = join(EXTRACT_ROOT, commit);
  const stampPath = join(target, STAMP_FILE);
  if (
    existsSync(stampPath) &&
    readFileSync(stampPath, "utf8").trim() === commit
  ) {
    return { extracted: true, sourceRoot: join(target, "src"), ref, commit };
  }

  try {
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    const archivePath = join(target, "legacy-src.tar");
    runGit(["archive", "--format=tar", "-o", archivePath, commit, "src"]);
    execFileSync("tar", ["-xf", archivePath, "-C", target], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    rmSync(archivePath, { force: true });
  } catch (failure) {
    return {
      extracted: false,
      detail: `git archive/tar failed for ${ref}: ${failure instanceof Error ? failure.message : String(failure)}`,
    };
  }

  const entryPath = join(target, "src", "index.ts");
  if (!existsSync(entryPath)) {
    return {
      extracted: false,
      detail: `${ref} has no src/index.ts to compare against`,
    };
  }
  writeFileSync(stampPath, `${commit}\n`, "utf8");
  return { extracted: true, sourceRoot: join(target, "src"), ref, commit };
}
