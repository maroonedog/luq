import * as path from "path";
import {
  CJS_EXTENSION,
  DECLARATION_EXTENSION,
  ESM_EXTENSION,
  writeFileCreatingDirectories,
} from "./dist-layout";
import type { SubpathEntry } from "./subpath-entry-sources";

/**
 * A published subpath name is camelCase (`./plugins/stringMin`) while the
 * module that implements it is kebab-case (`plugins/string-min/index`), so
 * most keys need a one-line entry file that forwards to exactly one module.
 *
 * "Exactly one" is the rule that keeps the tree-shaking claim true: a subpath
 * entry that named several modules would make all of them reachable from one
 * import. A key whose stem already IS the module (the root `.`) gets no file.
 */
export function writeSubpathEntries(
  distRoot: string,
  entries: readonly SubpathEntry[]
): readonly string[] {
  return entries
    .filter((entry) => entry.distBase !== entry.moduleBase)
    .flatMap((entry) => writeOneSubpathEntry(distRoot, entry));
}

function writeOneSubpathEntry(
  distRoot: string,
  entry: SubpathEntry
): readonly string[] {
  const specifier = toForwardingSpecifier(entry);
  const written: [string, string][] = [
    [`${entry.distBase}${ESM_EXTENSION}`, renderEsmEntry(specifier)],
    [`${entry.distBase}${CJS_EXTENSION}`, renderCjsEntry(specifier)],
    [
      `${entry.distBase}${DECLARATION_EXTENSION}`,
      renderDeclarationEntry(specifier),
    ],
  ];
  for (const [file, contents] of written) {
    writeFileCreatingDirectories(path.join(distRoot, file), contents);
  }
  return written.map(([file]) => file);
}

/** Both stems are dist-relative posix paths, so the hop between them is too. */
export function toForwardingSpecifier(entry: SubpathEntry): string {
  const fromDirectory = path.posix.dirname(entry.distBase);
  const relative = path.posix.relative(fromDirectory, entry.moduleBase);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function renderEsmEntry(specifier: string): string {
  return `export * from "${specifier}${ESM_EXTENSION}";\n`;
}

function renderCjsEntry(specifier: string): string {
  return `"use strict";\nmodule.exports = require("${specifier}");\n`;
}

function renderDeclarationEntry(specifier: string): string {
  return `export * from "${specifier}";\n`;
}
