// Reads the plugin catalogue out of the repository. Three independent files
// have to agree before anything is returned:
//
//   docs/guide/plugin-reference.md   generated from the BUILT package by
//                                    `npm run generate-docs`, gated by
//                                    `npm run check:docs` — subpath, symbol,
//                                    chain method, slots and tier come from here
//   config/plugin-catalog.lock.json  the locked subpath list, checked by
//                                    test/integration/plugin-catalog.test.ts
//   src/plugins/manifest.generated.ts  where each plugin's source lives, so the
//                                    declared argument tuple can be read off it
//
// Nothing in this file is typed by hand, so the docs site cannot drift away
// from the package the way the 1.x data file did (69 of 77 plugins, 13 wrong
// method names, 8 wrong slot lists).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** What `every slot` in the reference table stands for. */
export const EVERY_SLOT = [
  "string",
  "number",
  "boolean",
  "date",
  "array",
  "tuple",
  "object",
  "union",
  "any",
];

const REFERENCE_ROW =
  /^\| `\.\/plugins\/(\w+)` \| `(\w+)` \| `\.(\w+)\(\)` \| (.+?) \| (isolated|extension) \|$/;

const MANIFEST_ENTRY =
  /\{ directoryName: "([^"]+)", subpathName: "([^"]+)", tier: "([^"]+)", entryFile: "([^"]+)", exportedSymbols: \[([^\]]+)\] \}/g;

function readReferenceRows(repositoryRoot) {
  const source = readFileSync(
    join(repositoryRoot, "docs/guide/plugin-reference.md"),
    "utf8"
  );
  const mainTable = source.split("## Deprecated alias subpaths")[0];
  const rows = [];
  for (const line of mainTable.split(/\r?\n/)) {
    const matched = REFERENCE_ROW.exec(line);
    if (matched === null) continue;
    rows.push({
      name: matched[1],
      symbol: matched[2],
      method: matched[3],
      slots: readSlots(matched[4]),
      tier: matched[5],
    });
  }
  if (rows.length === 0) {
    throw new Error("plugin-reference.md: no rows matched the expected shape");
  }
  return rows;
}

function readSlots(cell) {
  if (cell.trim() === "every slot") return [...EVERY_SLOT];
  const slots = [...cell.matchAll(/`(\w+)`/g)].map((match) => match[1]);
  if (slots.length === 0) throw new Error(`unreadable slot cell: ${cell}`);
  return slots;
}

function readLockedSubpaths(repositoryRoot) {
  const lock = JSON.parse(
    readFileSync(
      join(repositoryRoot, "config/plugin-catalog.lock.json"),
      "utf8"
    )
  );
  return {
    pluginCount: lock.pluginCount,
    names: lock.plugins.map((entry) => entry.subpath.replace("./plugins/", "")),
  };
}

function readManifestDirectories(repositoryRoot) {
  const source = readFileSync(
    join(repositoryRoot, "src/plugins/manifest.generated.ts"),
    "utf8"
  );
  const directories = new Map();
  for (const matched of source.matchAll(MANIFEST_ENTRY)) {
    directories.set(matched[2], matched[4].replace(/\/index\.ts$/, ""));
  }
  if (directories.size === 0) {
    throw new Error("manifest.generated.ts: no entries matched");
  }
  return directories;
}

/** Balanced-bracket slice starting at the `[` at or after `from`. */
function sliceBracketed(source, from) {
  const start = source.indexOf("[", from);
  if (start < 0) return "";
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "[") depth += 1;
    else if (source[index] === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  return "";
}

function splitTopLevel(source) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of source) {
    if ("[({<".includes(character)) depth += 1;
    else if ("])}>".includes(character)) depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== "");
}

function readParameters(directorySource, symbol) {
  const declaration = directorySource.indexOf(`export const ${symbol} =`);
  if (declaration < 0) return undefined;
  const argumentsAt = directorySource.indexOf("args:", declaration);
  const buildAt = directorySource.indexOf("build:", declaration);
  if (argumentsAt < 0 || (buildAt >= 0 && argumentsAt > buildAt))
    return undefined;
  return splitTopLevel(sliceBracketed(directorySource, argumentsAt)).map(
    (part) => {
      const separator = part.indexOf(":");
      const name = part.slice(0, separator).trim();
      return {
        name: name.replace(/\?$/, ""),
        type: part.slice(separator + 1).trim(),
        optional: name.endsWith("?"),
      };
    }
  );
}

function readDirectorySource(repositoryRoot, directory) {
  const absolute = join(repositoryRoot, directory);
  return readdirSync(absolute)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => readFileSync(join(absolute, file), "utf8"))
    .join("\n");
}

/**
 * @returns {{ name: string, symbol: string, method: string, slots: string[],
 *   tier: string, directory: string,
 *   parameters: { name: string, type: string, optional: boolean }[] }[]}
 */
export function readPluginCatalog(repositoryRoot) {
  const rows = readReferenceRows(repositoryRoot);
  const locked = readLockedSubpaths(repositoryRoot);
  const directories = readManifestDirectories(repositoryRoot);

  const referenced = new Set(rows.map((row) => row.name));
  const missing = locked.names.filter((name) => !referenced.has(name));
  if (missing.length > 0) {
    throw new Error(
      `plugin-catalog.lock.json lists subpaths the reference table does not: ${missing.join(", ")}`
    );
  }
  if (referenced.size !== locked.pluginCount) {
    throw new Error(
      `subpath count disagrees: reference ${referenced.size}, lock ${locked.pluginCount}`
    );
  }

  const sourceCache = new Map();
  return rows.map((row) => {
    const directory = directories.get(row.name);
    if (directory === undefined) {
      throw new Error(`${row.name}: no directory in manifest.generated.ts`);
    }
    if (!sourceCache.has(directory)) {
      sourceCache.set(
        directory,
        readDirectorySource(repositoryRoot, directory)
      );
    }
    const parameters = readParameters(sourceCache.get(directory), row.symbol);
    if (parameters === undefined) {
      throw new Error(
        `${row.symbol}: no declared argument tuple in ${directory}`
      );
    }
    return { ...row, directory, parameters };
  });
}
