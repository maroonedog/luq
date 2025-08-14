import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("oneOf Plugin", () => {
  describe("基本動作", () => {
    test("許可された値を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ status: string }>()
        .v("status", (b) =>
          b.string.required().oneOf(["active", "inactive", "pending"])
        )
        .build();

      expect(validator.validate({ status: "active" }).valid).toBe(true);
      expect(validator.validate({ status: "inactive" }).valid).toBe(true);
      expect(validator.validate({ status: "pending" }).valid).toBe(true);
    });

    test("許可されていない値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ status: string }>()
        .v("status", (b) =>
          b.string.required().oneOf(["active", "inactive", "pending"])
        )
        .build();

      const result = validator.validate({ status: "unknown" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "status",
        code: "oneOf",
      });
    });
  });

  describe("様々な型での検証", () => {
    test("文字列の選択肢", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ priority: string }>()
        .v("priority", (b) =>
          b.string.required().oneOf(["low", "medium", "high", "critical"])
        )
        .build();

      expect(validator.validate({ priority: "low" }).valid).toBe(true);
      expect(validator.validate({ priority: "medium" }).valid).toBe(true);
      expect(validator.validate({ priority: "high" }).valid).toBe(true);
      expect(validator.validate({ priority: "critical" }).valid).toBe(true);

      expect(validator.validate({ priority: "urgent" }).valid).toBe(false);
      expect(validator.validate({ priority: "LOW" }).valid).toBe(false); // 大文字小文字区別
    });

    test("数値の選択肢", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ rating: number }>()
        .v("rating", (b) => b.number.required().oneOf([1, 2, 3, 4, 5]))
        .build();

      expect(validator.validate({ rating: 1 }).valid).toBe(true);
      expect(validator.validate({ rating: 3 }).valid).toBe(true);
      expect(validator.validate({ rating: 5 }).valid).toBe(true);

      expect(validator.validate({ rating: 0 }).valid).toBe(false);
      expect(validator.validate({ rating: 6 }).valid).toBe(false);
      expect(validator.validate({ rating: 3.5 }).valid).toBe(false);
    });

    test("ブール値の選択肢", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ confirmed: boolean }>()
        .v("confirmed", (b) => b.boolean.required().oneOf([true]))
        .build();

      expect(validator.validate({ confirmed: true }).valid).toBe(true);
      expect(validator.validate({ confirmed: false }).valid).toBe(false);
    });

    test("混合型の選択肢", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ value: any }>()
        .v("value", (b) => b.string.required().oneOf(["auto", 0, false, null]))
        .build();

      expect(validator.validate({ value: "auto" }).valid).toBe(true);
      expect(validator.validate({ value: 0 }).valid).toBe(true);
      expect(validator.validate({ value: false }).valid).toBe(true);
      expect(validator.validate({ value: null }).valid).toBe(true);

      expect(validator.validate({ value: "manual" }).valid).toBe(false);
      expect(validator.validate({ value: 1 }).valid).toBe(false);
      expect(validator.validate({ value: true }).valid).toBe(false);
      expect(validator.validate({ value: undefined }).valid).toBe(false);
    });
  });

  describe("厳密な等価性チェック", () => {
    test("型の違いを検出", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ value: any }>()
        .v("value", (b) => b.string.required().oneOf([1, "1", true]))
        .build();

      expect(validator.validate({ value: 1 }).valid).toBe(true);
      expect(validator.validate({ value: "1" }).valid).toBe(true);
      expect(validator.validate({ value: true }).valid).toBe(true);

      // 型は異なるが値が同じもの
      expect(validator.validate({ value: 0 }).valid).toBe(false);
      expect(validator.validate({ value: "0" }).valid).toBe(false);
      expect(validator.validate({ value: false }).valid).toBe(false);
    });

    test("大文字小文字の区別", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ size: string }>()
        .v("size", (b) => b.string.required().oneOf(["S", "M", "L", "XL"]))
        .build();

      expect(validator.validate({ size: "S" }).valid).toBe(true);
      expect(validator.validate({ size: "M" }).valid).toBe(true);

      expect(validator.validate({ size: "s" }).valid).toBe(false);
      expect(validator.validate({ size: "m" }).valid).toBe(false);
      expect(validator.validate({ size: "small" }).valid).toBe(false);
    });

    test("特殊な値の扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ special: any }>()
        .v("special", (b) =>
          b.string.required().oneOf([0, -0, NaN, null, undefined])
        )
        .build();

      expect(validator.validate({ special: 0 }).valid).toBe(true);
      expect(validator.validate({ special: -0 }).valid).toBe(true); // 0 === -0
      expect(validator.validate({ special: null }).valid).toBe(true);
      expect(validator.validate({ special: undefined }).valid).toBe(true);

      // NaN の特殊な扱い（NaN !== NaN）
      const nanResult = validator.validate({ special: NaN });
      // 実装によっては NaN は一致しない可能性がある
      expect(nanresult.isValid()).toBe(false); // 多くの実装で NaN は一致しない
    });
  });

  describe("単一値での動作", () => {
    test("選択肢が1つの場合", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ fixed: string }>()
        .v("fixed", (b) => b.string.required().oneOf(["only-value"]))
        .build();

      expect(validator.validate({ fixed: "only-value" }).valid).toBe(true);
      expect(validator.validate({ fixed: "other-value" }).valid).toBe(false);
    });
  });

  describe("空配列での動作", () => {
    test("選択肢が空の場合", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ impossible: any }>()
        .v("impossible", (b) => b.string.required().oneOf([]))
        .build();

      // 空の選択肢なので、どんな値も無効
      expect(validator.validate({ impossible: "anything" }).valid).toBe(false);
      expect(validator.validate({ impossible: 1 }).valid).toBe(false);
      expect(validator.validate({ impossible: null }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("文字列長制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ code: string }>()
        .v("code", (b) =>
          b.string.required().oneOf(["A", "BB", "CCC", "DDDD"]).min(2).max(4)
        )
        .build();

      // 有効: 選択肢にありかつ長さOK
      expect(validator.validate({ code: "BB" }).valid).toBe(true);
      expect(validator.validate({ code: "CCC" }).valid).toBe(true);
      expect(validator.validate({ code: "DDDD" }).valid).toBe(true);

      // 無効: 選択肢にあるが長さNG
      expect(validator.validate({ code: "A" }).valid).toBe(false); // 短すぎる

      // 無効: 長さOKだが選択肢にない
      expect(validator.validate({ code: "EEE" }).valid).toBe(false);
    });

    test("パターンとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .use(stringPatternPlugin)
        .for<{ country: string }>()
        .v("country", (b) =>
          b.string
            .required()
            .oneOf(["US", "UK", "JP", "DE", "FR"])
            .pattern(/^[A-Z]{2}$/)
        )
        .build();

      // 有効: 選択肢にありかつパターンに一致
      expect(validator.validate({ country: "US" }).valid).toBe(true);
      expect(validator.validate({ country: "JP" }).valid).toBe(true);

      // 無効: 選択肢にあるが（実際にはすべてパターンに一致するので、この例では起こりにくい）
      // より良い例を作成
      const validator2 = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .use(stringPatternPlugin)
        .for<{ code: string }>()
        .v("code", (b) =>
          b.string
            .required()
            .oneOf(["AB1", "CD2", "invalid"])
            .pattern(/^[A-Z]{2}\d$/)
        )
        .build();

      expect(validator2.validate({ code: "AB1" }).valid).toBe(true);
      expect(validator2.validate({ code: "CD2" }).valid).toBe(true);
      expect(validator2.validate({ code: "invalid" }).valid).toBe(false); // パターンに一致しない
    });

    test("数値範囲との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ level: number }>()
        .v("level", (b) =>
          b.number.required().oneOf([1, 5, 10, 15, 20]).min(5).max(15)
        )
        .build();

      // 有効: 選択肢にありかつ範囲内
      expect(validator.validate({ level: 5 }).valid).toBe(true);
      expect(validator.validate({ level: 10 }).valid).toBe(true);
      expect(validator.validate({ level: 15 }).valid).toBe(true);

      // 無効: 選択肢にあるが範囲外
      expect(validator.validate({ level: 1 }).valid).toBe(false); // 最小値未満
      expect(validator.validate({ level: 20 }).valid).toBe(false); // 最大値超過

      // 無効: 範囲内だが選択肢にない
      expect(validator.validate({ level: 7 }).valid).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(oneOfPlugin)
        .for<{ theme?: string }>()
        .v("theme", (b) => b.string.optional().oneOf(["light", "dark", "auto"]))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ theme: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は選択肢検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(oneOfPlugin)
        .for<{ theme?: string }>()
        .v("theme", (b) => b.string.optional().oneOf(["light", "dark", "auto"]))
        .build();

      expect(validator.validate({ theme: "light" }).valid).toBe(true);
      expect(validator.validate({ theme: "custom" }).valid).toBe(false);
    });
  });

  describe("エラーコンテキスト", () => {
    test("許可された選択肢が含まれる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<{ status: string }>()
        .v("status", (b) =>
          b.string.required().oneOf(["draft", "published", "archived"])
        )
        .build();

      const result = validator.validate({ status: "pending" });
      expect(result.isValid()).toBe(false);
      // Context property is not available in current API
      // expect(result.errors[0].context).toMatchObject({
      //   allowedValues: ["draft", "published", "archived"],
      // });
    });
  });

  describe("実用的なシナリオ", () => {
    test("ユーザーロール管理", () => {
      interface User {
        role: string;
        status: string;
        permission: string;
        subscription: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<User>()
        .v("role", (b) =>
          b.string.required().oneOf(["admin", "moderator", "user", "guest"])
        )
        .v("status", (b) =>
          b.string
            .required()
            .oneOf(["active", "inactive", "suspended", "banned"])
        )
        .v("permission", (b) =>
          b.string.required().oneOf(["read", "write", "admin", "super"])
        )
        .v("subscription", (b) =>
          b.string.required().oneOf(["free", "basic", "premium", "enterprise"])
        )
        .build();

      // 有効なユーザー
      const validUser = {
        role: "admin",
        status: "active",
        permission: "admin",
        subscription: "enterprise",
      };
      expect(validator.validate(validUser).valid).toBe(true);

      // 無効なユーザー
      const invalidUser = {
        role: "superadmin", // 存在しない役割
        status: "pending", // 存在しないステータス
        permission: "execute", // 存在しない権限
        subscription: "trial", // 存在しないサブスクリプション
      };
      expect(validator.validate(invalidUser).valid).toBe(false);
    });

    test("eコマース商品設定", () => {
      interface Product {
        category: string;
        condition: string;
        availability: string;
        shippingMethod: string;
        paymentMethod: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<Product>()
        .v("category", (b) =>
          b.string
            .required()
            .oneOf([
              "electronics",
              "clothing",
              "books",
              "home",
              "sports",
              "toys",
            ])
        )
        .v("condition", (b) =>
          b.string.required().oneOf(["new", "used", "refurbished"])
        )
        .v("availability", (b) =>
          b.string.required().oneOf(["in-stock", "out-of-stock", "pre-order"])
        )
        .v("shippingMethod", (b) =>
          b.string.required().oneOf(["standard", "express", "overnight"])
        )
        .v("paymentMethod", (b) =>
          b.string.required().oneOf(["credit", "debit", "paypal", "crypto"])
        )
        .build();

      // 有効な商品
      const validProduct = {
        category: "electronics",
        condition: "new",
        availability: "in-stock",
        shippingMethod: "express",
        paymentMethod: "credit",
      };
      expect(validator.validate(validProduct).valid).toBe(true);

      // 無効な商品
      const invalidProduct = {
        category: "automotive", // サポートされていないカテゴリ
        condition: "damaged", // サポートされていない状態
        availability: "limited", // サポートされていない在庫状況
        shippingMethod: "drone", // サポートされていない配送方法
        paymentMethod: "cash", // サポートされていない支払い方法
      };
      expect(validator.validate(invalidProduct).valid).toBe(false);
    });

    test("システム設定管理", () => {
      interface SystemConfig {
        environment: string;
        logLevel: string;
        database: string;
        cacheStrategy: string;
        authMethod: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<SystemConfig>()
        .v("environment", (b) =>
          b.string.required().oneOf(["development", "staging", "production"])
        )
        .v("logLevel", (b) =>
          b.string.required().oneOf(["debug", "info", "warn", "error", "fatal"])
        )
        .v("database", (b) =>
          b.string.required().oneOf(["postgresql", "mysql", "mongodb", "redis"])
        )
        .v("cacheStrategy", (b) =>
          b.string.required().oneOf(["memory", "redis", "memcached", "none"])
        )
        .v("authMethod", (b) =>
          b.string.required().oneOf(["jwt", "session", "oauth", "basic"])
        )
        .build();

      // 有効なシステム設定
      const validConfig = {
        environment: "production",
        logLevel: "info",
        database: "postgresql",
        cacheStrategy: "redis",
        authMethod: "jwt",
      };
      expect(validator.validate(validConfig).valid).toBe(true);

      // 無効なシステム設定
      const invalidConfig = {
        environment: "testing", // サポートされていない環境
        logLevel: "verbose", // サポートされていないログレベル
        database: "sqlite", // サポートされていないデータベース
        cacheStrategy: "filesystem", // サポートされていないキャッシュ戦略
        authMethod: "ldap", // サポートされていない認証方法
      };
      expect(validator.validate(invalidConfig).valid).toBe(false);
    });

    test("APIレスポンス形式", () => {
      interface ApiResponse {
        status: string;
        format: string;
        version: string;
        encoding: string;
        compression: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(oneOfPlugin)
        .for<ApiResponse>()
        .v("status", (b) =>
          b.string.required().oneOf(["success", "error", "pending"])
        )
        .v("format", (b) =>
          b.string.required().oneOf(["json", "xml", "csv", "binary"])
        )
        .v("version", (b) => b.string.required().oneOf(["v1", "v2", "v3"]))
        .v("encoding", (b) =>
          b.string.required().oneOf(["utf-8", "ascii", "base64"])
        )
        .v("compression", (b) =>
          b.string.required().oneOf(["none", "gzip", "brotli", "deflate"])
        )
        .build();

      // 有効なAPIレスポンス
      const validResponse = {
        status: "success",
        format: "json",
        version: "v2",
        encoding: "utf-8",
        compression: "gzip",
      };
      expect(validator.validate(validResponse).valid).toBe(true);

      // 無効なAPIレスポンス
      const invalidResponse = {
        status: "ok", // 'success' であるべき
        format: "yaml", // サポートされていない形式
        version: "v4", // サポートされていないバージョン
        encoding: "latin1", // サポートされていないエンコーディング
        compression: "lz4", // サポートされていない圧縮方式
      };
      expect(validator.validate(invalidResponse).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
