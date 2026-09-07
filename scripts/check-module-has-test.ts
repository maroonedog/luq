import * as path from "path";
import {
  collectTypeScriptFiles,
  toRepositoryRelativePosix,
} from "./catalog/collect-typescript-files";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { findExercisedModules } from "./module-coverage/find-exercised-modules";

/**
 * index.ts は再 export のみ、*.types.ts は型のみ、*.generated.ts は派生物。
 * いずれも実行時の振る舞いを持たないので、それ自体のテストを要求しない。
 */
export function isTestExemptModule(fileName: string): boolean {
  return (
    fileName === "index.ts" ||
    fileName.endsWith(".types.ts") ||
    fileName.endsWith(".generated.ts")
  );
}

/** src/a/b.ts -> test/unit/a/b.test.ts。違反を報告するときの推奨置き場。 */
export function toSiblingTestPath(sourceRelativePath: string): string {
  const withoutSourceRoot = sourceRelativePath.replace(/^src\//, "");
  return `test/unit/${withoutSourceRoot.replace(/\.ts$/, ".test.ts")}`;
}

export interface ModuleWithoutTest {
  readonly module: string;
  readonly suggestedTest: string;
}

/**
 * カバレッジ率の代わりに構造で担保する。落ちるのは「テストが1つも触っていない」ときだけ。
 *
 * 判定は findExercisedModules に委ねる（規則の説明はそちらのヘッダにある）。
 * 「決められた名前のファイルが在るか」ではなく「実行時テストがそのモジュールに
 * 到達しているか」を見るので、空のスタブでは通らず、テストの置き場も縛らない。
 */
export function findModulesWithoutTest(
  repositoryRoot: string,
  seedFiles?: readonly string[]
): readonly ModuleWithoutTest[] {
  const sourceRoot = path.join(repositoryRoot, "src");
  const exercised = findExercisedModules(repositoryRoot, seedFiles);
  return collectTypeScriptFiles(sourceRoot)
    .filter((absoluteFile) => !isTestExemptModule(path.basename(absoluteFile)))
    .filter((absoluteFile) => !exercised.has(absoluteFile))
    .map((absoluteFile) => {
      const module = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
      return { module, suggestedTest: toSiblingTestPath(module) };
    });
}

if (require.main === module) {
  runCheckAndExit(() => {
    const missing = findModulesWithoutTest(REPOSITORY_ROOT);
    if (missing.length === 0) {
      console.error("モジュール到達検査: 違反なし");
      return 0;
    }
    console.error(
      `実行時テストが到達していないモジュール ${missing.length} 件:`
    );
    for (const entry of missing) {
      console.error(
        `  ${entry.module} — 例えば ${entry.suggestedTest} を書くこと`
      );
    }
    return 1;
  });
}
