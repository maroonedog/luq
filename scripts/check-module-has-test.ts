import * as fs from "fs";
import * as path from "path";
import {
  collectTypeScriptFiles,
  toRepositoryRelativePosix,
} from "./catalog/collect-typescript-files";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/**
 * index.ts は再 export のみ、*.types.ts は型のみ、*.generated.ts は派生物。
 * いずれも実行時の振る舞いを持たないので兄弟テストを要求しない。
 */
export function isTestExemptModule(fileName: string): boolean {
  return (
    fileName === "index.ts" ||
    fileName.endsWith(".types.ts") ||
    fileName.endsWith(".generated.ts")
  );
}

/** src/a/b.ts -> test/unit/a/b.test.ts */
export function toSiblingTestPath(sourceRelativePath: string): string {
  const withoutSourceRoot = sourceRelativePath.replace(/^src\//, "");
  return `test/unit/${withoutSourceRoot.replace(/\.ts$/, ".test.ts")}`;
}

export interface ModuleWithoutTest {
  readonly module: string;
  readonly expectedTest: string;
}

/** カバレッジ率の代わりに構造で担保する。落ちるのは「テストが1つも無い」ときだけ。 */
export function findModulesWithoutTest(
  repositoryRoot: string
): readonly ModuleWithoutTest[] {
  const sourceRoot = path.join(repositoryRoot, "src");
  return collectTypeScriptFiles(sourceRoot)
    .filter((absoluteFile) => !isTestExemptModule(path.basename(absoluteFile)))
    .map((absoluteFile) => {
      const module = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
      return { module, expectedTest: toSiblingTestPath(module) };
    })
    .filter(
      (candidate) =>
        !fs.existsSync(path.join(repositoryRoot, candidate.expectedTest))
    );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const missing = findModulesWithoutTest(REPOSITORY_ROOT);
    if (missing.length === 0) {
      console.error("兄弟テスト検査: 違反なし");
      return 0;
    }
    console.error(`兄弟テストが無いモジュール ${missing.length} 件:`);
    for (const entry of missing) {
      console.error(`  ${entry.module} -> ${entry.expectedTest} がありません`);
    }
    return 1;
  });
}
