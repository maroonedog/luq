/**
 * 🎯 Specific examples of editor error display
 * 
 * When you open this file in VSCode, TypeScript errors are displayed in the following cases:
 * 
 * ❌ Transformation to Array<object>
 * ❌ Transformation to Array<union with object>
 * ✅ Transformation to Array<primitive> works normally
 */

import { Builder } from "../../src/core/builder/core/builder";
import { transformPlugin } from "../../src/core/plugin/transform";

const builder = Builder().use(transformPlugin);

type TestType = { data: string[] };
const validator = builder.for<TestType>();

// ==========================================
// ❌ Error case 1: Array<object>
// ==========================================

// VSCode error message:
// Argument of type '(arr: string[]) => { name: string; }[]' is not assignable to parameter of type 'ForbiddenTransformError<{ name: string; }[]>'

const case1 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => ({ name: s })))
  //               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //               Error is displayed here
);

// ==========================================
// ❌ Error case 2: Array<complex object>  
// ==========================================

const case2 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => ({ 
    user: { name: s, age: 25 },
    metadata: { created: new Date() }
  })))
  //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  //     Error is displayed here
);

// ==========================================
// ❌ Error case 3: Array<union with object>
// ==========================================

const case3 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => 
    s.length > 3 ? s : { short: s }
  ))
  //                   ^^^^^^^^^^^^^
  //                   Error is displayed here
);

// ==========================================
// ✅ Valid case: Array<primitive>
// ==========================================

const validCase1 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.toUpperCase()))
);

const validCase2 = validator.v("data", (b) => 
  b.array.transform((arr: string[]) => arr.map(s => s.length))
);

// ==========================================
// 🔍 Type-level verification
// ==========================================

// These type checks are evaluated at compile time
type ObjectArrayType = { name: string }[];
type PrimitiveArrayType = string[];

// This type becomes true (restricted)
type IsObjectForbidden = import("../../src/core/plugin/transform-type-restrictions").IsForbiddenTransformOutput<ObjectArrayType>;

// This type becomes false (allowed)  
type IsPrimitiveForbidden = import("../../src/core/plugin/transform-type-restrictions").IsForbiddenTransformOutput<PrimitiveArrayType>;

// Type verification (compile-time check)
const objectForbidden: IsObjectForbidden = true;    // ✅ OK
const primitiveAllowed: IsPrimitiveForbidden = false; // ✅ OK

// ==========================================
// 📋 Expected editor display content
// ==========================================

/* 
Error information displayed when hovering in editor (VSCode):

❌ Argument of type '(arr: string[]) => { name: string; }[]' is not assignable to parameter of type 'ForbiddenTransformError<{ name: string; }[]>'.

Type information details:
```
type ForbiddenTransformError<T> = {
  _error: "❌ Transform restriction: Array<object> and Array<union> are not supported";
  _reason: "Due to nested array validation implementation, transforming to Array<object> or Array<union> is not supported";
  _received: T;
  _suggestion: "Consider using Array<primitive> (Array<string>, Array<number>, etc.) or transform individual array elements instead";
  _example: "Instead of: transform(() => [{name: 'test'}]), use: transform(() => ['test']) or handle objects without transform";
}
```

This allows developers to:
✅ Understand why errors occur
✅ Know alternatives
✅ Reference specific fix examples
✅ Discover problems at compile time (no runtime errors)
*/

export {};