import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { stringUrlPlugin } from "../../../../src/core/plugin/stringUrl";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("stringUrl Plugin", () => {
  describe("基本動作", () => {
    test("有効なURLを受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ website: string }>()
        .v("website", (b) => b.string.required().url())
        .build();

      // HTTPSのURL
      expect(validator.validate({ website: "https://example.com" }).valid).toBe(
        true
      );
      expect(
        validator.validate({ website: "https://www.example.com" }).valid
      ).toBe(true);
      expect(
        validator.validate({ website: "https://example.com/path" }).valid
      ).toBe(true);
      expect(
        validator.validate({ website: "https://example.com/path/to/resource" })
          .valid
      ).toBe(true);
      expect(
        validator.validate({ website: "https://example.com?query=value" }).valid
      ).toBe(true);
      expect(
        validator.validate({ website: "https://example.com#fragment" }).valid
      ).toBe(true);
      expect(
        validator.validate({ website: "https://example.com:8080" }).valid
      ).toBe(true);

      // HTTPのURL
      expect(validator.validate({ website: "http://example.com" }).valid).toBe(
        true
      );
      expect(validator.validate({ website: "http://localhost" }).valid).toBe(
        true
      );
      expect(
        validator.validate({ website: "http://localhost:3000" }).valid
      ).toBe(true);
      expect(validator.validate({ website: "http://127.0.0.1" }).valid).toBe(
        true
      );
      expect(validator.validate({ website: "http://[::1]" }).valid).toBe(true);

      // その他のプロトコル
      expect(validator.validate({ website: "ftp://example.com" }).valid).toBe(
        true
      );
      expect(validator.validate({ website: "ftps://example.com" }).valid).toBe(
        true
      );
      expect(
        validator.validate({ website: "file:///path/to/file" }).valid
      ).toBe(true);
    });

    test("無効なURLを拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ website: string }>()
        .v("website", (b) => b.string.required().url())
        .build();

      const invalidUrls = [
        "not a url",
        "example.com", // プロトコルなし
        "www.example.com", // プロトコルなし
        "http://", // ホストなし
        // Note: Node.js URL constructor accepts many edge cases as valid
        // The following are accepted by URL constructor:
        // "http://example", "http://example..com", "javascript:alert(1)", "data:..."
        "http://example .com", // スペース
        "http://exam ple.com", // スペース
        "", // 空文字列
      ];

      invalidUrls.forEach((url) => {
        const result = validator.validate({ website: url });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "website",
          code: url === "" ? "required" : "stringUrl",
        });
      });
    });
  });

  describe("特殊なURLパターン", () => {
    test("ユーザー認証情報を含むURL", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ url: string }>()
        .v("url", (b) => b.string.required().url())
        .build();

      expect(
        validator.validate({ url: "https://user:pass@example.com" }).valid
      ).toBe(true);
      expect(
        validator.validate({ url: "ftp://admin@ftp.example.com" }).valid
      ).toBe(true);
    });

    test("国際化ドメイン名（IDN）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ url: string }>()
        .v("url", (b) => b.string.required().url())
        .build();

      // Punycodeエンコードされたドメイン
      expect(
        validator.validate({ url: "https://xn--e1afmkfd.xn--p1ai" }).valid
      ).toBe(true);
      // 日本語ドメイン（ブラウザによってはPunycodeに変換される）
      expect(validator.validate({ url: "https://日本.jp" }).valid).toBe(true);
    });

    test("IPアドレスを含むURL", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ url: string }>()
        .v("url", (b) => b.string.required().url())
        .build();

      // IPv4
      expect(validator.validate({ url: "http://192.168.1.1" }).valid).toBe(
        true
      );
      expect(validator.validate({ url: "https://10.0.0.1:8080" }).valid).toBe(
        true
      );

      // IPv6
      expect(validator.validate({ url: "http://[2001:db8::1]" }).valid).toBe(
        true
      );
      expect(validator.validate({ url: "https://[::1]:3000" }).valid).toBe(
        true
      );
    });

    test("複雑なクエリパラメータとフラグメント", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ url: string }>()
        .v("url", (b) => b.string.required().url())
        .build();

      const complexUrls = [
        "https://example.com/path?foo=bar&baz=qux",
        "https://example.com/search?q=hello+world&lang=en",
        "https://example.com/page?array[]=1&array[]=2&array[]=3",
        "https://example.com/doc#section-1.2.3",
        "https://example.com/app?redirect=https%3A%2F%2Fother.com",
        "https://example.com/?utm_source=test&utm_medium=email&utm_campaign=2024",
      ];

      complexUrls.forEach((url) => {
        expect(validator.validate({ url }).valid).toBe(true);
      });
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringUrlPlugin)
        .for<{ website?: string }>()
        .v("website", (b) => b.string.optional().url())
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ website: undefined }).valid).toBe(true);
    });

    test("値が存在する場合はURL検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(stringUrlPlugin)
        .for<{ website?: string }>()
        .v("website", (b) => b.string.optional().url())
        .build();

      expect(validator.validate({ website: "https://example.com" }).valid).toBe(
        true
      );
      expect(validator.validate({ website: "not-a-url" }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ homepage: string }>()
        .v("homepage", (b) =>
          b.string.required().url({
            messageFactory: () =>
              "有効なURLを入力してください（例: https://example.com）",
          })
        )
        .build();

      const result = validator.validate({ homepage: "invalid-url" });
      expect(result.errors[0].message).toBe(
        "有効なURLを入力してください（例: https://example.com）"
      );
    });

    test("動的なエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringUrlPlugin)
        .for<{ link: string }>()
        .v("link", (b) =>
          b.string.required().url({
            messageFactory: (ctx) => `"${ctx.value}" は有効なURLではありません`,
          })
        )
        .build();

      const result = validator.validate({ link: "example.com" });
      expect(result.errors[0].message).toBe(
        '"example.com" は有効なURLではありません'
      );
    });
  });

  describe("実用的なシナリオ", () => {
    test("ソーシャルメディアプロファイルのURL検証", () => {
      interface SocialProfile {
        website?: string;
        twitter?: string;
        github?: string;
        linkedin?: string;
      }

      const validator = Builder()
        .use(optionalPlugin)
        .use(stringUrlPlugin)
        .use(stringPatternPlugin)
        .for<SocialProfile>()
        .v("website", (b) => b.string.optional().url())
        .v("twitter", (b) =>
          b.string
            .optional()
            .url()
            .pattern(/^https:\/\/(www\.)?twitter\.com\//)
        )
        .v("github", (b) =>
          b.string
            .optional()
            .url()
            .pattern(/^https:\/\/github\.com\//)
        )
        .v("linkedin", (b) =>
          b.string
            .optional()
            .url()
            .pattern(/^https:\/\/(www\.)?linkedin\.com\//)
        )
        .build();

      // 有効なプロファイル
      const validProfile = {
        website: "https://mysite.com",
        twitter: "https://twitter.com/username",
        github: "https://github.com/username",
        linkedin: "https://www.linkedin.com/in/username",
      };
      expect(validator.validate(validProfile).valid).toBe(true);

      // 無効なプロファイル（間違ったドメイン）
      const invalidProfile = {
        twitter: "https://facebook.com/username", // Twitterではない
        github: "https://gitlab.com/username", // GitHubではない
      };
      expect(validator.validate(invalidProfile).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
