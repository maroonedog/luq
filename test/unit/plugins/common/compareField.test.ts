import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { compareFieldPlugin } from "../../../../src/core/plugin/compareField";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringDatetimePlugin } from "../../../../src/core/plugin/stringDatetime";

describe("compareField Plugin", () => {
  describe("基本動作（デフォルト比較）", () => {
    test("指定したフィールドと同じ値を受け入れる（===）", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<{ password: string; confirmPassword: string }>()
        .v("password", (b) => b.string.required())
        .v("confirmPassword", (b) =>
          b.string.required().compareField("password")
        )
        .build();

      expect(
        validator.validate({
          password: "secret123",
          confirmPassword: "secret123",
        }).valid
      ).toBe(true);
    });

    test("指定したフィールドと異なる値を拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<{ password: string; confirmPassword: string }>()
        .v("password", (b) => b.string.required())
        .v("confirmPassword", (b) =>
          b.string.required().compareField("password")
        )
        .build();

      const result = validator.validate({
        password: "secret123",
        confirmPassword: "secret456",
      });
      expect(result.isValid()).toBe(false);
    });
  });

  describe("カスタム比較関数", () => {
    test("日付の前後関係を検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringDatetimePlugin)
        .use(compareFieldPlugin)
        .for<{ startDate: string; endDate: string }>()
        .v("startDate", (b) => b.string.required().datetime())
        .v("endDate", (b) =>
          b.string
            .required()
            .datetime()
            .compareField("startDate", {
              compareFn: (endDate: any, startDate: any) =>
                new Date(endDate) > new Date(startDate),
              messageFactory: () => "End date must be after start date",
            } as any)
        )
        .build();

      // 正しい順序
      expect(
        validator.validate({
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-01-02T00:00:00Z",
        }).valid
      ).toBe(true);

      // 逆の順序
      const result = validator.validate({
        startDate: "2024-01-02T00:00:00Z",
        endDate: "2024-01-01T00:00:00Z",
      });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toBe(
        "End date must be after start date"
      );

      // 同じ日時
      expect(
        validator.validate({
          startDate: "2024-01-01T00:00:00Z",
          endDate: "2024-01-01T00:00:00Z",
        }).valid
      ).toBe(false);
    });

    test("数値の大小関係を検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<{ minPrice: number; maxPrice: number }>()
        .v("minPrice", (b) => b.number.required())
        .v("maxPrice", (b) =>
          b.number.required().compareField("minPrice", {
            compareFn: (max: any, min: any) => max >= min,
            messageFactory: () =>
              "Maximum price must be greater than or equal to minimum price",
          } as any)
        )
        .build();

      // 正しい範囲
      expect(
        validator.validate({
          minPrice: 100,
          maxPrice: 200,
        }).valid
      ).toBe(true);

      // 同じ値（境界値）
      expect(
        validator.validate({
          minPrice: 100,
          maxPrice: 100,
        }).valid
      ).toBe(true);

      // 逆の範囲
      expect(
        validator.validate({
          minPrice: 200,
          maxPrice: 100,
        }).valid
      ).toBe(false);
    });

    test("配列の長さを比較", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<{ items: string[]; maxSelections: number }>()
        .v("items", (b) => b.array.required())
        .v("maxSelections", (b) =>
          b.number.required().compareField("items", {
            compareFn: (maxNum: any, items: any) =>
              Array.isArray(items) && items.length <= maxNum,
            messageFactory: ({ value }: any) =>
              `Number of items (${value}) must not exceed maximum selections`,
          } as any)
        )
        .build();

      // 制限内
      expect(
        validator.validate({
          items: ["a", "b", "c"],
          maxSelections: 5,
        }).valid
      ).toBe(true);

      // 制限ちょうど
      expect(
        validator.validate({
          items: ["a", "b", "c"],
          maxSelections: 3,
        }).valid
      ).toBe(true);

      // 制限超過
      expect(
        validator.validate({
          items: ["a", "b", "c", "d", "e"],
          maxSelections: 3,
        }).valid
      ).toBe(false);
    });

    test("文字列の包含関係を検証", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<{ baseUrl: string; fullUrl: string }>()
        .v("baseUrl", (b) => b.string.required())
        .v("fullUrl", (b) =>
          b.string.required().compareField("baseUrl", {
            compareFn: (full: any, base: any) => full.startsWith(base),
            messageFactory: ({ value, targetValue }: any) =>
              `URL must start with base URL: ${targetValue}`,
          } as any)
        )
        .build();

      // 正しい包含関係
      expect(
        validator.validate({
          baseUrl: "https://api.example.com",
          fullUrl: "https://api.example.com/v1/users",
        }).valid
      ).toBe(true);

      // 異なるURL
      expect(
        validator.validate({
          baseUrl: "https://api.example.com",
          fullUrl: "https://different.com/api",
        }).valid
      ).toBe(false);
    });

    test("オブジェクトのプロパティを比較", () => {
      interface UserRole {
        user: { role: string };
        permissions: { level: string };
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<UserRole>()
        .v("user.role", (b) => b.string.required())
        .v("permissions.level", (b) =>
          b.string.required().compareField("user.role", {
            compareFn: (level: any, role: any) => {
              const roleHierarchy: Record<string, number> = {
                admin: 3,
                editor: 2,
                viewer: 1,
              };
              return (roleHierarchy[level] || 0) <= (roleHierarchy[role] || 0);
            },
            messageFactory: () => "Permission level exceeds user role privileges",
          } as any)
        )
        .build();

      // 適切な権限レベル
      expect(
        validator.validate({
          user: { role: "admin" },
          permissions: { level: "editor" },
        }).valid
      ).toBe(true);

      // 同じレベル
      expect(
        validator.validate({
          user: { role: "editor" },
          permissions: { level: "editor" },
        }).valid
      ).toBe(true);

      // 権限超過
      expect(
        validator.validate({
          user: { role: "viewer" },
          permissions: { level: "admin" },
        }).valid
      ).toBe(false);
    });
  });

  describe("全タイプのサポート", () => {
    test("null/undefinedの比較", () => {
      const validator = Builder()
        .use(compareFieldPlugin)
        .for<{ value: any; compareTo: any }>()
        .v("value", (b) => b.string)
        .v("compareTo", (b) => b.string.compareField("value"))
        .build();

      // 両方null
      expect(
        validator.validate({
          value: null,
          compareTo: null,
        }).valid
      ).toBe(true);

      // 両方undefined
      expect(
        validator.validate({
          value: undefined,
          compareTo: undefined,
        }).valid
      ).toBe(true);

      // nullとundefinedは異なる
      expect(
        validator.validate({
          value: null,
          compareTo: undefined,
        }).valid
      ).toBe(false);
    });

    test("オブジェクトの比較", () => {
      const validator = Builder()
        .use(compareFieldPlugin)
        .for<{ obj1: object; obj2: object }>()
        .v("obj1", (b) => b.object)
        .v("obj2", (b) =>
          b.object.compareField("obj1", {
            compareFn: (obj2: any, obj1: any) =>
              JSON.stringify(obj2) === JSON.stringify(obj1),
            messageFactory: () =>
              "Objects must have the same structure and values",
          } as any)
        )
        .build();

      // 同じ構造
      expect(
        validator.validate({
          obj1: { a: 1, b: "test" },
          obj2: { a: 1, b: "test" },
        }).valid
      ).toBe(true);

      // 異なる値
      expect(
        validator.validate({
          obj1: { a: 1, b: "test" },
          obj2: { a: 2, b: "test" },
        }).valid
      ).toBe(false);
    });

    test("配列の比較（カスタム関数）", () => {
      const validator = Builder()
        .use(compareFieldPlugin)
        .for<{ tags1: string[]; tags2: string[] }>()
        .v("tags1", (b) => b.array)
        .v("tags2", (b) =>
          b.array.compareField("tags1", {
            compareFn: (tags2: any, tags1: any) => {
              if (!Array.isArray(tags1) || !Array.isArray(tags2)) return false;
              if (tags1.length !== tags2.length) return false;
              const sorted1 = [...tags1].sort();
              const sorted2 = [...tags2].sort();
              return sorted1.every((tag, i) => tag === sorted2[i]);
            },
            messageFactory: () =>
              "Arrays must contain the same elements (order independent)",
          } as any)
        )
        .build();

      // 同じ要素（順序無関係）
      expect(
        validator.validate({
          tags1: ["red", "blue", "green"],
          tags2: ["blue", "green", "red"],
        }).valid
      ).toBe(true);

      // 異なる要素
      expect(
        validator.validate({
          tags1: ["red", "blue"],
          tags2: ["red", "green"],
        }).valid
      ).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("パスワード強度の比較", () => {
      const calculatePasswordStrength = (password: string): number => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        return strength;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<{ oldPassword: string; newPassword: string }>()
        .v("oldPassword", (b) => b.string.required())
        .v("newPassword", (b) =>
          b.string.required().compareField("oldPassword", {
            compareFn: (newPass: any, oldPass: any) => {
              return (
                calculatePasswordStrength(newPass) >
                calculatePasswordStrength(oldPass)
              );
            },
            messageFactory: () =>
              "New password must be stronger than the old password",
          } as any)
        )
        .build();

      // 新しいパスワードがより強い
      expect(
        validator.validate({
          oldPassword: "simple123",
          newPassword: "C0mpl3x!P@ssw0rd#2024",
        }).valid
      ).toBe(true);

      // 新しいパスワードが弱い
      expect(
        validator.validate({
          oldPassword: "C0mpl3x!P@ssw0rd",
          newPassword: "simple",
        }).valid
      ).toBe(false);
    });

    test("価格の妥当性チェック", () => {
      interface PricingForm {
        originalPrice: number;
        discountPercentage: number;
        finalPrice: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(compareFieldPlugin)
        .for<PricingForm>()
        .v("originalPrice", (b) => b.number.required())
        .v("discountPercentage", (b) => b.number.required())
        .v("finalPrice", (b) =>
          b.number.required().compareField("originalPrice", {
            compareFn: (final: any, original: any) => {
              const ctx = validator as any; // アクセスのため
              const discount = ctx.allValues?.discountPercentage || 0;
              const expected = original * (1 - discount / 100);
              return Math.abs(final - expected) < 0.01; // 誤差許容
            },
            messageFactory: ({ value }: any) => `Final price calculation is incorrect`,
          } as any)
        )
        .build();

      // 正しい計算
      expect(
        validator.validate({
          originalPrice: 100,
          discountPercentage: 20,
          finalPrice: 80,
        }).valid
      ).toBe(true);

      // 計算ミス
      expect(
        validator.validate({
          originalPrice: 100,
          discountPercentage: 20,
          finalPrice: 85,
        }).valid
      ).toBe(false);
    });
  });

  describe("エラーハンドリング", () => {
    test("存在しないフィールドの参照", () => {
      const validator = Builder()
        .use(compareFieldPlugin)
        .for<{ field1: string }>()
        .v("field1", (b) => b.string.compareField("nonexistent" as any))
        .build();

      // undefinedとの比較になる
      expect(validator.validate({ field1: "value" }).valid).toBe(false);
    });

    test("カスタムエラーメッセージ", () => {
      const validator = Builder()
        .use(compareFieldPlugin)
        .for<{ min: number; max: number }>()
        .v("min", (b) => b.number)
        .v("max", (b) =>
          b.number.compareField("min", {
            compareFn: (max: any, min: any) => max > min,
            messageFactory: ({ value, targetValue }: any) =>
              `Maximum value (${value}) must be greater than minimum value (${targetValue})`,
          } as any)
        )
        .build();

      const result = validator.validate({ min: 100, max: 50 });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].message).toContain(
        "Maximum value (50) must be greater than minimum value"
      );
    });
  });
});
