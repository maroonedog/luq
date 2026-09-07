// ===========================================================================
// bench/legacy/load-legacy-entry.ts
//
// Loads 1.x's entry point and plugin modules out of the extracted sources, and
// REFUSES anything that is not recognisably 1.x.
//
// The fingerprint is the whole point. 1.x's index exported `Result`,
// `plugin`, `pluginBuilderExtension` and `createPluginRegistry`; the rewrite
// exports none of those four (its entry was frozen at the contract gate to
// Builder / createBuilder / the vocabulary / the plugin-author surface). So a
// module that offers `Builder` but not those four is the CURRENT library, and
// measuring it as "1.x" would produce a speedup of 1.0 and a conclusion that
// nothing changed. This guard is the reason that cannot happen again — the
// first version of this harness did exactly that for a full recording run.
// ===========================================================================
import { existsSync } from "fs";
import { join } from "path";
import type {
  LegacyEntryPoint,
  LegacyUnavailableCause,
} from "./legacy-build.types";

/** Symbols 1.x published and the rewrite deliberately does not. */
const LEGACY_ONLY_EXPORTS: readonly string[] = [
  "Result",
  "plugin",
  "pluginBuilderExtension",
  "createPluginRegistry",
];

export interface LegacyEntryLoaded {
  readonly available: true;
  readonly entry: LegacyEntryPoint;
  readonly loadPlugin: (fileName: string) => Record<string, unknown>;
}

export interface LegacyEntryAbsent {
  readonly available: false;
  readonly cause: LegacyUnavailableCause;
  readonly detail: string;
}

export type LegacyEntry = LegacyEntryLoaded | LegacyEntryAbsent;

function isModuleRecord(loaded: unknown): loaded is Record<string, unknown> {
  return typeof loaded === "object" && loaded !== null;
}

function hasBuilder(
  loaded: Record<string, unknown>
): loaded is Record<string, unknown> & LegacyEntryPoint {
  return typeof loaded["Builder"] === "function";
}

function findMissingFingerprint(
  loaded: Record<string, unknown>
): readonly string[] {
  return LEGACY_ONLY_EXPORTS.filter((name) => loaded[name] === undefined);
}

/**
 * @param sourceRoot the extracted `<ref>:src` directory.
 * Requires .ts files, so the calling process must have ts-node registered in
 * transpile-only mode: the 1.x sources do not typecheck under the rewritten
 * repo's true-strict tsconfig, and typechecking them is not what is measured.
 */
export function loadLegacyEntry(sourceRoot: string): LegacyEntry {
  const entryPath = join(sourceRoot, "index.ts");
  if (!existsSync(entryPath)) {
    return {
      available: false,
      cause: "dist-missing",
      detail: `${entryPath} does not exist`,
    };
  }

  const loaded: unknown = require(entryPath);
  if (!isModuleRecord(loaded) || !hasBuilder(loaded)) {
    return {
      available: false,
      cause: "entry-not-loadable",
      detail: `${entryPath} does not export Builder`,
    };
  }

  const missing = findMissingFingerprint(loaded);
  if (missing.length > 0) {
    return {
      available: false,
      cause: "not-the-legacy-implementation",
      detail: `${entryPath} exports Builder but is missing 1.x-only exports (${missing.join(", ")}); this is the CURRENT implementation, not 1.x`,
    };
  }

  return {
    available: true,
    entry: loaded,
    loadPlugin: (fileName: string) => {
      const pluginPath = join(sourceRoot, "core", "plugin", `${fileName}.ts`);
      if (!existsSync(pluginPath)) {
        throw new Error(`1.x plugin module missing: ${pluginPath}`);
      }
      const pluginModule: unknown = require(pluginPath);
      if (!isModuleRecord(pluginModule)) {
        throw new Error(`1.x plugin module is not a module: ${pluginPath}`);
      }
      return pluginModule;
    },
  };
}
