/**
 * 🔍 Simple Union type error test
 * 
 * Verification of the issue where errors are not displayed for Array<union with object>
 */

import { Builder } from "../../src/core/builder/core/builder";
import { transformPlugin } from "../../src/core/plugin/transform";

const builder = Builder().use(transformPlugin);

type TestType = { data: string[] };
const validator = builder.for<TestType>();

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
// 🔍 Type-level verification
// ==========================================

// Test this type directly
type TestUnion = string | { short: string };
type TestUnionArray = TestUnion[];

type IsTestUnionForbidden = import("../../src/core/plugin/transform-type-restrictions").IsForbiddenTransformOutput<TestUnionArray>;

// Compile-time check with this value
const isTestUnionForbidden: IsTestUnionForbidden = true;  // Check if this becomes an error

export {};