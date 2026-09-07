// 公開APIの通し確認。実装の内部ではなく、利用者が書くとおりのコードで動くことを見る。
// 旧実装では README の Quick Start が3箇所で壊れていた (build() が関数ではなく
// オブジェクトを返す / result.issues が存在しない / import パスが exports に無い)。
// ここが落ちたら、それは利用者から見えるふるまいが壊れたということ。
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/presence-plugins";
import {
  stringMinPlugin,
  numberMinPlugin,
} from "../../src/plugins/check-plugins";

type User = {
  name: string;
  age: number;
  email: string;
};

type Order = {
  customer: { name: string };
  items: { productId: string }[];
};

describe("独立検証: README の Quick Start", () => {
  const validateUser = Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(numberMinPlugin)
    .for<User>()
    .v("name", (b) => b.string.required().min(3))
    .v("age", (b) => b.number.required().min(18))
    .build();

  it("有効な値を通す", () => {
    const result = validateUser.validate({
      name: "John",
      age: 25,
      email: "j@example.com",
    });
    expect(result.valid).toBe(true);
  });

  it("短すぎる名前を弾き、path を出す", () => {
    const result = validateUser.validate({
      name: "Jo",
      age: 25,
      email: "j@example.com",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toContain("name");
    }
  });

  // 引き継いだ仕様 (docs/legacy-spec/execution-model.md): abortEarly は既定 true で、
  // 最初にエラーが出たフィールドで打ち切る。
  it("既定では最初に落ちたフィールドで打ち切る", () => {
    const result = validateUser.validate({
      name: "Jo",
      age: 3,
      email: "j@example.com",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toEqual(["name"]);
    }
  });

  it("abortEarly: false なら全フィールドの違反を集める", () => {
    const result = validateUser.validate(
      { name: "Jo", age: 3, email: "j@example.com" },
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path).sort()).toEqual([
        "age",
        "name",
      ]);
    }
  });

  it("required が欠損を捕まえる", () => {
    const result = validateUser.validate({ age: 25, email: "j@example.com" });
    expect(result.valid).toBe(false);
  });

  it("入力オブジェクトを変更しない", () => {
    const input = { name: "John", age: 25, email: "j@example.com" };
    const snapshot = JSON.stringify(input);
    validateUser.validate(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("独立検証: ネストと配列ワイルドカード", () => {
  const validateOrder = Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Order>()
    .v("customer.name", (b) => b.string.required().min(2))
    .v("items[*].productId", (b) => b.string.required().min(5))
    .build();

  it("ネストしたフィールドを検証する", () => {
    const result = validateOrder.validate({
      customer: { name: "A" },
      items: [{ productId: "PROD-1" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toContain(
        "customer.name"
      );
    }
  });

  it("配列要素の issue path が実インデックスになる", () => {
    const result = validateOrder.validate({
      customer: { name: "Acme" },
      items: [{ productId: "PROD-1" }, { productId: "X" }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues.map((issue) => issue.path)).toContain(
        "items[1].productId"
      );
      expect(result.issues.map((issue) => issue.path)).not.toContain(
        "items[*].productId"
      );
    }
  });

  it("全部有効なら通る", () => {
    const result = validateOrder.validate({
      customer: { name: "Acme" },
      items: [{ productId: "PROD-1" }, { productId: "PROD-2" }],
    });
    expect(result.valid).toBe(true);
  });
});

describe("独立検証: CSP-safe", () => {
  it("src/ のどこにも eval / new Function が無い", () => {
    const fs = require("fs") as typeof import("fs");
    const nodePath = require("path") as typeof import("path");
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = nodePath.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith(".ts") ? [full] : [];
      });
    const dynamicCode = /\beval\s*\(|new\s+Function\s*\(/;
    const offenders = walk("src").filter((file) =>
      dynamicCode.test(fs.readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });
});
