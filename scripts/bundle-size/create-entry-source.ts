import type {
  PluginCatalog,
  PluginCatalogEntry,
} from "../catalog/plugin-catalog.types";
import { PLUGIN_BARREL_OUTPUT } from "../catalog/plugin-source-roots";
import type { PluginSelection } from "./size-budget.types";

/**
 * 大きさを測るための合成入口を組み立てる。
 *
 * 入口は「名前を挙げたシンボルだけを再 export するモジュール」にする。
 * こうすると esbuild が残すのは挙げた名前から到達できるコードだけになり、
 * 測っているものが「この import を書いた利用者が払う量」と一致する。
 * アプリを書いて測る方式より、何を測ったかが読んで分かる。
 */
const CORE_ENTRY_MODULE = "./src/index";

const BARREL_MODULE = `./${PLUGIN_BARREL_OUTPUT.replace(/\.ts$/, "")}`;

/** プラグインを1つも使わない利用者が払う床。Builder から到達できるもの。 */
export function createCoreEntrySource(): string {
  return `export { Builder } from "${CORE_ENTRY_MODULE}";\n`;
}

export function selectCatalogEntries(
  catalog: PluginCatalog,
  selection: PluginSelection
): readonly PluginCatalogEntry[] {
  if (selection === "all") return catalog.entries;
  return selection.map((subpathName) => {
    const found = catalog.entries.find(
      (entry) => entry.subpathName === subpathName
    );
    if (found === undefined) {
      throw new Error(
        `プラグイン "${subpathName}" はカタログにありません。` +
          `config/size-budget.json の綴りを確認してください。`
      );
    }
    return found;
  });
}

/** 深いサブパス (@maroonedog/luq/plugins/<name>) から個別に import した形。 */
export function createSubpathEntrySource(
  catalog: PluginCatalog,
  selection: PluginSelection
): string {
  const lines = selectCatalogEntries(catalog, selection).map(
    (entry) =>
      `export { ${entry.exportedSymbols.join(", ")} } from ` +
      `"./${entry.entryFile.replace(/\.ts$/, "")}";`
  );
  return [createCoreEntrySource(), ...lines, ""].join("\n");
}

/** バレル (@maroonedog/luq/plugins) から名前指定で import した形。 */
export function createBarrelEntrySource(
  catalog: PluginCatalog,
  selection: PluginSelection
): string {
  const symbols = selectCatalogEntries(catalog, selection).flatMap(
    (entry) => entry.exportedSymbols
  );
  return (
    createCoreEntrySource() +
    `export { ${symbols.join(", ")} } from "${BARREL_MODULE}";\n`
  );
}
