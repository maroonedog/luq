import {
  createBarrelEntrySource,
  createCoreEntrySource,
  createSubpathEntrySource,
  selectCatalogEntries,
} from "../../../../scripts/bundle-size/create-entry-source";
import type { PluginCatalog } from "../../../../scripts/catalog/plugin-catalog.types";

const catalog: PluginCatalog = {
  entries: [
    {
      directoryName: "required",
      subpathName: "required",
      tier: "isolated",
      directory: "src/plugins/required",
      entryFile: "src/plugins/required/index.ts",
      exportedSymbols: ["requiredPlugin"],
    },
    {
      directoryName: "read-only",
      subpathName: "readOnly",
      tier: "isolated",
      directory: "src/plugins/read-only",
      entryFile: "src/plugins/read-only/index.ts",
      exportedSymbols: ["readOnlyPlugin", "writeOnlyPlugin"],
    },
  ],
};

describe("createCoreEntrySource", () => {
  it("Builder だけを再 export する。ここが「使わなくても払う床」の定義", () => {
    expect(createCoreEntrySource()).toBe(
      'export { Builder } from "./src/index";\n'
    );
  });
});

describe("selectCatalogEntries", () => {
  it('"all" はカタログ全件', () => {
    expect(selectCatalogEntries(catalog, "all")).toHaveLength(2);
  });

  it("名前を挙げた順に解決する", () => {
    expect(
      selectCatalogEntries(catalog, ["readOnly", "required"]).map(
        (one) => one.subpathName
      )
    ).toEqual(["readOnly", "required"]);
  });

  it("カタログに無い名前は綴りの誤りとして落とす", () => {
    expect(() => selectCatalogEntries(catalog, ["stringMni"])).toThrow(
      /stringMni/
    );
  });
});

describe("createSubpathEntrySource", () => {
  it("深いサブパスの実体ファイルを直接指し、拡張子は落とす", () => {
    const source = createSubpathEntrySource(catalog, ["required"]);
    expect(source).toContain(
      'export { requiredPlugin } from "./src/plugins/required/index";'
    );
    expect(source).not.toContain("index.ts");
  });

  it("1エントリが複数 symbol を出す場合はまとめて挙げる", () => {
    expect(createSubpathEntrySource(catalog, ["readOnly"])).toContain(
      "export { readOnlyPlugin, writeOnlyPlugin } from"
    );
  });

  it("プラグイン0件でも中核だけの入口として成立する", () => {
    expect(createSubpathEntrySource(catalog, [])).toBe(
      `${createCoreEntrySource()}\n`
    );
  });
});

describe("createBarrelEntrySource", () => {
  it("同じ symbol をバレル1本から取る形になる", () => {
    const source = createBarrelEntrySource(catalog, "all");
    expect(source).toContain(
      "export { requiredPlugin, readOnlyPlugin, writeOnlyPlugin } from " +
        '"./src/plugins/index.generated";'
    );
  });

  it("バレル経由とサブパス経由は同じ symbol 集合を挙げる", () => {
    const viaBarrel = createBarrelEntrySource(catalog, "all");
    const viaSubpath = createSubpathEntrySource(catalog, "all");
    for (const symbol of catalog.entries.flatMap(
      (one) => one.exportedSymbols
    )) {
      expect(viaBarrel).toContain(symbol);
      expect(viaSubpath).toContain(symbol);
    }
  });
});
