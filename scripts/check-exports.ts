import { buildRepositoryExportMap } from "./catalog/build-repository-export-map";
import type {
  ExportTarget,
  PackageExportMap,
} from "./catalog/plugin-catalog.types";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { readPublishedExportMap } from "./catalog/read-package-json";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

/**
 * superset: 生成マップが公開済みマップを含んでいること。
 *   ブランチ上でプラグインを足しても package.json を再生成していない状態を許すが、
 *   公開済みサブパスが消えたり指し先が変わったりしたら落ちる。
 * exact: 両者が完全一致していること。ゲートで使う。
 */
export type ExportCheckMode = "superset" | "exact";

export interface ExportMismatch {
  readonly kind: "missing" | "different" | "unpublished";
  readonly subpath: string;
  readonly detail: string;
}

export function findExportMismatches(
  repositoryRoot: string,
  mode: ExportCheckMode
): readonly ExportMismatch[] {
  const generated = buildRepositoryExportMap(repositoryRoot);
  const published = readPublishedExportMap(repositoryRoot);
  const mismatches = Object.entries(published).flatMap(([subpath, target]) =>
    comparePublishedEntry(generated, subpath, target)
  );
  if (mode === "superset") return mismatches;
  const unpublished = Object.keys(generated)
    .filter((subpath) => published[subpath] === undefined)
    .map((subpath) => ({
      kind: "unpublished" as const,
      subpath,
      detail: "生成されているのに package.json#/exports にありません",
    }));
  return [...mismatches, ...unpublished];
}

function comparePublishedEntry(
  generated: PackageExportMap,
  subpath: string,
  target: ExportTarget
): ExportMismatch[] {
  const expected = generated[subpath];
  if (expected === undefined) {
    return [
      {
        kind: "missing",
        subpath,
        detail: "公開済みなのにカタログから生成されません",
      },
    ];
  }
  if (JSON.stringify(expected) !== JSON.stringify(target)) {
    return [
      {
        kind: "different",
        subpath,
        detail: `期待 ${JSON.stringify(expected)} / 実際 ${JSON.stringify(target)}`,
      },
    ];
  }
  return [];
}

export function parseExportCheckMode(argv: readonly string[]): ExportCheckMode {
  const flag = argv.find((argument) => argument.startsWith("--mode="));
  const mode = flag === undefined ? "superset" : flag.slice("--mode=".length);
  if (mode !== "superset" && mode !== "exact") {
    throw new Error(`--mode は superset か exact です (received: ${mode})`);
  }
  return mode;
}

if (require.main === module) {
  runCheckAndExit(() => {
    const mode = parseExportCheckMode(process.argv.slice(2));
    const mismatches = findExportMismatches(REPOSITORY_ROOT, mode);
    if (mismatches.length === 0) {
      console.error(`exports 検査 (--mode=${mode}): 違反なし`);
      return 0;
    }
    console.error(`exports 検査 (--mode=${mode}) 違反 ${mismatches.length} 件:`);
    for (const mismatch of mismatches) {
      console.error(`  ${mismatch.subpath}: ${mismatch.detail}`);
    }
    return 1;
  });
}
