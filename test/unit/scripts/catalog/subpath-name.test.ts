import {
  IrregularDirectoryNameError,
  SUBPATH_NAME_OVERRIDES,
  toKebabCase,
  toSubpathName,
} from "../../../../scripts/catalog/subpath-name";

describe("SUBPATH_NAME_OVERRIDES", () => {
  it("上書き表はちょうど3件である", () => {
    expect(Object.keys(SUBPATH_NAME_OVERRIDES).sort()).toEqual([
      "json-schema",
      "json-schema-full-feature",
      "read-only-write-only",
    ]);
  });

  it("uuid は意図的に上書き表に無い", () => {
    expect(Object.keys(SUBPATH_NAME_OVERRIDES)).not.toContain("uuid");
    expect(Object.values(SUBPATH_NAME_OVERRIDES)).not.toContain("uuid");
  });

  it("uuid は機械変換だけで uuid に往復する", () => {
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

  it.each(regularPairs)("%s は camel から kebab に戻る", (directoryName) => {
    expect(toKebabCase(toSubpathName(directoryName))).toBe(directoryName);
  });

  const irregularNames: readonly string[] = [
    "not_kebab",
    "NotKebab",
    "String-Min",
    "-leading",
    "trailing-",
    "double--dash",
    "1-leading-digit",
  ];

  it.each(irregularNames)("%s は往復に失敗して落ちる", (directoryName) => {
    expect(() => toSubpathName(directoryName)).toThrow(
      IrregularDirectoryNameError
    );
  });

  it("camel が同じ kebab に戻らない名前は落ちる", () => {
    // "string-base-64" -> "stringBase64" -> "string-base64" (元と違う)
    expect(() => toSubpathName("string-base-64")).toThrow(
      /round trip does not come back identical/
    );
  });

  it("extension 段は上書き表に宣言されていなければ落ちる", () => {
    expect(toSubpathName("json-schema", "extension")).toBe("jsonSchema");
    expect(toSubpathName("json-schema-full-feature", "extension")).toBe(
      "jsonSchemaFullFeature"
    );
    expect(() => toSubpathName("open-api", "extension")).toThrow(
      IrregularDirectoryNameError
    );
  });
});
