import { execFileSync } from "child_process";
import * as path from "path";

/**
 * Runs tsc on one project configuration.
 *
 * It runs the compiler tsc.js directly under this node process rather than
 * through npx, so the exit code is the compiler's own. 1.x wrapped this call
 * in `try { } catch { console.log("had warnings, continuing") }` and shipped
 * whatever declarations happened to survive; a non-zero exit here throws, and
 * `npm run build` stops.
 */
export function emitTypeScriptOutputs(
  repositoryRoot: string,
  projectFile: string
): void {
  const compiler = require.resolve("typescript/lib/tsc.js");
  execFileSync(process.execPath, [compiler, "-p", projectFile], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
}

/** `.build/cjs/plugins/required/index.js` -> `plugins/required/index.js`. */
export function toEmittedRelativePath(
  emitRoot: string,
  absoluteFile: string
): string {
  return path.relative(emitRoot, absoluteFile).split(path.sep).join("/");
}
