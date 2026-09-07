import { buildSync } from "esbuild";
import { gzipSync } from "zlib";

/**
 * 合成した入口モジュールを利用者のバンドラと同じ条件で束ねて gzip し、
 * その大きさを返す唯一の場所。
 *
 * 測る対象は dist ではなく src (TypeScript ソース) である。理由は2つ:
 * 公開パッケージは「1ソースファイル = 1出力モジュール」の未束ね ESM として
 * 配るので、実際に木を歩いて捨てるのは利用者のバンドラであり、ここで
 * esbuild に歩かせる木と同じものだから。そしてもう1つ、リポジトリに
 * 残っている dist/ は旧実装の生成物で、これを測ると旧実装の数字が出るから。
 *
 * オプションは旧実装の bundle-size-comparison/build-all.js と同一にしてある
 * (bundle/minify/esm/es2020/neutral/treeShaking)。そうしないと旧実装の
 * 19-23KB という主張と比較できない。
 */
export interface GzippedBundleSize {
  readonly rawBytes: number;
  readonly gzipBytes: number;
}

export const BUNDLE_ENTRY_FILE_NAME = "size-budget-entry.ts";

export function measureGzippedBundle(
  repositoryRoot: string,
  entrySource: string
): GzippedBundleSize {
  const built = buildSync({
    stdin: {
      contents: entrySource,
      resolveDir: repositoryRoot,
      sourcefile: BUNDLE_ENTRY_FILE_NAME,
      loader: "ts",
    },
    bundle: true,
    minify: true,
    format: "esm",
    target: "es2020",
    platform: "neutral",
    treeShaking: true,
    legalComments: "none",
    write: false,
  });
  const [outputFile] = built.outputFiles;
  if (outputFile === undefined) {
    throw new Error("esbuild が出力を返しませんでした");
  }
  const bytes = Buffer.from(outputFile.contents);
  return { rawBytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}
