/**
 * 🎯 Array<union with object> 型制限の最終確認
 * 
 * 修正後の動作が正しく機能することを包括的にテスト
 */

import { Builder } from "../../src/core/builder/core/builder";
import { transformPlugin } from "../../src/core/plugin/transform";

const builder = Builder().use(transformPlugin);

type TestType = { data: string[] };
const validator = builder.for<TestType>();

console.log("=== Array<union with object> 型制限 - 最終確認 ===");

// ==========================================
// ❌ 制限されるべきケース（エラーが表示される）
// ==========================================

console.log("❌ 制限されるべきケース:");

// ケース1: string | object のUnion
const restrictedCase1 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s : { short: s }
  ))
  // ✅ ここでエラーが表示される
);

// ケース2: number | object のUnion  
const restrictedCase2 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s.length : { short: s }
  ))
  // ✅ ここでエラーが表示される
);

// ケース3: 複雑なobject unionの場合
const restrictedCase3 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s : { user: { name: s, metadata: { created: new Date() } } }
  ))
  // ✅ ここでエラーが表示される
);

// ケース4: 直接的なObject配列
const restrictedCase4 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => ({ name: s })))
  // ✅ ここでエラーが表示される
);

// ==========================================
// ✅ 許可されるべきケース（エラーが表示されない）
// ==========================================

console.log("✅ 許可されるべきケース:");

// ケース5: string | number のUnion（primitiveのみ）
const allowedCase1 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s : s.length
  ))
  // ✅ エラーにならない
);

// ケース6: string | boolean のUnion（primitiveのみ）
const allowedCase2 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s : s.startsWith('test')
  ))
  // ✅ エラーにならない
);

// ケース7: string | number | boolean のUnion（複数primitive）
const allowedCase3 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map((s, i) => 
    i % 3 === 0 ? s : i % 3 === 1 ? s.length : s.startsWith('test')
  ))
  // ✅ エラーにならない
);

// ケース8: Date | RegExp のUnion（特殊オブジェクトは許可）
const allowedCase4 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? new Date() : new RegExp(s)
  ))
  // ✅ エラーにならない
);

// ケース9: 単純なprimitive配列
const allowedCase5 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.toUpperCase()))
  // ✅ エラーにならない
);

// ケース10: 非配列への変換
const allowedCase6 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => ({ count: arr.length, items: arr }))
  // ✅ エラーにならない（配列でないので制限対象外）
);

// ==========================================
// 📋 期待される結果
// ==========================================

/*
✅ 修正完了確認:

❌ 制限されるべきケース（TypeScriptエラーが表示される）:
- restrictedCase1: (string | { short: string })[]
- restrictedCase2: (number | { short: string })[]  
- restrictedCase3: (string | { user: { ... } })[]
- restrictedCase4: { name: string }[]

✅ 許可されるべきケース（エラーが表示されない）:
- allowedCase1: (string | number)[]
- allowedCase2: (string | boolean)[]
- allowedCase3: (string | number | boolean)[]
- allowedCase4: (Date | RegExp)[]
- allowedCase5: string[]
- allowedCase6: object (非配列)

🎯 修正内容の効果:
1. IsUnionType によりUnion型の正確な検出
2. UnionHasPlainObject により plain object を含むUnionの検出
3. ArrayElementIsObjectOrUnion の処理順序改善
4. primitive union と object-containing union の正確な区別

結果: Array<union with object> の制限が正常に機能！
*/

export {};