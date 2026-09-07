// ===========================================================================
// scripts/generate-docs.ts
//
// 手で書くと必ずずれる表を、実体から作る。今のところ生成物は1つ:
//   docs/guide/plugin-reference.md — 76ディレクトリ / 77シンボルの
//   サブパス・シンボル・チェーンメソッド・スロット・段。
//
// 出どころはビルド済みの dist/plugins/*.js が実際に export した値であって、
// ソースのコメントでも設計文書でもない。だから「ドキュメントにはあるが実装には
// 無いメソッド」を書きようがない。1.x の docs/generated/plugins.md は
// JSDoc 注釈を舐めて作られており、注釈が実装から外れた分だけ嘘になっていた。
//
//   npm run generate-docs          書き出す
//   npm run generate-docs -- --check   ずれていたら exit 1 (CI 用)
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import { readPluginSurface } from "./doc-generation/read-plugin-surface";
import { renderPluginReference } from "./doc-generation/render-plugin-reference";

export const PLUGIN_REFERENCE_OUTPUT = "docs/guide/plugin-reference.md";

export interface GeneratedDocument {
  readonly outputPath: string;
  readonly contents: string;
}

/** 生成物の一覧。増えたらここに足す。 */
export function generateDocuments(
  repositoryRoot: string
): readonly GeneratedDocument[] {
  return [
    {
      outputPath: PLUGIN_REFERENCE_OUTPUT,
      contents: renderPluginReference(readPluginSurface(repositoryRoot)),
    },
  ];
}

function readIfPresent(absolutePath: string): string | null {
  return fs.existsSync(absolutePath)
    ? fs.readFileSync(absolutePath, "utf8")
    : null;
}

function writeDocuments(
  repositoryRoot: string,
  documents: readonly GeneratedDocument[]
): number {
  for (const document of documents) {
    const absolutePath = path.join(repositoryRoot, document.outputPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, document.contents, "utf8");
    console.error(`生成: ${document.outputPath}`);
  }
  return 0;
}

/** 書き出さずに突き合わせるだけ。CI はこちらを回す。 */
export function findStaleDocuments(
  repositoryRoot: string,
  documents: readonly GeneratedDocument[]
): readonly string[] {
  return documents
    .filter((document) => {
      const onDisk = readIfPresent(
        path.join(repositoryRoot, document.outputPath)
      );
      return onDisk !== document.contents;
    })
    .map((document) => document.outputPath);
}

function checkDocuments(
  repositoryRoot: string,
  documents: readonly GeneratedDocument[]
): number {
  const stale = findStaleDocuments(repositoryRoot, documents);
  if (stale.length === 0) {
    console.error(
      `生成ドキュメント検査: ${String(documents.length)} 件、すべて最新`
    );
    return 0;
  }
  console.error(`生成ドキュメントが古い ${String(stale.length)} 件:`);
  for (const outputPath of stale) console.error(`  ${outputPath}`);
  console.error("npm run generate-docs を実行して差分をコミットしてください。");
  return 1;
}

if (require.main === module) {
  runCheckAndExit(() => {
    const documents = generateDocuments(REPOSITORY_ROOT);
    return process.argv.includes("--check")
      ? checkDocuments(REPOSITORY_ROOT, documents)
      : writeDocuments(REPOSITORY_ROOT, documents);
  });
}
