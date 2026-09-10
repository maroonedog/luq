import {
  renderJsonValue,
  spliceJsonMember,
} from "../../../../scripts/catalog/splice-json-member";

const ORIGINAL = [
  "{",
  '  "name": "@maroonedog/luq",',
  '  "description": "braces { } and \\"quotes\\" and a colon :",',
  '  "exports": {',
  '    "." : { "types": "./dist/index.d.ts" },',
  '    "./plugins/uuid": { "types": "./dist/plugins/uuid.d.ts" }',
  "  },",
  '  "sideEffects": false,',
  '  "files": ["dist"]',
  "}",
  "",
].join("\n");

describe("spliceJsonMember", () => {
  it("replaces one member's value and moves no other byte", () => {
    const replaced = spliceJsonMember(ORIGINAL, "exports", '{ "x": 1 }');
    expect(replaced).toBe(
      [
        "{",
        '  "name": "@maroonedog/luq",',
        '  "description": "braces { } and \\"quotes\\" and a colon :",',
        '  "exports": { "x": 1 },',
        '  "sideEffects": false,',
        '  "files": ["dist"]',
        "}",
        "",
      ].join("\n")
    );
  });

  it("leaves the bytes before and after the member as they were", () => {
    const keyText = '"exports": ';
    const prefix = ORIGINAL.slice(
      0,
      ORIGINAL.indexOf(keyText) + keyText.length
    );
    const suffix = ORIGINAL.slice(ORIGINAL.indexOf(',\n  "sideEffects"'));
    const replaced = spliceJsonMember(ORIGINAL, "exports", "{}");
    expect(replaced).toBe(`${prefix}{}${suffix}`);
    expect(replaced.startsWith(prefix)).toBe(true);
    expect(replaced.endsWith(suffix)).toBe(true);
  });

  it("is not fooled by a brace inside a string", () => {
    const source = '{ "a": { "s": "}}}}" }, "b": 1 }';
    expect(spliceJsonMember(source, "a", "null")).toBe('{ "a": null, "b": 1 }');
  });

  it("is not fooled by an escaped quote", () => {
    const source = '{ "a": { "s": "\\"}" }, "b": 1 }';
    expect(spliceJsonMember(source, "a", "null")).toBe('{ "a": null, "b": 1 }');
  });

  it("replaces an array member too", () => {
    expect(spliceJsonMember('{ "files": ["dist"] }', "files", "[]")).toBe(
      '{ "files": [] }'
    );
  });

  it("fails when the member is absent", () => {
    expect(() => spliceJsonMember("{}", "exports", "{}")).toThrow(
      /has no member "exports"/
    );
  });

  it("fails when the value is neither an object nor an array", () => {
    expect(() => spliceJsonMember('{ "name": "x" }', "name", "{}")).toThrow(
      /is neither an object nor an array/
    );
  });

  it("fails on a value that is not closed", () => {
    expect(() => spliceJsonMember('{ "a": {', "a", "{}")).toThrow(
      /is not closed/
    );
  });
});

describe("renderJsonValue", () => {
  it("indents every line to sit inside the given indent", () => {
    expect(renderJsonValue({ a: 1 }, 1)).toBe('{\n    "a": 1\n  }');
  });

  it("matches JSON.stringify at indent 0", () => {
    expect(renderJsonValue({ a: 1 }, 0)).toBe(
      JSON.stringify({ a: 1 }, null, 2)
    );
  });
});
