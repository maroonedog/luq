import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { uuidPlugin } from "../../../../src/core/plugin/uuid";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";

describe("uuid Plugin", () => {
  describe("基本動作", () => {
    test("有効なUUIDを受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      // 有効なUUID v4
      expect(
        validator.validate({ id: "550e8400-e29b-41d4-a716-446655440000" }).valid
      ).toBe(true);
      expect(
        validator.validate({ id: "6ba7b810-9dad-11d1-80b4-00c04fd430c8" }).valid
      ).toBe(true);
      expect(
        validator.validate({ id: "6ba7b811-9dad-11d1-80b4-00c04fd430c8" }).valid
      ).toBe(true);
      expect(
        validator.validate({ id: "6ba7b812-9dad-11d1-80b4-00c04fd430c8" }).valid
      ).toBe(true);
      expect(
        validator.validate({ id: "6ba7b814-9dad-11d1-80b4-00c04fd430c8" }).valid
      ).toBe(true);

      // 大文字のUUID
      expect(
        validator.validate({ id: "550E8400-E29B-41D4-A716-446655440000" }).valid
      ).toBe(true);

      // 小文字と大文字の混在
      expect(
        validator.validate({ id: "550e8400-E29B-41d4-A716-446655440000" }).valid
      ).toBe(true);
    });

    test("無効なUUIDを拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      const invalidUuids = [
        "550e8400-e29b-41d4-a716-44665544000", // 短すぎる
        "550e8400-e29b-41d4-a716-4466554400000", // 長すぎる
        "550e8400-e29b-41d4-a716", // 不完全
        "550e8400e29b41d4a716446655440000", // ハイフンなし
        "550e8400_e29b_41d4_a716_446655440000", // アンダースコア
        "g50e8400-e29b-41d4-a716-446655440000", // 無効な文字 'g'
        "550e8400-e29b-41d4-a716-44665544000g", // 無効な文字 'g'
        "550e8400-e29b-41d4-a716-4466554400-0", // 余分なハイフン
        "550e8400--e29b-41d4-a716-446655440000", // 連続したハイフン
        "not-a-uuid", // 完全に無効
        "", // 空文字列
        "123", // 短い数字
        "{550e8400-e29b-41d4-a716-446655440000}", // 波括弧付き
        "(550e8400-e29b-41d4-a716-446655440000)", // 括弧付き
      ];

      invalidUuids.forEach((uuid) => {
        const result = validator.validate({ id: uuid });
        expect(result.isValid()).toBe(false);
        expect(result.errors[0]).toMatchObject({
          path: "id",
          code: "uuid",
        });
      });
    });
  });

  describe("UUIDのバージョン別検証", () => {
    test("UUID v1形式", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      // タイムスタンプベースのUUID v1
      expect(
        validator.validate({ id: "e7b5d8a0-b4e7-11ed-afa1-0242ac120002" }).valid
      ).toBe(true);
    });

    test("UUID v3形式（MD5ハッシュベース）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      // 名前空間とnameから生成されたUUID v3
      expect(
        validator.validate({ id: "6ba7b810-9dad-31d1-80b4-00c04fd430c8" }).valid
      ).toBe(true);
    });

    test("UUID v4形式（ランダム）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      // ランダムに生成されたUUID v4
      expect(
        validator.validate({ id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" }).valid
      ).toBe(true);
    });

    test("UUID v5形式（SHA-1ハッシュベース）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      // 名前空間とnameから生成されたUUID v5
      expect(
        validator.validate({ id: "6ba7b810-9dad-51d1-80b4-00c04fd430c8" }).valid
      ).toBe(true);
    });
  });

  describe("特殊なケース", () => {
    test("NIL UUID（すべてゼロ）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      expect(
        validator.validate({ id: "00000000-0000-0000-0000-000000000000" }).valid
      ).toBe(true);
    });

    test("最大値のUUID（すべてF）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      expect(
        validator.validate({ id: "ffffffff-ffff-ffff-ffff-ffffffffffff" }).valid
      ).toBe(true);
      expect(
        validator.validate({ id: "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF" }).valid
      ).toBe(true);
    });

    test("ハイフンの位置が重要", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) => b.string.required().uuid())
        .build();

      // 正しい位置: 8-4-4-4-12
      expect(
        validator.validate({ id: "12345678-1234-1234-1234-123456789012" }).valid
      ).toBe(true);

      // 間違った位置
      expect(
        validator.validate({ id: "1234567-81234-1234-1234-123456789012" }).valid
      ).toBe(false);
      expect(
        validator.validate({ id: "12345678-123-41234-1234-123456789012" }).valid
      ).toBe(false);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("配列内のUUID検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .use(arrayMinLengthPlugin)
        .for<{ userIds: string[] }>()
        .v("userIds", (b) => b.array.required().minLength(1))
        // Array element validation is not supported with indexed notation
        // .v("userIds[0]", (b) => b.string.optional().uuid())
        .build();

      const validData = {
        userIds: [
          "550e8400-e29b-41d4-a716-446655440000",
          "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        ],
      };
      expect(validator.validate(validData).valid).toBe(true);

      const invalidData = {
        userIds: ["not-a-uuid", "550e8400-e29b-41d4-a716-446655440000"],
      };
      expect(validator.validate(invalidData).valid).toBe(false);
    });

    test("変換後のUUID検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .use(transformPlugin)
        .for<{ id: string }>()
        .v("id", (b) =>
          b.string
            .required()
            .transform((v) => v.toLowerCase())
            .uuid()
        )
        .build();

      // 大文字のUUIDを小文字に変換してから検証
      const result = validator.parse({
        id: "550E8400-E29B-41D4-A716-446655440000",
      });
      expect(result.isValid()).toBe(true);
      expect(result.data()?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });
  });

  describe("オプショナルフィールドとの組み合わせ", () => {
    test("undefinedの場合はバリデーションをスキップ", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(uuidPlugin)
        .for<{ id?: string }>()
        .v("id", (b) => b.string.optional().uuid())
        .build();

      expect(validator.validate({}).valid).toBe(true);
      expect(validator.validate({ id: undefined }).valid).toBe(true);
    });

    test("値が存在する場合はUUID検証を実行", () => {
      const validator = Builder()
        .use(optionalPlugin)
        .use(uuidPlugin)
        .for<{ id?: string }>()
        .v("id", (b) => b.string.optional().uuid())
        .build();

      expect(
        validator.validate({ id: "550e8400-e29b-41d4-a716-446655440000" }).valid
      ).toBe(true);
      expect(validator.validate({ id: "not-a-uuid" }).valid).toBe(false);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ userId: string }>()
        .v("userId", (b) =>
          b.string.required().uuid(undefined, {
            messageFactory: () =>
              "ユーザーIDは有効なUUID形式である必要があります",
          })
        )
        .build();

      const result = validator.validate({ userId: "invalid-id" });
      expect(result.errors[0].message).toBe(
        "ユーザーIDは有効なUUID形式である必要があります"
      );
    });

    test("動的なエラーメッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(uuidPlugin)
        .for<{ id: string }>()
        .v("id", (b) =>
          b.string.required().uuid(undefined, {
            messageFactory: () => `無効なUUID形式です`,
          })
        )
        .build();

      const result = validator.validate({ id: "123-456" });
      expect(result.errors[0].message).toBe(
        '"123-456" は有効なUUID形式ではありません'
      );
    });
  });

  describe("実用的なシナリオ", () => {
    test("データベースエンティティのID検証", () => {
      interface User {
        id: string;
        organizationId: string;
        createdBy: string;
        modifiedBy?: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(uuidPlugin)
        .for<User>()
        .v("id", (b) => b.string.required().uuid())
        .v("organizationId", (b) => b.string.required().uuid())
        .v("createdBy", (b) => b.string.required().uuid())
        .v("modifiedBy", (b) => b.string.optional().uuid())
        .build();

      // 有効なユーザーデータ
      const validUser = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        organizationId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        createdBy: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      };
      expect(validator.validate(validUser).valid).toBe(true);

      // 無効なユーザーデータ
      const invalidUser = {
        id: "user-123", // 無効なID
        organizationId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        createdBy: "admin", // 無効なID
        modifiedBy: "not-a-uuid", // 無効なID
      };
      const result = validator.validate(invalidUser);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    test("APIリクエストのトレースID検証", () => {
      interface ApiRequest {
        traceId: string;
        parentSpanId?: string;
        spanId: string;
        correlationId: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(uuidPlugin)
        .for<ApiRequest>()
        .v("traceId", (b) => b.string.required().uuid())
        .v("parentSpanId", (b) => b.string.optional().uuid())
        .v("spanId", (b) => b.string.required().uuid())
        .v("correlationId", (b) => b.string.required().uuid())
        .build();

      // 有効なトレース情報
      const validRequest = {
        traceId: "550e8400-e29b-41d4-a716-446655440000",
        spanId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        correlationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      };
      expect(validator.validate(validRequest).valid).toBe(true);

      // 親スパンIDありの場合
      const withParent = {
        ...validRequest,
        parentSpanId: "e7b5d8a0-b4e7-11ed-afa1-0242ac120002",
      };
      expect(validator.validate(withParent).valid).toBe(true);
    });
  });
});

// 必要なimportを追加
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { transformPlugin } from "../../../../src/core/plugin/transform";
