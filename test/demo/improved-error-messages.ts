/**
 * 🎯 Verification of improved TypeScript error messages
 * 
 * Test to verify that specific and instructive English messages are displayed
 */

import { Builder } from "../../src/core/builder/core/builder";
import { transformPlugin } from "../../src/core/plugin/transform";

const builder = Builder().use(transformPlugin);

type TestType = { data: string[] };
const validator = builder.for<TestType>();

// ==========================================
// ❌ Array<object> error case
// Expected message:
// ❌ FORBIDDEN: Transform cannot return Array<object>
// 🚫 This transform is not allowed: () => Array<object>
// ✅ CHANGE TO: Use Array<primitive> types instead
//   • GOOD: transform(() => strings.map(s => s.toUpperCase())) // string[]
//   • GOOD: transform(() => numbers.map(n => n * 2)) // number[]
//   • GOOD: transform(() => items.join(',')) // string
//   • GOOD: transform(() => ({ total: items.length })) // object (not array)
// ⚠️  BAD:  transform(() => items.map(item => ({ name: item }))) // ← NOT ALLOWED
// ==========================================

const case1 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => ({ name: s })))
  //               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //               Improved error message is displayed here
);

const case2 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => ({ 
    user: { name: s, age: 25 },
    metadata: { created: new Date() }
  })))
  //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //     Same error message for more complex objects too
);

// ==========================================
// ❌ Array<union containing object> error case
// Expected message:
// ❌ FORBIDDEN: Transform cannot return Array<union containing object>
// 🚫 This transform is not allowed: () => Array<union with object>
// ✅ CHANGE TO: Use Array<primitive union> or Array<primitive> instead
//   • GOOD: transform(() => items.map(item => item.length > 3 ? item : item.length)) // (string | number)[]
//   • GOOD: transform(() => items.map(item => item.toUpperCase())) // string[]
// ⚠️  BAD:  transform(() => items.map(item => item.length > 3 ? item : { short: item })) // ← NOT ALLOWED
// ==========================================

const case3 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s : { short: s }
  ))
  //                   ^^^^^^^^^^^^^
  //                   Error message for union containing object
);

// ==========================================
// ✅ Valid cases (no errors)
// ==========================================

const validCase1 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.toUpperCase()))
);

const validCase2 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.length))
);

const validCase3 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.join(", "))
);

const validCase4 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => ({ count: arr.length }))
);

// ==========================================
// 🔍 Expected improvements
// ==========================================

/*
Previous error message:
Argument of type '(arr: string[]) => { name: string; }[]' is not assignable to parameter of type 'ForbiddenTransformError<{ name: string; }[]>'. ts(2345)

Improved error message:
❌ FORBIDDEN: Transform cannot return Array<object>
🚫 This transform is not allowed: () => Array<object>
✅ CHANGE TO: Use Array<primitive> types instead
  • GOOD: transform(() => strings.map(s => s.toUpperCase())) // string[]
  • GOOD: transform(() => numbers.map(n => n * 2)) // number[]
  • GOOD: transform(() => items.join(',')) // string
  • GOOD: transform(() => ({ total: items.length })) // object (not array)
⚠️  BAD:  transform(() => items.map(item => ({ name: item }))) // ← NOT ALLOWED

This improvement provides:
✅ Clear indication of what's wrong
✅ Understanding of why it's wrong  
✅ Specific guidance on how to fix it
✅ Good and bad examples shown side by side
✅ Unified instructive messages in English
*/

export {};