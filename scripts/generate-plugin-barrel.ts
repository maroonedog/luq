import * as path from "path";
import { buildPluginCatalog } from "./catalog/build-plugin-catalog";
import type {
  PluginCatalog,
  PluginCatalogEntry,
} from "./catalog/plugin-catalog.types";
import {
  PLUGIN_BARREL_OUTPUT,
  REPOSITORY_ROOT,
} from "./catalog/plugin-source-roots";
import {
  GENERATED_BANNER,
  writeGeneratedFile,
} from "./catalog/write-generated-file";
import { runCheckAndExit } from "./catalog/run-check-and-exit";

const BARREL_DIRECTORY = path.posix.dirname(PLUGIN_BARREL_OUTPUT);

function toRelativeSpecifier(entry: PluginCatalogEntry): string {
  const relative = path.posix.relative(BARREL_DIRECTORY, entry.directory);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/**
 * 全プラグインを1箇所から再 export する barrel (公開サブパス "./plugins" の実体)。
 * 名前はカタログがエントリファイルから実際に読んだシンボルだけなので、
 * 存在しない symbol を書けない。旧実装の「barrel 72 / exports 57」の乖離はここで消える。
 */
export function renderPluginBarrel(catalog: PluginCatalog): string {
  if (catalog.entries.length === 0) {
    return [GENERATED_BANNER, "", "export {};", ""].join("\n");
  }
  const lines = catalog.entries.flatMap((entry) =>
    entry.exportedSymbols.map(
      (symbol) => `export { ${symbol} } from "${toRelativeSpecifier(entry)}";`
    )
  );
  return [GENERATED_BANNER, "", ...lines, ""].join("\n");
}

export function generatePluginBarrel(repositoryRoot: string): boolean {
  return writeGeneratedFile(
    repositoryRoot,
    PLUGIN_BARREL_OUTPUT,
    renderPluginBarrel(buildPluginCatalog(repositoryRoot))
  );
}

if (require.main === module) {
  runCheckAndExit(() => {
    const changed = generatePluginBarrel(REPOSITORY_ROOT);
    console.error(
      `${PLUGIN_BARREL_OUTPUT}: ${changed ? "更新しました" : "変更なし"}`
    );
    return 0;
  });
}
