// ===========================================================================
// PLUGIN_KEYWORDS はプラグイン名を文字列で持っている。バンドルに 30 個の
// プラグインを引き込まないためだが、その代償として綴りずれをコンパイラが
// 見てくれない。ここが実物と突き合わせる。
//
// 実物は config/plugin-catalog.lock.json が数えている全プラグインで、
// テストなのでバイト数を気にせず全部読み込める。名前を1つ変えれば
// このテストが落ちる — 費用を払わずに漂流を止める側に寄せている。
// ===========================================================================
import catalog from "../../../config/plugin-catalog.lock.json";
import { PLUGIN_KEYWORDS } from "../../../src/standard-schema/plugin-keyword-map";

interface CatalogEntry {
  readonly directory: string;
}

function isNamedPlugin(value: unknown): value is { readonly name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { build?: unknown }).build === "function"
  );
}

/** 全プラグインの `name`。カタログが数えている実物から集める。 */
function everyPluginName(): ReadonlySet<string> {
  const names = new Set<string>();
  for (const entry of catalog.plugins as readonly CatalogEntry[]) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module: unknown = require(`../../../${entry.directory}`);
    for (const exported of Object.values(module as Record<string, unknown>)) {
      if (isNamedPlugin(exported)) names.add(exported.name);
    }
  }
  return names;
}

describe("PLUGIN_KEYWORDS names real plugins", () => {
  it("reads a non-empty catalog, so an empty set cannot pass the next test", () => {
    expect(everyPluginName().size).toBeGreaterThan(60);
  });

  it("has no key that is not a plugin name", () => {
    const known = everyPluginName();
    const unknownKeys = Object.keys(PLUGIN_KEYWORDS).filter(
      (name) => !known.has(name)
    );
    expect(unknownKeys).toEqual([]);
  });
});

describe("the argument shapes each entry expects", () => {
  it("reads the exclusive flag of .min() / .max() the way the reader writes it", () => {
    // keyword-map-number.ts が exclusiveMinimum を [v, true] に写している。
    // 逆向きがその境目を取り違えると、境界が 1 つずれたスキーマが出る。
    expect(PLUGIN_KEYWORDS["numberMin"]?.([5])).toEqual({ minimum: 5 });
    expect(PLUGIN_KEYWORDS["numberMin"]?.([5, true])).toEqual({
      exclusiveMinimum: 5,
    });
    expect(PLUGIN_KEYWORDS["numberMax"]?.([5, true])).toEqual({
      exclusiveMaximum: 5,
    });
  });

  it("writes a pattern as its ECMA-262 source, not as a RegExp", () => {
    expect(PLUGIN_KEYWORDS["stringPattern"]?.([/^a.c$/])).toEqual({
      pattern: "^a.c$",
    });
  });

  it("returns null for the declarations the type and required side handles", () => {
    for (const name of ["required", "optional", "nullable", "numberInteger"]) {
      expect(PLUGIN_KEYWORDS[name]?.([])).toBeNull();
    }
  });
});
