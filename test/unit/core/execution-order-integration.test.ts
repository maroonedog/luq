import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../src/core/builder";
import { requiredPlugin } from "../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../src/core/plugin/stringMax";
import { transformPlugin } from "../../../src/core/plugin/transform";
import { stringEmailPlugin } from "../../../src/core/plugin/stringEmail";
import { numberMinPlugin } from "../../../src/core/plugin/numberMin";

describe("Execution Order Integration Tests", () => {
  describe("定義順実行の確認", () => {
    test("transform -> validator の順序で実行される", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string.transform((value: string) => value.trim()).min(3)
        )
        .build();

      // 空白込みで4文字だが、trim後は2文字になりmin(3)で失敗
      const result = validator.validate({ name: " Jo " });

      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].code).toMatch(/min|MIN/i);
    });

    test("validator -> transform -> validator の順序で実行される", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string
            .required()
            .transform((value: string) => value.trim())
            .min(3)
        )
        .build();

      // required -> transform -> min の順序
      const result1 = validator.validate({ name: "" });
      expect(result1.valid).toBe(false);
      expect(result1.errors?.[0].code).toMatch(/required|REQUIRED/i);

      // required通過 -> transform -> min失敗
      const result2 = validator.validate({ name: " Jo " });
      expect(result2.valid).toBe(false);
      expect(result2.errors?.[0].code).toMatch(/min|MIN/i);

      // 全て通過
      const result3 = validator.validate({ name: " John " });
      expect(result3.valid).toBe(true);
    });

    test("複数のtransformが定義順で実行される", () => {
      const executionLog: string[] = [];

      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ text: string }>()
        .v("text", (b) =>
          b.string
            .transform((value: string) => {
              executionLog.push("step1:trim");
              return value.trim();
            })
            .transform((value: string) => {
              executionLog.push("step2:upper");
              return value.toUpperCase();
            })
            .transform((value: string) => {
              executionLog.push("step3:prefix");
              return `PREFIX_${value}`;
            })
            .min(5)
        )
        .build();

      const result = validator.validate({ text: " hello " });

      expect(result.isValid()).toBe(true);
      expect(executionLog).toEqual([
        "step1:trim",
        "step2:upper",
        "step3:prefix",
      ]);

      // 最終的な変換結果の確認
      expect(result.data?.text).toBe("PREFIX_HELLO");
    });

    test("validatorで失敗した場合、後続処理が中断される", () => {
      const executionLog: string[] = [];

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          b.string
            .required() // これが失敗する
            .transform((value: string) => {
              executionLog.push("shouldNotExecute");
              return value.trim();
            })
            .min(3)
        )
        .build();

      const result = validator.validate({ name: "" });

      expect(result.isValid()).toBe(false);
      expect(executionLog).toEqual([]); // transformは実行されない
      expect(result.errors?.[0].code).toMatch(/required|REQUIRED/i);
    });
  });

  describe("currentValueの更新確認", () => {
    test("transformでcurrentValueが更新される", () => {
      const contextLog: Array<{
        step: string;
        originalValue: any;
        currentValue: any;
      }> = [];

      // カスタムプラグインでcontextの値を記録
      const contextRecorderPlugin = {
        name: "contextRecorder",
        methodName: "recordContext",
        allowedTypes: ["string"],
        category: "standard" as const,
        create: () => (stepName: string) => (value: any, ctx: any) => {
          contextLog.push({
            step: stepName,
            originalValue: ctx.originalValue,
            currentValue: ctx.currentValue,
          });
          return { valid: true };
        },
      };

      const validator = Builder()
        .use(transformPlugin)
        .use(contextRecorderPlugin)
        .for<{ name: string }>()
        .v("name", (b) =>
          (b as any).string
            .recordContext("before-transform")
            .transform((value: string) => value.trim())
            .recordContext("after-transform")
            .transform((value: string) => value.toUpperCase())
            .recordContext("after-second-transform")
        )
        .build();

      validator.validate({ name: " hello " });

      expect(contextLog).toEqual([
        {
          step: "before-transform",
          originalValue: " hello ",
          currentValue: " hello ",
        },
        {
          step: "after-transform",
          originalValue: " hello ",
          currentValue: "hello", // trim後
        },
        {
          step: "after-second-transform",
          originalValue: " hello ",
          currentValue: "HELLO", // toUpperCase後
        },
      ]);
    });
  });

  describe("複雑な実用例", () => {
    test("ユーザー登録フォームの実用的な検証", () => {
      interface UserRegistration {
        email: string;
        password: string;
        name: string;
        age: number;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .use(stringEmailPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .for<UserRegistration>()
        .v("email", (b) =>
          b.string
            .required()
            .transform((email: string) => email.toLowerCase().trim())
            .email()
        )
        .v("password", (b) => b.string.required().min(8).max(100))
        .v("name", (b) =>
          b.string
            .required()
            .transform((name: string) => name.trim())
            .min(2)
            .max(50)
        )
        .v("age", (b) => b.number.required().min(18))
        .build();

      // 有効なデータ
      const validResult = validator.validate({
        email: " JOHN@EXAMPLE.COM ",
        password: "password123",
        name: " John Doe ",
        age: 25,
      });

      expect(validresult.isValid()).toBe(true);
      expect(validResult.data?.email).toBe("john@example.com"); // 小文字+trim
      expect(validResult.data?.name).toBe("John Doe"); // trim

      // 無効なデータ - emailフォーマット
      const invalidEmailResult = validator.validate({
        email: " invalid-email ",
        password: "password123",
        name: "John Doe",
        age: 25,
      });

      expect(invalidEmailresult.isValid()).toBe(false);
      expect(invalidEmailResult.errors?.[0].path).toBe("email");

      // 無効なデータ - パスワードが短い
      const invalidPasswordResult = validator.validate({
        email: "john@example.com",
        password: "123", // 短すぎる
        name: "John Doe",
        age: 25,
      });

      expect(invalidPasswordresult.isValid()).toBe(false);
      expect(invalidPasswordResult.errors?.[0].path).toBe("password");

      // 無効なデータ - 年齢不足
      const invalidAgeResult = validator.validate({
        email: "john@example.com",
        password: "password123",
        name: "John Doe",
        age: 16, // 18歳未満
      });

      expect(invalidAgeresult.isValid()).toBe(false);
      expect(invalidAgeResult.errors?.[0].path).toBe("age");
    });

    test("商品データの正規化と検証", () => {
      interface Product {
        name: string;
        price: number;
        description: string;
        category: string;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .for<Product>()
        .v("name", (b) =>
          b.string
            .required()
            .transform((name: string) => name.trim())
            .min(1)
            .max(100)
        )
        .v("price", (b) => b.number.required().min(0))
        .v("description", (b) =>
          b.string
            .required()
            .transform((desc: string) => desc.trim())
            .min(10)
            .max(1000)
        )
        .v("category", (b) =>
          b.string
            .required()
            .transform((cat: string) => cat.toLowerCase().trim())
            .min(1)
        )
        .build();

      const result = validator.validate({
        name: " Gaming Laptop ",
        price: 999.99,
        description: " High-performance gaming laptop with latest GPU ",
        category: " ELECTRONICS ",
      });

      expect(result.isValid()).toBe(true);
      expect(result.data?.name).toBe("Gaming Laptop"); // trim
      expect(result.data?.category).toBe("electronics"); // lowercase + trim
      expect(result.data?.description).toBe(
        "High-performance gaming laptop with latest GPU"
      ); // trim
    });
  });

  describe("パフォーマンステスト", () => {
    test("大量の変換処理でもパフォーマンスが保たれる", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<{ value: string }>()
        .v("value", (b) => {
          let builder = b.string;

          // 20個のtransformを連続で追加
          for (let i = 0; i < 20; i++) {
            builder = builder.transform((value: string) => `${value}_${i}`);
          }

          return builder.min(1);
        })
        .build();

      const start = performance.now();

      // 1000回実行
      for (let i = 0; i < 1000; i++) {
        const result = validator.validate({ value: "test" });
        expect(result.isValid()).toBe(true);
      }

      const end = performance.now();
      const duration = end - start;

      // 1000回実行が合理的な時間で完了することを確認
      console.log(
        `1000 validations with 20 transforms each: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(1000); // 1秒以内
    });

    test("複雑な検証パターンでのメモリ効率", () => {
      const createValidator = () =>
        Builder()
          .use(requiredPlugin)
          .use(transformPlugin)
          .use(stringMinPlugin)
          .use(stringMaxPlugin)
          .use(stringEmailPlugin)
          .for<{ email: string; name: string }>()
          .v("email", (b) =>
            b.string
              .required()
              .transform((email: string) => email.toLowerCase().trim())
              .email()
              .min(5)
              .max(100)
          )
          .v("name", (b) =>
            b.string
              .required()
              .transform((name: string) => name.trim())
              .min(2)
              .max(50)
          )
          .build();

      // 複数のvalidatorを作成してメモリリークがないことを確認
      const validators = [];
      for (let i = 0; i < 100; i++) {
        validators.push(createValidator());
      }

      // 各validatorで検証実行
      validators.forEach((validator, index) => {
        const result = validator.validate({
          email: `test${index}@example.com`,
          name: `User ${index}`,
        });
        expect(result.isValid()).toBe(true);
      });

      // メモリ使用量の大幅な増加がないことを期待
      // （実際のメモリ監視は環境依存のため、正常動作の確認に留める）
      expect(validators.length).toBe(100);
    });
  });
});
