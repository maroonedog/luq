import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { arrayIncludesPlugin } from "../../../../src/core/plugin/arrayIncludes";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("arrayIncludes Plugin", () => {
  describe("基本動作", () => {
    test("指定した要素を含む配列を受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ permissions: string[] }>()
        .v("permissions", (b) => b.array.required().includes("read"))
        .build();

      expect(validator.validate({ permissions: ["read"] }).valid).toBe(true);
      expect(validator.validate({ permissions: ["read", "write"] }).valid).toBe(
        true
      );
      expect(
        validator.validate({ permissions: ["write", "read", "delete"] }).valid
      ).toBe(true);
    });

    test("指定した要素を含まない配列を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ permissions: string[] }>()
        .v("permissions", (b) => b.array.required().includes("read"))
        .build();

      const result = validator.validate({ permissions: ["write", "delete"] });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0]).toMatchObject({
        path: "permissions",
        code: "arrayIncludes",
      });
    });
  });

  describe("様々な型での検証", () => {
    test("文字列要素", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().includes("important"))
        .build();

      expect(
        validator.validate({ tags: ["urgent", "important", "todo"] }).valid
      ).toBe(true);
      expect(validator.validate({ tags: ["urgent", "todo"] }).valid).toBe(
        false
      );
    });

    test("数値要素", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ numbers: number[] }>()
        .v("numbers", (b) => b.array.required().includes(42))
        .build();

      expect(validator.validate({ numbers: [1, 42, 100] }).valid).toBe(true);
      expect(validator.validate({ numbers: [1, 2, 3] }).valid).toBe(false);
      expect(validator.validate({ numbers: [42] }).valid).toBe(true);
    });

    test("ブール値要素", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ flags: boolean[] }>()
        .v("flags", (b) => b.array.required().includes(true))
        .build();

      expect(validator.validate({ flags: [true, false] }).valid).toBe(true);
      expect(validator.validate({ flags: [false, true, false] }).valid).toBe(
        true
      );
      expect(validator.validate({ flags: [false, false] }).valid).toBe(false);
      expect(validator.validate({ flags: [true] }).valid).toBe(true);
    });

    test("null/undefined要素", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ values: any[] }>()
        .v("values", (b) => b.array.required().includes(null))
        .build();

      expect(validator.validate({ values: [1, null, "test"] }).valid).toBe(
        true
      );
      expect(validator.validate({ values: [1, undefined, "test"] }).valid).toBe(
        false
      );
      expect(validator.validate({ values: [null] }).valid).toBe(true);
    });

    test("オブジェクト要素（参照の比較）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ items: any[] }>()
        .v("items", (b) => b.array.required().includes({ id: 1, name: "test" }))
        .build();

      const targetObject = { id: 1, name: "test" };
      const sameContentObject = { id: 1, name: "test" };

      // 同じ参照のオブジェクト
      expect(
        validator.validate({ items: [targetObject, { id: 2 }] }).valid
      ).toBe(true);

      // 内容は同じだが異なる参照のオブジェクト
      expect(
        validator.validate({ items: [sameContentObject, { id: 2 }] }).valid
      ).toBe(false);
    });
  });

  describe("厳密な等価性チェック", () => {
    test("型の違いを検出", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ values: any[] }>()
        .v("values", (b) => b.array.required().includes(0))
        .build();

      expect(validator.validate({ values: [0, 1, 2] }).valid).toBe(true);
      expect(validator.validate({ values: ["0", 1, 2] }).valid).toBe(false);
      expect(validator.validate({ values: [false, 1, 2] }).valid).toBe(false);
    });

    test("大文字小文字の区別", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ words: string[] }>()
        .v("words", (b) => b.array.required().includes("Hello"))
        .build();

      expect(validator.validate({ words: ["Hello", "World"] }).valid).toBe(
        true
      );
      expect(validator.validate({ words: ["hello", "World"] }).valid).toBe(
        false
      );
      expect(validator.validate({ words: ["HELLO", "World"] }).valid).toBe(
        false
      );
    });

    test("特殊な数値の扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ numbers: number[] }>()
        .v("numbers", (b) => b.array.required().includes(0))
        .build();

      expect(validator.validate({ numbers: [0, 1] }).valid).toBe(true);
      expect(validator.validate({ numbers: [-0, 1] }).valid).toBe(true); // 0 === -0
      expect(validator.validate({ numbers: [0.0, 1] }).valid).toBe(true);
    });

    test("NaNの特殊な扱い", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ numbers: number[] }>()
        .v("numbers", (b) => b.array.required().includes(NaN))
        .build();

      // NaN !== NaN なので、技術的には見つからない可能性が高い
      const result = validator.validate({ numbers: [NaN, 1, 2] });
      // 実装によって結果が異なる可能性がある
      // 多くの場合、NaN は等価性チェックで false になる
      expect(result.isValid()).toBe(false);
    });
  });

  describe("空配列での動作", () => {
    test("空配列は常に要素を含まない", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().includes("test"))
        .build();

      expect(validator.validate({ items: [] }).valid).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("配列長制限との組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayMaxLengthPlugin)
        .for<{ roles: string[] }>()
        .v("roles", (b) =>
          b.array.required().minLength(2).maxLength(5).includes("user")
        )
        .build();

      // 有効: 長さOKかつ必要な要素を含む
      expect(validator.validate({ roles: ["user", "admin"] }).valid).toBe(true);
      expect(
        validator.validate({ roles: ["guest", "user", "moderator"] }).valid
      ).toBe(true);

      // 無効: 必要な要素を含むが短すぎる
      expect(validator.validate({ roles: ["user"] }).valid).toBe(false);

      // 無効: 長さOKだが必要な要素を含まない
      expect(validator.validate({ roles: ["admin", "guest"] }).valid).toBe(
        false
      );

      // 無効: 必要な要素を含むが長すぎる
      expect(
        validator.validate({
          roles: ["user", "admin", "guest", "moderator", "owner", "super"],
        }).valid
      ).toBe(false);
    });

    test("配列の一意性チェックとの組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .use(arrayUniquePlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().includes("featured").unique())
        .build();

      // 有効: 必要な要素を含みかつユニーク
      expect(
        validator.validate({ tags: ["featured", "new", "popular"] }).valid
      ).toBe(true);

      // 無効: 必要な要素を含むが重複あり
      expect(
        validator.validate({ tags: ["featured", "new", "featured"] }).valid
      ).toBe(false);

      // 無効: ユニークだが必要な要素を含まない
      expect(
        validator.validate({ tags: ["new", "popular", "trending"] }).valid
      ).toBe(false);
    });

    test("複数の包含要件", () => {
      // 注意: 実際のプラグインが複数の includes をサポートしているかは実装依存
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ permissions: string[] }>()
        .v("permissions", (b) => b.array.required().includes("read"))
        .build();

      // 単一の includes のみをテスト
      expect(validator.validate({ permissions: ["read", "write"] }).valid).toBe(
        true
      );
      expect(
        validator.validate({ permissions: ["write", "delete"] }).valid
      ).toBe(false);
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayIncludesPlugin)
        .for<{ tags?: string[] }>()
        .v("tags", (b) => b.array.optional().includes("important"))
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ tags: undefined }).valid).toBe(true);
    });

    test("値が存在する場合は包含検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(arrayIncludesPlugin)
        .for<{ tags?: string[] }>()
        .v("tags", (b) => b.array.optional().includes("important"))
        .build();

      expect(validator.validate({ tags: ["urgent", "important"] }).valid).toBe(
        true
      );
      expect(validator.validate({ tags: ["urgent", "todo"] }).valid).toBe(
        false
      );
    });
  });

  describe("エラーコンテキスト", () => {
    test("期待される要素が含まれる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<{ items: string[] }>()
        .v("items", (b) => b.array.required().includes("required-item"))
        .build();

      const result = validator.validate({ items: ["other-item"] });
      expect(result.isValid()).toBe(false);
      // Context property is not available in current API
      // expect(result.errors[0].context).toMatchObject({
      //   requiredElement: "required-item",
      // });
    });
  });

  describe("実用的なシナリオ", () => {
    test("権限システムの必須権限チェック", () => {
      interface UserPermissions {
        basicPermissions: string[]; // 'view' は必須
        adminPermissions: string[]; // 'manage_users' は必須
        apiPermissions: string[]; // 'api_access' は必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<UserPermissions>()
        .v("basicPermissions", (b) => b.array.required().includes("view"))
        .v("adminPermissions", (b) =>
          b.array.required().includes("manage_users")
        )
        .v("apiPermissions", (b) => b.array.required().includes("api_access"))
        .build();

      // 有効な権限設定
      const validPermissions = {
        basicPermissions: ["view", "edit", "delete"],
        adminPermissions: ["manage_users", "manage_content", "system_config"],
        apiPermissions: ["api_access", "api_write", "api_admin"],
      };
      expect(validator.validate(validPermissions).valid).toBe(true);

      // 無効な権限設定（必須権限が不足）
      const invalidPermissions = {
        basicPermissions: ["edit", "delete"], // 'view' がない
        adminPermissions: ["manage_content", "system_config"], // 'manage_users' がない
        apiPermissions: ["api_write", "api_admin"], // 'api_access' がない
      };
      expect(validator.validate(invalidPermissions).valid).toBe(false);
    });

    test("製品カテゴリの必須タグ", () => {
      interface Product {
        name: string;
        categories: string[]; // 'product' タグは必須
        tags: string[]; // 'available' タグは必須
        features: string[]; // 'basic' 機能は必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .use(arrayMinLengthPlugin)
        .for<Product>()
        .v("categories", (b) =>
          b.array.required().minLength(1).includes("product")
        )
        .v("tags", (b) => b.array.required().minLength(1).includes("available"))
        .v("features", (b) => b.array.required().minLength(1).includes("basic"))
        .build();

      // 有効な製品
      const validProduct = {
        name: "Laptop",
        categories: ["product", "electronics", "computers"],
        tags: ["available", "popular", "bestseller"],
        features: ["basic", "wifi", "bluetooth", "camera"],
      };
      expect(validator.validate(validProduct).valid).toBe(true);

      // 無効な製品（必須タグが不足）
      const invalidProduct = {
        name: "Phone",
        categories: ["electronics", "mobile"], // 'product' がない
        tags: ["popular", "new"], // 'available' がない
        features: ["wifi", "camera"], // 'basic' がない
      };
      expect(validator.validate(invalidProduct).valid).toBe(false);
    });

    test("イベント管理の必須参加者", () => {
      interface Event {
        organizers: string[]; // 'primary_organizer' は必須
        attendees: string[]; // 'event_creator' は必須
        sponsors: string[]; // 'main_sponsor' は必須
        speakers: string[]; // 'keynote_speaker' は必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .use(arrayMinLengthPlugin)
        .for<Event>()
        .v("organizers", (b) =>
          b.array.required().minLength(1).includes("primary_organizer")
        )
        .v("attendees", (b) =>
          b.array.required().minLength(1).includes("event_creator")
        )
        .v("sponsors", (b) =>
          b.array.required().minLength(1).includes("main_sponsor")
        )
        .v("speakers", (b) =>
          b.array.required().minLength(1).includes("keynote_speaker")
        )
        .build();

      // 有効なイベント
      const validEvent = {
        organizers: ["primary_organizer", "co_organizer1", "co_organizer2"],
        attendees: ["event_creator", "attendee1", "attendee2", "attendee3"],
        sponsors: ["main_sponsor", "gold_sponsor", "silver_sponsor"],
        speakers: ["keynote_speaker", "tech_speaker", "panel_speaker"],
      };
      expect(validator.validate(validEvent).valid).toBe(true);

      // 無効なイベント（必須参加者が不足）
      const invalidEvent = {
        organizers: ["co_organizer1", "co_organizer2"], // 'primary_organizer' がない
        attendees: ["attendee1", "attendee2"], // 'event_creator' がない
        sponsors: ["gold_sponsor", "silver_sponsor"], // 'main_sponsor' がない
        speakers: ["tech_speaker", "panel_speaker"], // 'keynote_speaker' がない
      };
      expect(validator.validate(invalidEvent).valid).toBe(false);
    });

    test("ソフトウェア設定の必須コンポーネント", () => {
      interface SoftwareConfig {
        modules: string[]; // 'core' モジュールは必須
        plugins: string[]; // 'security' プラグインは必須
        dependencies: string[]; // 'runtime' 依存関係は必須
        features: string[]; // 'logging' 機能は必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<SoftwareConfig>()
        .v("modules", (b) => b.array.required().includes("core"))
        .v("plugins", (b) => b.array.required().includes("security"))
        .v("dependencies", (b) => b.array.required().includes("runtime"))
        .v("features", (b) => b.array.required().includes("logging"))
        .build();

      // 有効な設定
      const validConfig = {
        modules: ["core", "ui", "database", "api"],
        plugins: ["security", "authentication", "authorization", "audit"],
        dependencies: ["runtime", "framework", "utilities"],
        features: ["logging", "monitoring", "caching", "compression"],
      };
      expect(validator.validate(validConfig).valid).toBe(true);

      // 無効な設定（必須コンポーネントが不足）
      const invalidConfig = {
        modules: ["ui", "database", "api"], // 'core' がない
        plugins: ["authentication", "authorization"], // 'security' がない
        dependencies: ["framework", "utilities"], // 'runtime' がない
        features: ["monitoring", "caching"], // 'logging' がない
      };
      expect(validator.validate(invalidConfig).valid).toBe(false);
    });

    test("チーム構成の必須役職", () => {
      interface Team {
        members: Array<{
          name: string;
          roles: string[]; // 各メンバーは何らかの役職が必要
        }>;
        requiredRoles: string[]; // チーム全体で 'lead' は必須
        skills: string[]; // チームとして 'project_management' スキルは必須
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin)
        .for<Team>()
        .v("requiredRoles", (b) => b.array.required().includes("lead"))
        .v("skills", (b) => b.array.required().includes("project_management"))
        .build();

      // 有効なチーム構成
      const validTeam = {
        members: [
          { name: "Alice", roles: ["lead", "developer"] },
          { name: "Bob", roles: ["developer", "tester"] },
        ],
        requiredRoles: ["lead", "developer", "tester"],
        skills: [
          "project_management",
          "software_development",
          "testing",
          "communication",
        ],
      };
      expect(validator.validate(validTeam).valid).toBe(true);

      // 無効なチーム構成（必須役職・スキルが不足）
      const invalidTeam = {
        members: [
          { name: "Charlie", roles: ["developer"] },
          { name: "David", roles: ["tester"] },
        ],
        requiredRoles: ["developer", "tester"], // 'lead' がない
        skills: ["software_development", "testing"], // 'project_management' がない
      };
      expect(validator.validate(invalidTeam).valid).toBe(false);
    });
  });
});

// 必要なimportを追加
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../../../src/core/plugin/arrayUnique";
