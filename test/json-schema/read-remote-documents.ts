// ===========================================================================
// test/json-schema/read-remote-documents.ts
//
// Reads the schemas the suite serves over HTTP **from disk** and turns them
// into a map.
//
// This is harness code, not library code, and that is the point: the library
// resolves an external `$ref` only against documents the caller handed it. So
// the suite's external references pass **without touching the network at all**.
// Fetching is the caller's job, and here the caller's fetching happens to be a
// file system.
//
// The suite's remotes directory mirrors the URL paths, so a relative path
// reads directly as a URL.
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { repositoryRoot } from "./read-suite-corpus";

/** The origin the suite serves from. Everything in remotes hangs under it. */
const REMOTES_ORIGIN = "http://localhost:1234";

function listJsonFiles(directory: string): readonly string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

function toUrl(remotesRoot: string, file: string): string {
  const relative = path.relative(remotesRoot, file).split(path.sep).join("/");
  return `${REMOTES_ORIGIN}/${relative}`;
}

/**
 * The map from each served URL to its document.
 *
 * Unreadable JSON is dropped in silence. The corpus contains schemas for other
 * drafts too, and letting one of them cost every external reference its
 * measurement is not a good trade.
 */
/**
 * The Draft-07 meta-schema, which cases in the corpus reference directly. It
 * is not in the suite's remotes, and every official harness registers it
 * itself — so does this one.
 *
 * The file is kept in this repository's fixtures. It could have been read out
 * of a dev dependency's node_modules, but hanging the conformance figure on
 * another package's internal layout is not a good trade.
 */
const METASCHEMA_URI = "http://json-schema.org/draft-07/schema";

function readMetaschema(): Readonly<Record<string, unknown>> {
  const file = path.join(
    repositoryRoot(),
    "test",
    "fixtures",
    "well-known",
    "json-schema-draft-07.json"
  );
  if (!fs.existsSync(file)) return {};
  try {
    return { [METASCHEMA_URI]: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return {};
  }
}

export function readRemoteDocuments(): Readonly<Record<string, unknown>> {
  const remotesRoot = path.join(
    repositoryRoot(),
    "test",
    "fixtures",
    "json-schema-suite",
    "remotes"
  );
  const documents: Record<string, unknown> = { ...readMetaschema() };
  for (const file of listJsonFiles(remotesRoot)) {
    try {
      documents[toUrl(remotesRoot, file)] = JSON.parse(
        fs.readFileSync(file, "utf8")
      );
    } catch {
      // Unreadable counts as absent. Referenced, the $ref simply fails.
    }
  }
  return Object.freeze(documents);
}
