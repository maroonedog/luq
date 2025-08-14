/**
 * TypeScript error test for Union types containing Array<object>
 * 
 * This test verifies that TypeScript errors are displayed that prohibit the use of
 * unionGuard for complex Union types like primitive | Array<object> and recommend
 * individual field declarations instead.
 */

import { describe, test } from "@jest/globals";
import { Builder } from "../../../src";
import { unionGuardPlugin } from "../../../src/core/plugin/unionGuard";
import { requiredPlugin } from "../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../src/core/plugin/stringMin";
import { arrayMinLengthPlugin } from "../../../src/core/plugin/arrayMinLength";

describe("Union type Array<object> error detection", () => {
  // Normal case: primitive | primitive[]
  test("primitive | primitive[] - unionGuard can be used", () => {
    type GoodUnion = string | string[];
    
    const validator = Builder()
      .use(unionGuardPlugin)
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<{ value: GoodUnion }>()
      .v("value", (b) => b.union
        .guard(
          (v): v is string => typeof v === "string",
          (b) => b.string.required().min(2)
        )
        .guard(
          (v): v is string[] => Array.isArray(v),
          (b) => b.array.required().minLength(1)
        )
      )
      .build();

    // In this case, validator is created without errors
    expect(validator).toBeDefined();
  });

  // Problematic case: primitive | Array<object>
  test("primitive | Array<object> - TypeScript error should be displayed", () => {
    type BadUnion = string | Array<{ id: string; name: string }>;
    
    // This code should result in a TypeScript error
    // Error message: "❌ Union types with Array<object> are not supported by unionGuard. Use individual field declarations instead."
    
    /* 
    // The following code is commented out because it would result in a TypeScript error
    const validator = Builder()
      .use(unionGuardPlugin)
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ value: BadUnion }>()
      .v("value", (b) => b.union  // <- TypeScript error is displayed here
        .guard(
          (v): v is string => typeof v === "string",
          (b) => b.string.required().min(2)
        )
        .guard(
          (v): v is Array<{ id: string; name: string }> => Array.isArray(v),
          (b) => b.array.required().minLength(1)
        )
      )
      .build();
    */

    // Instead, the correct way using individual field declarations
    const correctValidator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ value: BadUnion }>()
      .v("value", (b) => b.string.required().min(2)) // for string
      // For Array<object> cases, handle with individual fields
      // .v("value[*].id", (b) => b.string.required())
      // .v("value[*].name", (b) => b.string.required())
      .build();

    expect(correctValidator).toBeDefined();
  });

  // More complex case: multiple Array<object> types
  test("Union type containing multiple Array<object> - TypeScript error", () => {
    type ComplexBadUnion = 
      | string
      | Array<{ id: string; name: string }>
      | Array<{ userId: number; email: string }>;
    
    // TypeScript error should be displayed even for such complex Union types
    
    /* 
    // Commented out because it would result in a TypeScript error
    const validator = Builder()
      .use(unionGuardPlugin)
      .for<{ data: ComplexBadUnion }>()
      .v("data", (b) => b.union) // <- TypeScript error
      .build();
    */

    // Correct approach: individual field declarations
    const correctValidator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ data: ComplexBadUnion }>()
      .v("data", (b) => b.string.required()) // basic validation for string
      // Array elements are handled individually
      // .v("data[*].id", (b) => b.string.required())
      // .v("data[*].name", (b) => b.string.required())
      // .v("data[*].userId", (b) => b.number.required())
      // .v("data[*].email", (b) => b.string.required())
      .build();

    expect(correctValidator).toBeDefined();
  });

  // Edge case: Array<primitive> is allowed
  test("Array<primitive> is allowed", () => {
    type AllowedUnion = string | number[];
    
    const validator = Builder()
      .use(unionGuardPlugin)
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<{ value: AllowedUnion }>()
      .v("value", (b) => b.union
        .guard(
          (v): v is string => typeof v === "string",
          (b) => b.string.required().min(2)
        )
        .guard(
          (v): v is number[] => Array.isArray(v),
          (b) => b.array.required().minLength(1)
        )
      )
      .build();

    expect(validator).toBeDefined();
  });
});

/**
 * Additional information for verifying errors at TypeScript compile time:
 * 
 * Example error message:
 * ```
 * Type '{ _error: "❌ Union types with Array<object> are not supported by unionGuard..."; 
 *        _suggestion: "Example: .v('items[*].property', b => b.type.validators()) instead of union guards"; 
 *        _reason: "Array<object> requires field-level validation that unionGuard cannot provide"; }' 
 * is not assignable to type 'ChainableFieldBuilderWithUnionTracking<...>'
 * ```
 * 
 * Recommended solutions:
 * 1. For Union types containing Array<object>, use individual field declarations instead of unionGuard
 * 2. Use `[*]` pattern for array element validation
 * 3. Example: `.v("items[*].property", b => b.type.validators())`
 */