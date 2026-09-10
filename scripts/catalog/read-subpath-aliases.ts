import * as fs from "fs";
import * as path from "path";
import type { SubpathAlias } from "./plugin-catalog.types";
import { SUBPATH_ALIASES } from "./plugin-source-roots";

export const SUBPATH_ALIAS_DIRECTORY = "src/subpath-aliases";

/**
 * A compatibility alias becomes a published subpath only when its module
 * actually exists. Writing a target that does not exist yet into the exports
 * map publishes a subpath that cannot resolve.
 */
export function readSubpathAliases(
  repositoryRoot: string,
  aliases: readonly SubpathAlias[] = SUBPATH_ALIASES
): readonly SubpathAlias[] {
  return aliases.filter((alias) =>
    fs.existsSync(
      path.join(
        repositoryRoot,
        SUBPATH_ALIAS_DIRECTORY,
        `${alias.moduleName}.ts`
      )
    )
  );
}
