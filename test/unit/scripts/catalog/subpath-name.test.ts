import {
  IrregularDirectoryNameError,
  SUBPATH_NAME_OVERRIDES,
  toKebabCase,
  toSubpathName,
} from "../../../../scripts/catalog/subpath-name";

describe("SUBPATH_NAME_OVERRIDES", () => {
  it("has exactly three overrides", () => {
    expect(Object.keys(SUBPATH_NAME_OVERRIDES).sort()).toEqual([
      "json-schema",
      "json-schema-full-feature",
      "read-only-write-only",
    ]);
  });

  it("deliberately leaves uuid out of the override table", () => {
    expect(Object.keys(SUBPATH_NAME_OVERRIDES)).not.toContain("uuid");
    expect(Object.values(SUBPATH_NAME_OVERRIDES)).not.toContain("uuid");
  });

  it("round-trips uuid mechanically", () => {
    expect(toSubpathName("uuid")).toBe("uuid");
    expect(toKebabCase("uuid")).toBe("uuid");
  });
});

describe("toSubpathName", () => {
  const regularPairs: readonly (readonly [string, string])[] = [
    ["required", "required"],
    ["string-min", "stringMin"],
    ["string-content-media-type", "stringContentMediaType"],
    ["string-ipv4", "stringIpv4"],
    ["string-base64", "stringBase64"],
    ["object-dependent-required", "objectDependentRequired"],
    ["read-only", "readOnly"],
    ["tuple-builder", "tupleBuilder"],
  ];

  it.each(regularPairs)("%s -> %s", (directoryName, subpathName) => {
    expect(toSubpathName(directoryName)).toBe(subpathName);
  });

  it.each(regularPairs)(
    "brings %s back from camel to kebab",
    (directoryName) => {
      expect(toKebabCase(toSubpathName(directoryName))).toBe(directoryName);
    }
  );

  const irregularNames: readonly string[] = [
    "not_kebab",
    "NotKebab",
    "String-Min",
    "-leading",
    "trailing-",
    "double--dash",
    "1-leading-digit",
  ];

  it.each(irregularNames)(
    "fails %s, whose round trip does not come back",
    (directoryName) => {
      expect(() => toSubpathName(directoryName)).toThrow(
        IrregularDirectoryNameError
      );
    }
  );

  it("fails a name whose camel form does not return to the same kebab", () => {
    // "string-base-64" -> "stringBase64" -> "string-base64", which differs.
    expect(() => toSubpathName("string-base-64")).toThrow(
      /round trip does not come back identical/
    );
  });

  it("fails an extension that is not declared in the override table", () => {
    expect(toSubpathName("json-schema", "extension")).toBe("jsonSchema");
    expect(toSubpathName("json-schema-full-feature", "extension")).toBe(
      "jsonSchemaFullFeature"
    );
    expect(() => toSubpathName("open-api", "extension")).toThrow(
      IrregularDirectoryNameError
    );
  });
});
