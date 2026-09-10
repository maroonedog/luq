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
  it("re-exports Builder alone, which is the definition of the floor", () => {
    expect(createCoreEntrySource()).toBe(
      'export { Builder } from "./src/index";\n'
    );
  });
});

describe("selectCatalogEntries", () => {
  it('resolves "all" to every catalog entry', () => {
    expect(selectCatalogEntries(catalog, "all")).toHaveLength(2);
  });

  it("resolves the names in the order given", () => {
    expect(
      selectCatalogEntries(catalog, ["readOnly", "required"]).map(
        (one) => one.subpathName
      )
    ).toEqual(["readOnly", "required"]);
  });

  it("fails a name absent from the catalog, as a misspelling", () => {
    expect(() => selectCatalogEntries(catalog, ["stringMni"])).toThrow(
      /stringMni/
    );
  });
});

describe("createSubpathEntrySource", () => {
  it("points straight at a deep subpath's real file, without the extension", () => {
    const source = createSubpathEntrySource(catalog, ["required"]);
    expect(source).toContain(
      'export { requiredPlugin } from "./src/plugins/required/index";'
    );
    expect(source).not.toContain("index.ts");
  });

  it("lists them together when one entry exports several symbols", () => {
    expect(createSubpathEntrySource(catalog, ["readOnly"])).toContain(
      "export { readOnlyPlugin, writeOnlyPlugin } from"
    );
  });

  it("still forms a core-only entry with no plugins at all", () => {
    expect(createSubpathEntrySource(catalog, [])).toBe(
      `${createCoreEntrySource()}\n`
    );
  });
});

describe("createBarrelEntrySource", () => {
  it("takes the same symbols through the single barrel", () => {
    const source = createBarrelEntrySource(catalog, "all");
    expect(source).toContain(
      "export { requiredPlugin, readOnlyPlugin, writeOnlyPlugin } from " +
        '"./src/plugins/index.generated";'
    );
  });

  it("lists the same set of symbols through the barrel and the subpaths", () => {
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
