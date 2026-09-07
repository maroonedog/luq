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
 */
export function checkNoDynamicCode(repositoryRoot: string): number {
  const distRoot = resolveDistRoot(repositoryRoot);
  if (!fs.existsSync(distRoot)) {
    console.error(
      `${distRoot} がありません。先に npm run build を実行してください。`
    );
    return 1;
  }
  const report = findDynamicCode(distRoot);
  if (report.scannedFileCount === 0) {
    console.error(`${distRoot} に走査対象の .js/.mjs が1つもありません。`);
    return 1;
  }
  if (report.findings.length === 0) {
    console.error(
      `動的コード検査: ${report.scannedFileCount} ファイルに違反なし`
    );
    return 0;
  }
  console.error(`動的コード検査 違反 ${report.findings.length} 件:`);
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
