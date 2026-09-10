import * as fs from "fs";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  findDynamicCode,
  resolveDistRoot,
} from "./distribution/find-dynamic-code";

/**
 * scripts/check-no-dynamic-code.ts — CSP-safe, verified on the ARTIFACT.
 *
 * README has claimed "no eval, no new Function" since 1.0. Nothing checked it.
 * The claim is about what a browser with a Content-Security-Policy will run,
 * which is dist/, not src/ — 1.x had a live `new Function` in src that merely
 * happened not to reach the bundle, so a source-level check would have said
 * the wrong thing in both directions.
 *
 * An empty dist/ is a FAILURE, not a pass: a gate that reports "no violations"
 * because it scanned nothing is worse than no gate.
 *
 * WHAT THIS DOES AND DOES NOT BUY, written down because the claim is easy to
 * overstate and this repository did overstate it once. "ajv cannot run under a
 * strict CSP" is FALSE: ajv/dist/standalone precompiles a schema to a module
 * ahead of time, and the generated source contains no dynamic code at all
 * (generated and inspected, 2026-09-09). Under a strict CSP, a code-generating
 * validator whose schemas are known at build time is perfectly fine.
 *
 * The difference is a schema that is only known at RUN TIME — one that arrives
 * from a server, sits in a database, or is written by the user. Precompiling is
 * then impossible by construction, and a code-generating validator has to build
 * a function in the browser, which is what the policy forbids. Luq turns a
 * runtime document into rules and generates nothing, so it keeps working.
 * That, and not "no dynamic code anywhere", is the property this gate protects.
 */
export function checkNoDynamicCode(repositoryRoot: string): number {
  const distRoot = resolveDistRoot(repositoryRoot);
  if (!fs.existsSync(distRoot)) {
    console.error(`${distRoot} is missing. Run npm run build first.`);
    return 1;
  }
  const report = findDynamicCode(distRoot);
  if (report.scannedFileCount === 0) {
    console.error(`${distRoot} holds no .js or .mjs to scan.`);
    return 1;
  }
  if (report.findings.length === 0) {
    console.error(
      `Dynamic code: no violations in ${report.scannedFileCount} files`
    );
    return 0;
  }
  console.error(`Dynamic code: ${report.findings.length} violations:`);
  for (const finding of report.findings) {
    console.error(
      `  ${finding.file}:${finding.line} [${finding.rule}] ${finding.text}`
    );
  }
  return 1;
}

if (require.main === module) {
  runCheckAndExit(() => checkNoDynamicCode(REPOSITORY_ROOT));
}
