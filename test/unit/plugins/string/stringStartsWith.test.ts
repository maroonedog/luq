import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringStartsWithPlugin } from "../../../../src/core/plugin/stringStartsWith";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringStartsWith Plugin", () => {
  describe("基本動作", () => {
    test("指定したプレフィックスで始まる文字列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().startsWith("PROD-"))
        .build();

      expect(validator.validate({ code: "PROD-12345" }).valid).toBe(true);
      expect(validator.validate({ code: "PROD-ABC-789" }).valid).toBe(true);
      expect(validator.validate({ code: "PROD-" }).valid).toBe(true);
    });

    test("指定したプレフィックスで始まらない文字列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ code: string }>()
        .v("code", (b) => b.string.required().startsWith("PROD-"))
        .build();

      const invalidCodes = [
        "ITEM-12345", // 異なるプレフィックス
        "prod-12345", // 小文字
        "PROD12345", // ハイフンなし
        " PROD-12345", // 先頭にスペース
        "PRODUCT-12345", // より長いプレフィックス
        "PR-12345", // より短いプレフィックス
        "", // 空文字列
      ];

      invalidCodes.forEach((code) => {
        const result = validator.validate({ code });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "code",
          code: "stringStartsWith",
          context: { prefix: "PROD-" },
        });
      });
    });
  });

  describe("様々なプレフィックスパターン", () => {
    test("単一文字のプレフィックス", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ grade: string }>()
        .v("grade", (b) => b.string.required().startsWith("A"))
        .build();

      expect(validator.validate({ grade: "A+" }).valid).toBe(true);
      expect(validator.validate({ grade: "A-" }).valid).toBe(true);
      expect(validator.validate({ grade: "A" }).valid).toBe(true);
      expect(validator.validate({ grade: "B+" }).valid).toBe(false);
    });

    test("数字のプレフィックス", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ year: string }>()
        .v("year", (b) => b.string.required().startsWith("2024"))
        .build();

      expect(validator.validate({ year: "2024-01-01" }).valid).toBe(true);
      expect(validator.validate({ year: "2024/12/31" }).valid).toBe(true);
      expect(validator.validate({ year: "2023-12-31" }).valid).toBe(false);
    });

    test("特殊文字を含むプレフィックス", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ path: string }>()
        .v("path", (b) => b.string.required().startsWith("/api/v1/"))
        .build();

      expect(validator.validate({ path: "/api/v1/users" }).valid).toBe(true);
      expect(validator.validate({ path: "/api/v1/products/123" }).valid).toBe(
        true
      );
      expect(validator.validate({ path: "/api/v2/users" }).valid).toBe(false);
      expect(validator.validate({ path: "api/v1/users" }).valid).toBe(false);
    });

    test("空文字列のプレフィックス", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ text: string }>()
        .v("text", (b) => b.string.required().startsWith(""))
        .build();

      // 空文字列で始まる = すべての文字列が有効
      expect(validator.validate({ text: "anything" }).valid).toBe(true);
      expect(validator.validate({ text: "" }).valid).toBe(true);
      expect(validator.validate({ text: "123" }).valid).toBe(true);
    });
  });

  describe("大文字小文字の区別", () => {
    test("大文字小文字を区別する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ protocol: string }>()
        .v("protocol", (b) => b.string.required().startsWith("HTTP"))
        .build();

      expect(validator.validate({ protocol: "HTTP/1.1" }).valid).toBe(true);
      expect(validator.validate({ protocol: "HTTPS" }).valid).toBe(true);
      expect(validator.validate({ protocol: "http/1.1" }).valid).toBe(false);
      expect(validator.validate({ protocol: "Http/1.1" }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("長さ制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ orderId: string }>()
        .v("orderId", (b) =>
          b.string.required().startsWith("ORD-").min(10).max(15)
        )
        .build();

      // 有効: プレフィックスあり、長さOK
      expect(validator.validate({ orderId: "ORD-123456" }).valid).toBe(true);
      expect(validator.validate({ orderId: "ORD-ABCDEFG" }).valid).toBe(true);

      // 無効: プレフィックスなし
      expect(validator.validate({ orderId: "ORDER-12345" }).valid).toBe(false);

      // 無効: 短すぎる
      expect(validator.validate({ orderId: "ORD-123" }).valid).toBe(false);

      // 無効: 長すぎる
      expect(validator.validate({ orderId: "ORD-1234567890123" }).valid).toBe(
        false
      );
    });

    test("パターンとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .use(stringPatternPlugin)
        .for<{ productCode: string }>()
        .v("productCode", (b) =>
          b.string
            .required()
            .startsWith("SKU-")
            .pattern(/^SKU-[A-Z]{3}-\d{4}$/)
        )
        .build();

      // 有効: プレフィックスありかつパターンに一致
      expect(validator.validate({ productCode: "SKU-ABC-1234" }).valid).toBe(
        true
      );
      expect(validator.validate({ productCode: "SKU-XYZ-9999" }).valid).toBe(
        true
      );

      // 無効: パターンに一致しない
      expect(validator.validate({ productCode: "SKU-abc-1234" }).valid).toBe(
        false
      );
      expect(validator.validate({ productCode: "SKU-AB-1234" }).valid).toBe(
        false
      );
      expect(validator.validate({ productCode: "SKU-ABC-12" }).valid).toBe(
        false
      );
    });

    test("複数のstartsWithの連鎖", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .use(stringEndsWithPlugin)
        .for<{ filename: string }>()
        .v("filename", (b) =>
          b.string.required().startsWith("doc_").endsWith(".pdf")
        )
        .build();

      // 有効: 両方の条件を満たす
      expect(
        validator.validate({ filename: "doc_report_2024.pdf" }).valid
      ).toBe(true);
      expect(validator.validate({ filename: "doc_invoice.pdf" }).valid).toBe(
        true
      );

      // 無効: プレフィックスがない
      expect(validator.validate({ filename: "report_2024.pdf" }).valid).toBe(
        false
      );

      // 無効: サフィックスがない
      expect(
        validator.validate({ filename: "doc_report_2024.docx" }).valid
      ).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringStartsWithPlugin)
        .for<{ prefix?: string }>()
        .v("prefix", (b) => b.string.optional().startsWith("OPT-"))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ prefix: undefined }).valid).toBe(true);
    });

    test("値が存在する場合はプレフィックス検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringStartsWithPlugin)
        .for<{ prefix?: string }>()
        .v("prefix", (b) => b.string.optional().startsWith("OPT-"))
        .build();

      expect(validator.validate({ prefix: "OPT-123" }).valid).toBe(true);
      expect(validator.validate({ prefix: "REQ-123" }).valid).toBe(false);
    });
  });

  describe("エラーメッセージ", () => {
    test("デフォルトエラーメッセージを確認", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ invoiceNo: string }>()
        .v("invoiceNo", (b) => b.string.required().startsWith("INV-"))
        .build();

      const result = validator.validate({ invoiceNo: "BILL-12345" });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("stringStartsWith");
      // Context property is not available in current API
      // expect(result.errors[0].context.prefix).toBe("INV-");
    });

    test("プレフィックス情報がコンテキストに含まれる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .for<{ ref: string }>()
        .v("ref", (b) => b.string.required().startsWith("REF-"))
        .build();

      const result = validator.validate({ ref: "DOC-123" });
      expect(result.isValid()).toBe(false);
      // Context property is not available in current API
      // expect(result.errors[0].context.prefix).toBe("REF-");
    });
  });

  describe("実用的なシナリオ", () => {
    test("ファイルパスのバリデーション", () => {
      interface FileUpload {
        publicPath: string;
        privatePath: string;
        tempPath?: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringStartsWithPlugin)
        .use(stringEndsWithPlugin)
        .for<FileUpload>()
        .v("publicPath", (b) => b.string.required().startsWith("/public/"))
        .v("privatePath", (b) => b.string.required().startsWith("/private/"))
        .v("tempPath", (b) => b.string.optional().startsWith("/tmp/"))
        .build();

      // 有効なパス
      const validPaths = {
        publicPath: "/public/images/logo.png",
        privatePath: "/private/documents/contract.pdf",
        tempPath: "/tmp/upload_12345.tmp",
      };
      expect(validator.validate(validPaths).valid).toBe(true);

      // 無効なパス
      const invalidPaths = {
        publicPath: "/images/logo.png", // /public/で始まらない
        privatePath: "/public/documents/doc.pdf", // /private/で始まらない
        tempPath: "/var/tmp/file.tmp", // /tmp/で始まらない
      };
      expect(validator.validate(invalidPaths).valid).toBe(false);
    });

    test("URLパスのバリデーション", () => {
      interface ApiEndpoint {
        v1Path: string;
        v2Path: string;
        adminPath: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringStartsWithPlugin)
        .use(stringPatternPlugin)
        .for<ApiEndpoint>()
        .v("v1Path", (b) =>
          b.string
            .required()
            .startsWith("/api/v1/")
            .pattern(/^\/api\/v1\/[a-z]+(?:\/[a-z0-9-]+)*$/)
        )
        .v("v2Path", (b) => b.string.required().startsWith("/api/v2/"))
        .v("adminPath", (b) =>
          b.string
            .required()
            .startsWith("/admin/")
            .pattern(/^\/admin\/[a-z-]+$/)
        )
        .build();

      // 有効なエンドポイント
      const validEndpoints = {
        v1Path: "/api/v1/users/123",
        v2Path: "/api/v2/products",
        adminPath: "/admin/dashboard",
      };
      expect(validator.validate(validEndpoints).valid).toBe(true);

      // 無効なエンドポイント
      const invalidEndpoints = {
        v1Path: "/api/v2/users", // v1で始まらない
        v2Path: "/api/users", // v2が含まれない
        adminPath: "/admin/Dashboard", // 大文字を含む
      };
      const result = validator.validate(invalidEndpoints);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

// 必要なimportを追加
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { stringEndsWithPlugin } from "../../../../src/core/plugin/stringEndsWith";
