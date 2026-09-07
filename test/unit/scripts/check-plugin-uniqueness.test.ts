import * as path from "path";
import {
  findUniquenessViolations,
  readPluginIdentities,
  type PluginIdentity,
} from "../../../scripts/check-plugin-uniqueness";
import { PLUGIN_MANIFEST } from "../../../src/plugins/manifest.generated";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..", "..");

function identity(
  name: string,
  method: string,
  slots: readonly string[]
): PluginIdentity {
  return {
    symbol: `${name}Plugin`,
    directory: `src/plugins/${name}`,
    name,
    method,
    slots,
  };
}

describe("findUniquenessViolations", () => {
  it("衝突が無ければ違反を出さない", () => {
    expect(
      findUniquenessViolations([
        identity("stringMin", "min", ["string"]),
        identity("numberMin", "min", ["number"]),
        identity("required", "required", ["string", "number"]),
      ])
    ).toEqual([]);
  });

  it("同じメソッド名でもスロットが違えば衝突ではない", () => {
    // .min() は string にも number にもある。これを衝突と呼んだら
    // カタログは成立しない。
    expect(
      findUniquenessViolations([
        identity("stringMin", "min", ["string"]),
        identity("numberMin", "min", ["number"]),
        identity("stringMax", "max", ["string"]),
        identity("numberMax", "max", ["number"]),
      ])
    ).toEqual([]);
  });

  it("プラグイン名の重複を捕まえる", () => {
    // 足場を消し忘れた状態そのもの: 同じ名前が2箇所にある。
    const violations = findUniquenessViolations([
      identity("stringMin", "min", ["string"]),
      {
        ...identity("stringMin", "min", ["string"]),
        directory: "src/plugins/check-plugins",
      },
    ]);
    expect(violations.map((one) => one.kind)).toContain("duplicate-name");
    expect(violations[0]?.detail).toContain("stringMin");
    expect(violations[0]?.detail).toContain("src/plugins/check-plugins");
  });

  it("1スロットに同じメソッドを生やす2プラグインを捕まえる", () => {
    const violations = findUniquenessViolations([
      identity("stringMin", "min", ["string"]),
      identity("stringMinimum", "min", ["string"]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.kind).toBe("duplicate-slot-method");
    expect(violations[0]?.detail).toContain("string.min");
  });

  it("複数スロットのうち1つだけ重なっても捕まえる", () => {
    const violations = findUniquenessViolations([
      identity("arrayMinLength", "minLength", ["array", "tuple"]),
      identity("tupleMinLength", "minLength", ["tuple"]),
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.detail).toContain("tuple.minLength");
  });

  it("stitch が2つあれば落ちる", () => {
    // 1.x の stitch / stitch-typed / stitchSimple が並存した状態。
    const violations = findUniquenessViolations([
      identity("stitch", "stitch", ["string"]),
      { ...identity("stitch", "stitch", ["string"]), symbol: "stitchTyped" },
      { ...identity("stitch", "stitch", ["string"]), symbol: "stitchSimple" },
    ]);
    expect(violations.map((one) => one.kind).sort()).toEqual([
      "duplicate-name",
      "duplicate-slot-method",
    ]);
  });
});

describe("readPluginIdentities (実カタログ)", () => {
  const identities = readPluginIdentities(REPOSITORY_ROOT);

  it("manifest が読んだシンボル数と同じだけ実物を読める", () => {
    const symbolCount = PLUGIN_MANIFEST.reduce(
      (total, entry) => total + entry.exportedSymbols.length,
      0
    );
    expect(identities).toHaveLength(symbolCount);
  });

  it("実カタログに衝突は無い", () => {
    expect(findUniquenessViolations(identities)).toEqual([]);
  });

  it("stitch はちょうど1つ", () => {
    expect(identities.filter((one) => one.name === "stitch")).toHaveLength(1);
  });
});
