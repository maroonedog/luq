import { buildSync } from "esbuild";
import { gzipSync } from "zlib";

/**
 * The one place a synthetic entry module is bundled under the same conditions
 * a user's bundler would use, gzipped, and measured.
 *
 * It measures src, the TypeScript sources, and not dist. The package ships as
 * unbundled ESM, one module per source file, so the tree actually walked and
 * pruned belongs to the user's bundler — the same tree esbuild walks here.
 *
 * The options match the previous major's own comparison build, without which
 * its published size claim cannot be compared against.
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
    throw new Error("esbuild returned no output");
  }
  const bytes = Buffer.from(outputFile.contents);
  return { rawBytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}
