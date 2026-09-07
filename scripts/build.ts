import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  copyCommonJsEmit,
  copyEsmEmit,
} from "./distribution/copy-emitted-modules";
import {
  BUILD_TEMP_DIRECTORY,
  DIST_DIRECTORY,
  removeDirectory,
} from "./distribution/dist-layout";
import { emitTypeScriptOutputs } from "./distribution/emit-typescript-outputs";
import { readSubpathEntries } from "./distribution/subpath-entry-sources";
import { writeSubpathEntries } from "./distribution/write-subpath-entries";

export interface BuildReport {
  readonly commonJsModuleCount: number;
  readonly esmModuleCount: number;
  readonly subpathEntryCount: number;
}

/**
 * Builds dist/ from src/.
 *
 * The output MIRRORS the source layout, one emitted module per source module,
 * plus one forwarding entry file per published subpath. Nothing is bundled:
 * the shared core is therefore a real shared module that every plugin module
 * imports, rather than a copy inlined into each plugin — which is what 1.x
 * did, and why its "only pay for what you use" claim was untrue.
 */
export function buildDistribution(repositoryRoot: string): BuildReport {
  const distRoot = path.join(repositoryRoot, DIST_DIRECTORY);
  const temporaryRoot = path.join(repositoryRoot, BUILD_TEMP_DIRECTORY);
  removeDirectory(distRoot);
  removeDirectory(temporaryRoot);

  emitTypeScriptOutputs(repositoryRoot, "tsconfig.build.json");
  emitTypeScriptOutputs(repositoryRoot, "tsconfig.build-esm.json");

  const commonJsModuleCount = copyCommonJsEmit(
    path.join(temporaryRoot, "cjs"),
    distRoot
  );
  const esmModuleCount = copyEsmEmit(path.join(temporaryRoot, "esm"), distRoot);
  const subpathEntries = writeSubpathEntries(
    distRoot,
    readSubpathEntries(repositoryRoot)
  );
  removeDirectory(temporaryRoot);

  return {
    commonJsModuleCount,
    esmModuleCount,
    subpathEntryCount: subpathEntries.length,
  };
}

if (require.main === module) {
  runCheckAndExit(() => {
    const report = buildDistribution(REPOSITORY_ROOT);
    console.error(
      `dist: CommonJS+宣言 ${report.commonJsModuleCount} ファイル / ` +
        `ESM ${report.esmModuleCount} ファイル / ` +
        `サブパスエントリ ${report.subpathEntryCount} ファイル`
    );
    return 0;
  });
}
