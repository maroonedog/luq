import type { PluginTier } from "./plugin-catalog.types";

/**
 * The one table mapping a directory name (kebab) to a published subpath name
 * (camel).
 *
 * The rule is the mechanical kebab-to-camel conversion, and a name whose round
 * trip does not come back identical is refused. The overrides exist only where
 * a published name was frozen by an earlier release and therefore has to be
 * declared rather than derived.
 *
 * A name that round-trips mechanically must NOT be listed here.
 */
export const SUBPATH_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "json-schema": "jsonSchema",
  "json-schema-full-feature": "jsonSchemaFullFeature",
  "read-only-write-only": "readOnlyWriteOnly",
};

const KEBAB_DIRECTORY = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export class IrregularDirectoryNameError extends Error {
  constructor(directoryName: string, reason: string) {
    super(`the plugin directory name "${directoryName}" is invalid: ${reason}`);
    this.name = "IrregularDirectoryNameError";
  }
}

export function toCamelCase(directoryName: string): string {
  return directoryName.replace(/-([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase()
  );
}

export function toKebabCase(subpathName: string): string {
  return subpathName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Decides the published subpath name from the directory name. An extension
 * must be in the override table, its published name being frozen.
 */
export function toSubpathName(
  directoryName: string,
  tier: PluginTier = "isolated"
): string {
  const override = SUBPATH_NAME_OVERRIDES[directoryName];
  if (override !== undefined) return override;
  if (tier === "extension") {
    throw new IrregularDirectoryNameError(
      directoryName,
      "an extension's published subpath name must be declared in SUBPATH_NAME_OVERRIDES"
    );
  }
  if (!KEBAB_DIRECTORY.test(directoryName)) {
    throw new IrregularDirectoryNameError(
      directoryName,
      "it is not kebab-case"
    );
  }
  const camel = toCamelCase(directoryName);
  const roundTripped = toKebabCase(camel);
  if (roundTripped !== directoryName) {
    throw new IrregularDirectoryNameError(
      directoryName,
      `the kebab/camel round trip does not come back identical ("${camel}" -> "${roundTripped}")`
    );
  }
  return camel;
}
