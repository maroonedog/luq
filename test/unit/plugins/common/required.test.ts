import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { requiredPlugin } from "../../../../src/core/plugin/required";

describe("required Plugin", () => {
  describe("基本動作", () => {
    test("値が存在する場合は受け入れる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required())
        .build();

      const result = validator.validate({ name: "John" });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("値が存在しない場合は拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required())
        .build();

      const result = validator.validate({});
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        path: "name",
        code: "required",
      });
    });

    test("undefinedを拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ name: string | undefined }>()
        .v("name", (b) => b.string.required())
        .build();

      const result = validator.validate({ name: undefined });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("required");
    });

    test("nullを拒否する", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ name: string | null }>()
        .v("name", (b) => b.string.required())
        .build();

      const result = validator.validate({ name: null });
      expect(result.isValid()).toBe(false);
      expect(result.errors[0].code).toBe("required");
    });
  });

  describe("様々な型での動作", () => {
    test("文字列型", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.required())
        .build();

      expect(validator.validate({ value: "hello" }).valid).toBe(true);
      expect(validator.validate({ value: "" }).valid).toBe(false); // 空文字列は無効
      expect(validator.validate({}).valid).toBe(false);
    });

    test("数値型", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required())
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true); // 0は存在する値
      expect(validator.validate({ value: -1 }).valid).toBe(true);
      expect(validator.validate({ value: 123 }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(false);
    });

    test("ブーリアン型", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: boolean }>()
        .v("value", (b) => b.boolean.required())
        .build();

      expect(validator.validate({ value: true }).valid).toBe(true);
      expect(validator.validate({ value: false }).valid).toBe(true); // falseも存在する値
      expect(validator.validate({}).valid).toBe(false);
    });

    test("配列型", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: any[] }>()
        .v("value", (b) => b.array.required())
        .build();

      expect(validator.validate({ value: [1, 2, 3] }).valid).toBe(true);
      expect(validator.validate({ value: [] }).valid).toBe(true); // 空配列は存在する値
      expect(validator.validate({}).valid).toBe(false);
    });

    test("オブジェクト型", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: object }>()
        .v("value", (b) => b.object.required())
        .build();

      expect(validator.validate({ value: { key: "value" } }).valid).toBe(true);
      expect(validator.validate({ value: {} }).valid).toBe(true); // 空オブジェクトは存在する値
      expect(validator.validate({}).valid).toBe(false);
    });

    test("Date型", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: Date }>()
        .v("value", (b) => b.date.required())
        .build();

      expect(validator.validate({ value: new Date() }).valid).toBe(true);
      expect(validator.validate({ value: new Date("2024-01-01") }).valid).toBe(
        true
      );
      expect(validator.validate({}).valid).toBe(false);
    });
  });

  describe("ネストしたフィールド", () => {
    test("1階層のネスト", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ user: { name: string } }>()
        .v("user.name", (b) => b.string.required())
        .build();

      expect(validator.validate({ user: { name: "John" } }).valid).toBe(true);
      expect(validator.validate({ user: {} }).valid).toBe(false);
      expect(validator.validate({}).valid).toBe(false);
    });

    test("深いネスト", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{
          company: {
            department: {
              team: {
                leader: string;
              };
            };
          };
        }>()
        .v("company.department.team.leader", (b) => b.string.required())
        .build();

      expect(
        validator.validate({
          company: {
            department: {
              team: {
                leader: "Alice",
              },
            },
          },
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          company: {
            department: {},
          },
        }).valid
      ).toBe(false);
    });

    test("配列内のオブジェクトのフィールド", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ items: Array<{ id: number; name: string }> }>()
        .v("items[*].name", (b) => b.string.required())
        .build();

      expect(
        validator.validate({
          items: [{ id: 1, name: "Item 1" }],
        }).valid
      ).toBe(true);

      expect(
        validator.validate({
          items: [{ id: 1 }],
        } as any).valid
      ).toBe(false);

      expect(
        validator.validate({
          items: [],
        }).valid
      ).toBe(true); // 空配列の場合はバリデーション対象がないのでtrue
    });
  });

  describe("falsy値の扱い", () => {
    test("空文字列は無効として扱う", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: string }>()
        .v("value", (b) => b.string.required())
        .build();

      expect(validator.validate({ value: "" }).valid).toBe(false);
    });

    test("数値の0は存在する値として扱う", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required())
        .build();

      expect(validator.validate({ value: 0 }).valid).toBe(true);
    });

    test("falseは存在する値として扱う", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: boolean }>()
        .v("value", (b) => b.boolean.required())
        .build();

      expect(validator.validate({ value: false }).valid).toBe(true);
    });

    test("NaNは存在する値として扱う", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ value: number }>()
        .v("value", (b) => b.number.required())
        .build();

      const testData = { value: NaN };
      const result = validator.validate(testData);

      expect(result.isValid()).toBe(true);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("カスタムエラーメッセージを設定できる", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ email: string }>()
        .v("email", (b) =>
          b.string.required({
            messageFactory: () => "メールアドレスは必須です",
          })
        )
        .build();

      const result = validator.validate({});
      expect(result.errors[0].message).toBe("メールアドレスは必須です");
    });

    test("フィールド名を含む動的メッセージ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{ firstName: string; lastName: string }>()
        .v("firstName", (b) =>
          b.string.required({
            messageFactory: (ctx) => `${ctx.path}を入力してください`,
          })
        )
        .v("lastName", (b) =>
          b.string.required({
            messageFactory: (ctx) => `${ctx.path}を入力してください`,
          })
        )
        .build();

      const result = validator.validate({});
      expect(result.errors.find((e) => e.path === "firstName")?.message).toBe(
        "firstNameを入力してください"
      );
      expect(result.errors.find((e) => e.path === "lastName")?.message).toBe(
        "lastNameを入力してください"
      );
    });
  });

  describe("複数フィールドでの使用", () => {
    test("複数の必須フィールド", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .for<{
          firstName: string;
          lastName: string;
          email: string;
        }>()
        .v("firstName", (b) => b.string.required())
        .v("lastName", (b) => b.string.required())
        .v("email", (b) => b.string.required())
        .build();

      // すべて存在
      expect(
        validator.validate({
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
        }).valid
      ).toBe(true);

      // 一部欠落
      const result = validator.validate({
        firstName: "John",
      });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.map((e) => e.path).sort()).toEqual([
        "email",
        "lastName",
      ]);
    });
  });

  describe("他のバリデーションとの組み合わせ", () => {
    test("requiredと文字列長の組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ username: string }>()
        .v("username", (b) => b.string.required().min(3))
        .build();

      // 存在しない
      expect(validator.validate({}).errors[0].code).toBe("required");

      // 存在するが短い
      expect(validator.validate({ username: "ab" }).errors[0].code).toBe(
        "stringMin"
      );

      // 条件を満たす
      expect(validator.validate({ username: "abc" }).valid).toBe(true);
    });

    test("requiredと数値範囲の組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<{ age: number }>()
        .v("age", (b) => b.number.required().min(0).max(150))
        .build();

      // 存在しない
      expect(validator.validate({}).errors[0].code).toBe("required");

      // 存在するが範囲外
      expect(validator.validate({ age: -1 }).errors[0].code).toBe("numberMin");
      expect(validator.validate({ age: 200 }).errors[0].code).toBe("numberMax");

      // 条件を満たす
      expect(validator.validate({ age: 25 }).valid).toBe(true);
    });
  });

  describe("パフォーマンステスト", () => {
    test("大量のフィールドでも高速に動作する", () => {
      // シンプルな10フィールドのテストに変更
      const validator = Builder()
        .use(requiredPlugin)
        .for<{
          field0: string;
          field1: string;
          field2: string;
          field3: string;
          field4: string;
          field5: string;
          field6: string;
          field7: string;
          field8: string;
          field9: string;
        }>()
        .v("field0", (b) => b.string.required())
        .v("field1", (b) => b.string.required())
        .v("field2", (b) => b.string.required())
        .v("field3", (b) => b.string.required())
        .v("field4", (b) => b.string.required())
        .v("field5", (b) => b.string.required())
        .v("field6", (b) => b.string.required())
        .v("field7", (b) => b.string.required())
        .v("field8", (b) => b.string.required())
        .v("field9", (b) => b.string.required())
        .build();

      const data = {
        field0: "value",
        field1: "value",
        field2: "value",
        field3: "value",
        field4: "value",
        field5: "value",
        field6: "value",
        field7: "value",
        field8: "value",
        field9: "value",
      };

      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        validator.validate(data);
      }

      const end = performance.now();
      const timePerValidation = (end - start) / 10000;

      // 1回のバリデーションが1ms未満であることを確認
      expect(timePerValidation).toBeLessThan(1);
    });
  });
});

// 必要なimportを追加
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
