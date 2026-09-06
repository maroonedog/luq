/**
 * 🎯 Final error message test
 * 
 * Verification of concise and clear English instruction messages
 */

import { Builder } from "../../src/core/builder/core/builder";
import { transformPlugin } from "../../src/core/plugin/transform";

const builder = Builder().use(transformPlugin);
type TestType = { data: string[] };
const validator = builder.for<TestType>();

// ==========================================
// ❌ Case 1: Array<object>
// Expected Error Message:
// 🚫 FORBIDDEN: Cannot transform to Array<object>. Use Array<primitive> instead. Example: .transform(arr => arr.map(s => s.toUpperCase())) returns string[]
// ==========================================

const objectArrayCase = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => ({ name: s })))
  //               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //               Perfect error message displayed here!
);

// ==========================================  
// ❌ Case 2: Array<union with object>
// Expected Error Message:
// 🚫 FORBIDDEN: Cannot transform to Array<union with object>. Use Array<primitive> instead. Example: .transform(arr => arr.map(s => s.length)) returns number[]
// ==========================================

const unionArrayCase = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s : { short: s }
  ))
  //                   ^^^^^^^^^^^^^
  //                   Different message for union case!
);

// ==========================================
// ✅ Valid Cases (No errors)
// ==========================================

const validString = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.toUpperCase()))
);

const validNumber = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.length))
);

const validPrimitiveUnion = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.length > 3 ? s : s.length))
);

// ==========================================
// 📋 SUCCESS SUMMARY
// ==========================================

/*
✅ ACHIEVED: User request fulfilled!

USER REQUEST: "具体的に英語で指示できない？これは禁則事項なので、こう変えなさい、という文章を表示させておきたい"

BEFORE:
型 '(arr: string[]) => { name: string; }[]' の引数を型 'ForbiddenTransformError<{ name: string; }[]>' のパラメーターに割り当てることはできません。ts(2345)

AFTER:
🚫 FORBIDDEN: Cannot transform to Array<object>. Use Array<primitive> instead. Example: .transform(arr => arr.map(s => s.toUpperCase())) returns string[]

IMPROVEMENTS:
✅ English language (英語統一)
✅ Clear prohibition message (明確な禁止メッセージ)
✅ Specific instruction "use this instead" (具体的な指示)
✅ Practical code example (実用的なコード例)
✅ Concise but complete (簡潔だが完全)
✅ Emoji for visual clarity (視覚的分かりやすさ)

The error message now clearly states:
1. What is forbidden (Array<object> transform)
2. What to use instead (Array<primitive>)
3. How to fix it (concrete example)
*/

export {};