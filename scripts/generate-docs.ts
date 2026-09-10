// ===========================================================================
// scripts/generate-docs.ts
//
// Builds, from the real thing, the tables that always drift when written by
// hand. One output so far: the plugin reference, listing each plugin's
// subpath, symbol, chain method, slots and stage.
//
// The source is the values the built package actually exports — not a comment
// in the source, and not a design document. A method that exists in the
// documentation and not in the implementation is therefore unwritable. The
// previous major generated its plugin list by scraping JSDoc, and it was
// wrong by exactly as much as the annotations had drifted.
//
//   npm run generate-docs              write them out
//   npm run generate-docs -- --check   exit 1 if they differ (for CI)
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

/** The generated documents. Add one here. */
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
    console.error(`Generated: ${document.outputPath}`);
  }
  return 0;
}

/** Compares without writing. This is what CI runs. */
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
      `Generated docs: ${String(documents.length)} documents, all current`
    );
    return 0;
  }
  console.error(`Generated docs: ${String(stale.length)} are stale:`);
  for (const outputPath of stale) console.error(`  ${outputPath}`);
  console.error("Run npm run generate-docs and commit the difference.");
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
