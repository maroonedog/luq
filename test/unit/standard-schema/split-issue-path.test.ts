import { splitIssuePath } from "../../../src/standard-schema/split-issue-path";

describe("splitIssuePath", () => {
  it("ルートは空配列", () => {
    // 仕様上、空配列は「ルート自身への issue」を意味する。
    expect(splitIssuePath("")).toEqual([]);
  });

  it("単一のキー", () => {
    expect(splitIssuePath("name")).toEqual(["name"]);
  });

  it("ネストしたキー", () => {
    expect(splitIssuePath("user.address.street")).toEqual([
      "user",
      "address",
      "street",
    ]);
  });

  it("配列の添字は number になる", () => {
    expect(splitIssuePath("items[1]")).toEqual(["items", 1]);
  });

  it("配列要素のフィールド", () => {
    expect(splitIssuePath("items[1].productId")).toEqual([
      "items",
      1,
      "productId",
    ]);
  });

  it("多段の添字", () => {
    expect(splitIssuePath("matrix[0][2]")).toEqual(["matrix", 0, 2]);
  });

  it("深いネストと添字の混在", () => {
    expect(splitIssuePath("orders[3].items[0].sku")).toEqual([
      "orders",
      3,
      "items",
      0,
      "sku",
    ]);
  });

  it("添字は文字列ではなく number として出る", () => {
    const segments = splitIssuePath("items[10].name");
    expect(typeof segments[1]).toBe("number");
    expect(segments[1]).toBe(10);
  });

  it("2桁以上の添字", () => {
    expect(splitIssuePath("items[123]")).toEqual(["items", 123]);
  });

  describe("解釈できない形は握り潰さず、丸ごと1セグメントで返す", () => {
    // issue を落とすより、開けなかったことが分かる形で渡すほうがまし。
    it.each([
      ["先頭がドット", ".name"],
      ["末尾がドット", "name."],
      ["連続したドット", "a..b"],
      ["閉じない括弧", "items[1"],
      ["添字が数字でない", "items[x]"],
      ["空の添字", "items[]"],
      ["宣言用のワイルドカード", "items[*].name"],
    ])("%s", (_label, path) => {
      expect(splitIssuePath(path)).toEqual([path]);
    });
  });

  it("宣言パスの [*] を 0 と読み違えない", () => {
    // 二つの文法を一つの関数で扱うと、この取り違えが静かに入る。
    expect(splitIssuePath("items[*].name")).not.toEqual(["items", 0, "name"]);
  });
});
