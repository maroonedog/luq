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

/** The sub-package built here, relative to the repository root. */
const PACKAGE_DIRECTORY = "luq-codegen";

export interface OpenapiPluginBuildReport {
  readonly commonJsModuleCount: number;
  readonly esmModuleCount: number;
}

/**
 * Builds luq-codegen/dist from luq-codegen/src.
 *
 * The same two emits and the same output shape the package at the repository
 * root uses: .js is CommonJS, .mjs is ESM, .d.ts sits beside them, and one
 * emitted module answers one source module. Sharing the copy step rather than
 * writing a second one is what keeps the two artefacts the same shape, so the
 * gates that read a dist can read either without being told which it is.
 *
 * Nothing from the library is emitted into it. The generator names the library
 * by package specifier, which tsc leaves alone, so the built module resolves
 * the installed copy at run time instead of carrying a private one that could
 * disagree with it.
 */
export function buildOpenapiPlugin(
  repositoryRoot: string
): OpenapiPluginBuildReport {
  const packageRoot = path.join(repositoryRoot, PACKAGE_DIRECTORY);
  const distRoot = path.join(packageRoot, DIST_DIRECTORY);
  const temporaryRoot = path.join(packageRoot, BUILD_TEMP_DIRECTORY);
  removeDirectory(distRoot);
  removeDirectory(temporaryRoot);

  emitTypeScriptOutputs(packageRoot, "tsconfig.build.json");
  emitTypeScriptOutputs(packageRoot, "tsconfig.build-esm.json");

  const commonJsModuleCount = copyCommonJsEmit(
    path.join(temporaryRoot, "cjs"),
    distRoot
  );
  const esmModuleCount = copyEsmEmit(path.join(temporaryRoot, "esm"), distRoot);
  removeDirectory(temporaryRoot);

  return { commonJsModuleCount, esmModuleCount };
}

if (require.main === module) {
  runCheckAndExit(() => {
    const report = buildOpenapiPlugin(REPOSITORY_ROOT);
    console.error(
      `${PACKAGE_DIRECTORY}/dist: ${report.commonJsModuleCount} ` +
        `CommonJS+declaration files, ${report.esmModuleCount} ESM files`
    );
    return 0;
  });
}
