import * as fs from "fs";
import * as path from "path";
import type { SubpathAlias } from "./plugin-catalog.types";
import { SUBPATH_ALIASES } from "./plugin-source-roots";

export const SUBPATH_ALIAS_DIRECTORY = "src/subpath-aliases";

/**
 * 互換エイリアスは、その互換モジュールが実在するときだけ公開サブパスになる。
 * まだ存在しない転送先を exports に書くと、解決できないサブパスを公開してしまう。
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
