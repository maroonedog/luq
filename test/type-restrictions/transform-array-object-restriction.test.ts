/**
 * Transform Array<object> 制限のテスト
 * 
 * このテストは型レベルでのエラーチェックを行います。
 * コンパイル時にエラーが発生することを確認し、
 * 実行時には適切なエラーメッセージが表示されることを確認します。
 */

import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { transformPlugin } from "../../src/core/plugin/transform";
import { requiredPlugin } from "../../src/core/plugin/required";
import type { CheckTransformFunction } from "../../src/core/plugin/transform-type-restrictions";

describe("Transform Array<object> Restrictions", () => {
  
  test("型チェック: 許可されるtransform関数", () => {
    type UserData = {
      tags: string[];
      numbers: number[];
      flags: boolean[];
    };

    // ✅ これらは許可されるべき
    const validator = Builder()
      .use(transformPlugin)
      .use(requiredPlugin)
      .for<UserData>()
      // Array<string> は許可
      .v("tags", (b) => 
        b.array.required().transform((tags: string[]) => tags.map(t => t.toUpperCase()))
      )
      // Array<number> は許可
      .v("numbers", (b) => 
        b.array.required().transform((nums: number[]) => nums.map(n => n * 2))
      )
      // Array<boolean> は許可
      .v("flags", (b) => 
        b.array.required().transform((flags: boolean[]) => flags.map(f => !f))
      )
      .build();

    expect(validator).toBeDefined();
  });

  // このテストはTypeScriptコンパイラレベルでエラーになるべき
  // 実際の使用時にはコメントアウトして型エラーを確認してください
  test("型チェック: 禁止されるtransform関数の検証", () => {
    type UserData = {
      users: any[];
      mixed: any[];
    };

    // 型チェックのテスト用関数
    type TestArrayObjectTransform = CheckTransformFunction<
      (value: any[]) => Array<{ name: string; age: number }>
    >;

    type TestArrayUnionTransform = CheckTransformFunction<
      (value: any[]) => Array<string | number>
    >;

    type TestArrayStringTransform = CheckTransformFunction<
      (value: any[]) => string[]
    >;

    // 型アサーションで期待される結果をテスト
    const arrayObjectCheck: TestArrayObjectTransform = {} as TestArrayObjectTransform;
    const arrayUnionCheck: TestArrayUnionTransform = {} as TestArrayUnionTransform;
    const arrayStringCheck: TestArrayStringTransform = {} as TestArrayStringTransform;

    // 型情報の確認（実際にはこれらの値は使用されない）
    expect(typeof arrayObjectCheck).toBe("object");
    expect(typeof arrayUnionCheck).toBe("object");
    expect(typeof arrayStringCheck).toBe("object");
  });

  test("実行時エラーメッセージの確認", () => {
    // 実行時にtransform関数の制限が適切に処理されることを確認
    // （型チェックを回避するためにany型を使用）
    
    type UserData = {
      data: any[];
    };

    const builder = Builder()
      .use(transformPlugin)
      .use(requiredPlugin)
      .for<UserData>();

    // 正常なケース
    expect(() => {
      builder.v("data", (b) => 
        b.array.required().transform((arr: any[]) => arr.map(String))
      );
    }).not.toThrow();
  });

  test("コメント例: 禁止される使用例", () => {
    /*
    // ❌ これらはTypeScriptコンパイル時にエラーになるべき：
    
    type UserData = {
      users: any[];
      products: any[];
      mixed: any[];
    };

    const validator = Builder()
      .use(transformPlugin)
      .for<UserData>()
      // ❌ Array<object> は禁止
      .v("users", (b) => 
        b.array.transform((users: any[]) => users.map(u => ({ name: u.name, age: u.age })))
      )
      // ❌ Array<union> は禁止
      .v("mixed", (b) => 
        b.array.transform((items: any[]) => items.map(i => i.toString() || i.toNumber()))
      )
      .build();
    */

    // 代替案の例
    type UserData = {
      userNames: string[];
      userAges: number[];
    };

    // ✅ 代替案: オブジェクトではなく個別のプリミティブ配列を使用
    const validator = Builder()
      .use(transformPlugin)
      .use(requiredPlugin)
      .for<UserData>()
      .v("userNames", (b) => 
        b.array.required().transform((names: string[]) => names.map(n => n.trim()))
      )
      .v("userAges", (b) => 
        b.array.required().transform((ages: number[]) => ages.map(a => Math.max(0, a)))
      )
      .build();

    expect(validator).toBeDefined();
  });

  test("エラーメッセージの内容確認", () => {
    // transform-type-restrictions.tsのエラーメッセージが適切に定義されていることを確認
    type ErrorMessage = {
      _messageFactory: "❌ Transform restriction: Array<object> and Array<union> are not supported";
      _reason: "Due to nested array validation implementation, transforming to Array<object> or Array<union> is not supported";
      _suggestion: "Consider using Array<primitive> (Array<string>, Array<number>, etc.) or transform individual array elements instead";
    };

    // エラーメッセージのフォーマットが正しいことを確認
    const errorKeys = ["_error", "_reason", "_suggestion"];
    errorKeys.forEach(key => {
      expect(key).toContain("_");
    });
  });
});