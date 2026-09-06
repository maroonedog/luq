/**
 * エディタでのTypeScriptエラー表示デモンストレーション
 * このファイルは実際にエディタでどのようなエラーが表示されるかを確認するためのものです
 * 
 * 使用方法:
 * 1. このファイルをVSCodeやTypeScript対応エディタで開く
 * 2. 下記のコードでエラーが表示されることを確認する
 * 3. エラーメッセージの内容を確認する
 */

import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { transformPlugin } from "../../src/core/plugin/transform";

// プラグインを使用するビルダーを作成
const builder = Builder()
  .use(requiredPlugin)
  .use(transformPlugin);

type TestData = {
  items: string[];
  userData: { name: string; age: number }[];
};

const validator = builder.for<TestData>();

// ==========================================
// ✅ 正常ケース（エラーが表示されない）
// ==========================================

console.log("=== 正常ケース（エラーなし） ===");

// ✅ Array<primitive> への変換 - OK
const case1 = validator
  .v("items", (b) => 
    b.array.transform((arr: string[]) => arr.map(s => s.toUpperCase()))
  );

// ✅ Array<primitive union> への変換 - OK  
const case2 = validator
  .v("items", (b) => 
    b.array.transform((arr: string[]) => arr.map(s => Math.random() > 0.5 ? s : 42))
  );

// ✅ 非配列への変換 - OK
const case3 = validator
  .v("items", (b) => 
    b.array.transform((arr: string[]) => arr.length)
  );

// ✅ 文字列への変換 - OK
const case4 = validator
  .v("items", (b) => 
    b.array.transform((arr: string[]) => arr.join(", "))
  );

// ==========================================
// ❌ エラーケース（エディタでエラーが表示される）
// ==========================================

console.log("=== エラーケース（エディタでエラー表示） ===");

// ❌ Array<object> への変換 - TypeScriptエラーが表示される
const errorCase1 = validator
  .v("items", (b) => 
    b.array.transform((arr: string[]) => arr.map(s => ({ name: s })))
    //                                                  ^^^^^^^^^^^^^^
    //     TypeScriptエラー: Transform restriction: Array<object> and Array<union> are not supported
  );

// ❌ より複雑なオブジェクト配列 - TypeScriptエラーが表示される
const errorCase2 = validator
  .v("items", (b) => 
    b.array.transform((arr: string[]) => arr.map(s => ({ 
      user: { name: s, metadata: { id: Math.random() } }
    })))
    //                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //     TypeScriptエラー: Transform restriction: Array<object> and Array<union> are not supported
  );

// ❌ オブジェクトを含むUnion配列 - TypeScriptエラーが表示される  
const errorCase3 = validator
  .v("items", (b) => 
    b.array.transform((arr: string[]) => arr.map(s => 
      Math.random() > 0.5 ? s : { name: s }
    ))
    //                             ^^^^^^^^^^
    //     TypeScriptエラー: Transform restriction: Array<object> and Array<union> are not supported
  );

// ==========================================
// 🔍 型レベルでの検証デモ
// ==========================================

console.log("=== 型レベル検証デモ ===");

// 型制限システムの動作確認
type ObjectArray = { name: string }[];
type PrimitiveArray = string[];
type UnionArray = (string | { name: string })[];

// 型レベルでの制限チェック
type ObjectRestricted = import("../../src/core/plugin/transform-type-restrictions").IsForbiddenTransformOutput<ObjectArray>;
//   ^ この型は true になる（制限対象）

type PrimitiveAllowed = import("../../src/core/plugin/transform-type-restrictions").IsForbiddenTransformOutput<PrimitiveArray>;
//   ^ この型は false になる（許可）

type UnionRestricted = import("../../src/core/plugin/transform-type-restrictions").IsForbiddenTransformOutput<UnionArray>;
//   ^ この型は true になる（制限対象）

// 実際の値での確認（コンパイル時チェック）
const objectRestricted: ObjectRestricted = true;    // ✅ OK
const primitiveAllowed: PrimitiveAllowed = false;   // ✅ OK  
const unionRestricted: UnionRestricted = true;      // ✅ OK

// ==========================================
// 📋 期待されるエラーメッセージ例
// ==========================================

/*
エディタで表示されるエラーメッセージ例:

❌ Type '"❌ Transform restriction: Array<object> and Array<union> are not supported"' is not assignable to type '(value: string[]) => { name: string; }[]'.

詳細情報:
- _error: "❌ Transform restriction: Array<object> and Array<union> are not supported"
- _reason: "Due to nested array validation implementation, transforming to Array<object> or Array<union> is not supported"  
- _suggestion: "Consider using Array<primitive> (Array<string>, Array<number>, etc.) or transform individual array elements instead"
- _example: "Instead of: transform(() => [{name: 'test'}]), use: transform(() => ['test']) or handle objects without transform"

このエラーメッセージにより、開発者は:
1. なぜ制限されているのかを理解できる
2. 代替案を知ることができる  
3. 具体的な修正例を参照できる
*/

export {};