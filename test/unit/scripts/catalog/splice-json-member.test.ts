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
  it("指定メンバの値だけを差し替え、他のバイトは動かさない", () => {
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

  it("メンバの前後のバイト列がそのまま残る", () => {
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

  it("文字列の中の波括弧に釣られない", () => {
    const source = '{ "a": { "s": "}}}}" }, "b": 1 }';
    expect(spliceJsonMember(source, "a", "null")).toBe('{ "a": null, "b": 1 }');
  });

  it("エスケープされた引用符に釣られない", () => {
    const source = '{ "a": { "s": "\\"}" }, "b": 1 }';
    expect(spliceJsonMember(source, "a", "null")).toBe('{ "a": null, "b": 1 }');
  });

  it("配列メンバも差し替えられる", () => {
    expect(spliceJsonMember('{ "files": ["dist"] }', "files", "[]")).toBe(
      '{ "files": [] }'
    );
  });

  it("メンバが無ければ落ちる", () => {
    expect(() => spliceJsonMember("{}", "exports", "{}")).toThrow(
      /has no member "exports"/
    );
  });

  it("値がオブジェクトでも配列でもなければ落ちる", () => {
    expect(() => spliceJsonMember('{ "name": "x" }', "name", "{}")).toThrow(
      /is neither an object nor an array/
    );
  });

  it("閉じていない値は落ちる", () => {
    expect(() => spliceJsonMember('{ "a": {', "a", "{}")).toThrow(
      /is not closed/
    );
  });
});

describe("renderJsonValue", () => {
  it("指定インデントの中に収まるよう各行を字下げする", () => {
    expect(renderJsonValue({ a: 1 }, 1)).toBe('{\n    "a": 1\n  }');
  });

  it("インデント0なら JSON.stringify と同じ", () => {
    expect(renderJsonValue({ a: 1 }, 0)).toBe(
      JSON.stringify({ a: 1 }, null, 2)
    );
  });
});
