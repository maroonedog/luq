// プロトタイプ汚染が起きないことを、実際に汚染を試みて確認する。
//
// 以前は parse-field-path が "__proto__" を宣言セグメントとして拒否していた。
// その拒否は過剰で、JSON-Schema-Test-Suite の properties.json が要求する
// 「__proto__ という名前のプロパティを検証する」ができなかった。
//
// 拒否をやめた代わりに、create-value-writer が代入をやめて defineProperty に
// 移した。危険なのは Object.prototype.__proto__ が **アクセサ** であることで、
// 代入するとそのアクセサが呼ばれてプロトタイプが差し替わる。defineProperty は
// アクセサを見ずに own プロパティを定義するので、この経路が閉じる。
//
// このファイルはその境界を守る。落ちたら、汚染できるようになったということ。
import { createValueReader } from "../../../src/path/create-value-reader";
import { createValueWriter } from "../../../src/path/create-value-writer";
import { parseFieldPath } from "../../../src/path/parse-field-path";
import { RESERVED_SEGMENTS } from "../../../src/path/reserved-segment";

/** Object.prototype に生えていないことを確かめる。 */
function readFromPrototype(key: string): unknown {
  return (Object.prototype as unknown as Record<string, unknown>)[key];
}

describe("宣言できるようになったこと", () => {
  it.each(RESERVED_SEGMENTS)("%s を宣言パスとして解析できる", (segment) => {
    expect(() => parseFieldPath(segment)).not.toThrow();
  });

  it("__proto__ を own プロパティとして読める", () => {
    // JSON.parse は __proto__ を own プロパティとして作る。
    const subject: unknown = JSON.parse('{"__proto__": "own value"}');
    const read = createValueReader(parseFieldPath("__proto__"));
    expect(read(subject)).toBe("own value");
  });

  it("プロトタイプ経由の値は読まない", () => {
    // own でないものは undefined。読み取りは元から hasOwnProperty.call。
    const read = createValueReader(parseFieldPath("toString"));
    expect(read({})).toBeUndefined();
  });
});

describe("それでも Object.prototype は汚れない", () => {
  afterEach(() => {
    for (const key of ["polluted", "injected"]) {
      delete (Object.prototype as unknown as Record<string, unknown>)[key];
    }
  });

  it("__proto__ への書き込みがプロトタイプを差し替えない", () => {
    const write = createValueWriter(parseFieldPath("__proto__"));
    const written = write({}, { polluted: "yes" });

    // 書いた先は own プロパティ。
    expect(Object.prototype.hasOwnProperty.call(written, "__proto__")).toBe(
      true
    );
    // プロトタイプは変わっていない。
    expect(Object.getPrototypeOf(written)).toBe(Object.prototype);
    // 他のオブジェクトに漏れていない。
    expect(readFromPrototype("polluted")).toBeUndefined();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("ネストした __proto__ への書き込みでも汚れない", () => {
    const write = createValueWriter(parseFieldPath("nested.__proto__"));
    const written = write({ nested: {} }, { injected: "yes" });
    expect(readFromPrototype("injected")).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    void written;
  });

  it("中間を作りながらの書き込みでも汚れない", () => {
    // vivify が通る経路。ここが代入に戻ると汚染できる。
    const write = createValueWriter(parseFieldPath("missing.__proto__"));
    write({}, { injected: "yes" });
    expect(readFromPrototype("injected")).toBeUndefined();
  });

  it("constructor と prototype への書き込みも own プロパティになる", () => {
    for (const key of ["constructor", "prototype"]) {
      const written = write1(key, "own value");
      expect(Object.prototype.hasOwnProperty.call(written, key)).toBe(true);
      expect((written as Record<string, unknown>)[key]).toBe("own value");
    }
    // Object.prototype.constructor は今も Object のまま。
    expect(Object.prototype.constructor).toBe(Object);
  });

  it("入力オブジェクトは変更されない", () => {
    const input = {};
    createValueWriter(parseFieldPath("__proto__"))(input, { polluted: "yes" });
    expect(Object.prototype.hasOwnProperty.call(input, "__proto__")).toBe(
      false
    );
  });
});

function write1(key: string, value: unknown): unknown {
  return createValueWriter(parseFieldPath(key))({}, value);
}
