# Luq Plugin Reference

This document is auto-generated. Do not edit manually.

## Table of Contents

### Standard Validation

- [arrayIncludes](#arrayIncludes)
- [arrayMaxLength](#arrayMaxLength)
- [arrayMinLength](#arrayMinLength)
- [arrayUnique](#arrayUnique)
- [booleanFalsy](#booleanFalsy)
- [booleanTruthy](#booleanTruthy)
- [compareField](#compareField)
- [equalsField](#equalsField)
- [literal](#literal)
- [nullable](#nullable)
- [numberFinite](#numberFinite)
- [numberInteger](#numberInteger)
- [numberMax](#numberMax)
- [numberMin](#numberMin)
- [numberMultipleOf](#numberMultipleOf)
- [numberNegative](#numberNegative)
- [numberPositive](#numberPositive)
- [numberRange](#numberRange)
- [object](#object)
- [objectRecursively](#objectRecursively)
- [oneOf](#oneOf)
- [optional](#optional)
- [recursivelyWithContext](#recursivelyWithContext)
- [required](#required)
- [selfRecursively](#selfRecursively)
- [stringAlphanumeric](#stringAlphanumeric)
- [stringDatetime](#stringDatetime)
- [stringEmail](#stringEmail)
- [stringEndsWith](#stringEndsWith)
- [stringEquals](#stringEquals)
- [stringExactLength](#stringExactLength)
- [stringMax](#stringMax)
- [stringMin](#stringMin)
- [stringPattern](#stringPattern)
- [stringStartsWith](#stringStartsWith)
- [stringUrl](#stringUrl)
- [uuid](#uuid)

### Conditional Validation

- [optionalIf](#optionalIf)
- [requiredIf](#requiredIf)
- [skip](#skip)
- [validateIf](#validateIf)

### advanced

- [stitch](#stitch)

### Transform Plugins

- [transform](#transform)

### Composable Plugins

- [unionGuard](#unionGuard)

## Plugin Details

### Standard Validation

#### arrayIncludes

**Description**: Validates that an array contains a specific required element

**Since**: 1.0.0
/

**Allowed Types**:

- `array`

**Usage Example**:

```typescript
// Basic usage - check if array contains specific item
const validator = Builder()
  .use(arrayIncludesPlugin)
  .for<UserData>()
  .v("roles", (b) => b.array.includes("admin"))
  .v("permissions", (b) => b.array.includes("read"))
  .build();

// Multiple required items
builder.v("features", (b) => b.array.includes("core").includes("api"));
```

**Parameters**:

- expected: any - The element that must be present in the array
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if array contains the expected element

**Custom Error Message**:

```typescript
.includes("admin", {
  issueFactory: ({ path, value, params }) =>
    `${path} must include "${params.expected}" (current: [${value.join(", ")}])`
})
```

---

#### arrayMaxLength

**Description**: Validates that an array does not exceed the specified maximum number of elements

**Since**: 1.0.0
/

**Allowed Types**:

- `array`

**Usage Example**:

```typescript
// Basic usage - set maximum array length
const validator = Builder()
  .use(arrayMaxLengthPlugin)
  .for<FormData>()
  .v("tags", (b) => b.array.maxLength(10))
  .v("attachments", (b) => b.array.maxLength(5))
  .build();

// Limit file uploads with min and max
builder.v("files", (b) => b.array.minLength(1).maxLength(3));
```

**Parameters**:

- maxLength: number - Maximum number of elements allowed
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if array length does not exceed maximum

**Custom Error Message**:

```typescript
.maxLength(5, {
  issueFactory: ({ path, value, params }) =>
    `${path} can have at most ${params.maxLength} items (current: ${value.length})`
})
```

---

#### arrayMinLength

**Description**: Validates that an array has at least the specified minimum number of elements

**Since**: 1.0.0
/

**Allowed Types**:

- `array`

**Usage Example**:

```typescript
// Basic usage - set minimum array length
const validator = Builder()
  .use(arrayMinLengthPlugin)
  .for<FormData>()
  .v("tags", (b) => b.array.minLength(1))
  .v("items", (b) => b.array.minLength(3))
  .build();

// Ensure non-empty array
builder.v("selectedOptions", (b) => b.array.required().minLength(1));
```

**Parameters**:

- minLength: number - Minimum number of elements required
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if array length is at least the minimum

**Custom Error Message**:

```typescript
.minLength(3, {
  issueFactory: ({ path, value, params }) =>
    `${path} must have at least ${params.minLength} items (current: ${value.length})`
})
```

---

#### arrayUnique

**Description**: Validates that all elements in an array are unique (no duplicates)

**Since**: 1.0.0
/

**Allowed Types**:

- `array`

**Usage Example**:

```typescript
// Basic usage - ensures all array elements are unique
const validator = Builder()
  .use(arrayUniquePlugin)
  .for<FormData>()
  .v("emails", (b) => b.array.unique())
  .v("userIds", (b) => b.array.required().unique())
  .build();

// For tags or categories
builder.v("tags", (b) => b.array.unique().minLength(1).maxLength(10));

// Combining with other array validations
builder.v("productCodes", (b) => b.array.unique().includes("PRIMARY"));
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if all array elements are unique

**Custom Error Message**:

```typescript
.unique({
  issueFactory: ({ path, value }) =>
    `${path} contains duplicate values`
})
```

---

#### booleanFalsy

**Description**: Validates that a boolean value is exactly false

**Since**: 1.0.0
/

**Allowed Types**:

- `boolean`

**Usage Example**:

```typescript
// Basic usage - ensures value is exactly false
const validator = Builder()
  .use(booleanFalsyPlugin)
  .for<Settings>()
  .v("isActive", (b) => b.boolean.falsy())
  .v("debugMode", (b) => b.boolean.required().falsy())
  .build();

// Privacy settings
builder.v("shareData", (b) => b.boolean.falsy());

// Security flags
builder.v("allowExternalAccess", (b) => b.boolean.required().falsy());
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if value is exactly false

**Custom Error Message**:

```typescript
.falsy({
  issueFactory: ({ path, value }) =>
    `${path} must be set to false (current: ${value})`
})
```

---

#### booleanTruthy

**Description**: Validates that a boolean value is exactly true

**Since**: 1.0.0
/

**Allowed Types**:

- `boolean`

**Usage Example**:

```typescript
// Basic usage - ensure value is exactly true
const validator = Builder()
  .use(booleanTruthyPlugin)
  .for<FormData>()
  .v("isActive", (b) => b.boolean.truthy())
  .v("termsAccepted", (b) => b.boolean.required().truthy())
  .build();

// For consent checkboxes
builder.v("agreeToTerms", (b) => b.boolean.required().truthy());
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true only if value is exactly true

**Custom Error Message**:

```typescript
.truthy({
  issueFactory: ({ path }) =>
    `${path} must be checked/accepted`
})
```

---

#### compareField

**Description**: Validates a field's value by comparing it with another field's value using a custom comparison function

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `date`
- `object`
- `array`
- `null`
- `undefined`

**Usage Example**:

```typescript
// Default usage - strict equality
const validator = Builder()
  .use(compareFieldPlugin)
  .for<SignupForm>()
  .v("password", (b) => b.string.required().min(8))
  .v("confirmPassword", (b) => b.string.required().compareField("password"))
  .build();

// Custom comparison - date before
builder.v("endDate", (b) =>
  b.string.datetime().compareField("startDate", {
    compareFn: (endDate, startDate) => new Date(endDate) > new Date(startDate),
    issueFactory: () => "End date must be after start date",
  })
);

// Number comparison
builder.v("maxValue", (b) =>
  b.number.compareField("minValue", {
    compareFn: (max, min) => max >= min,
    issueFactory: () => "Max value must be greater than or equal to min value",
  })
);
```

**Parameters**:

- fieldPath: string - Path to the field to compare against (supports dot notation)
- options?: { compareFn?: (value, targetValue) => boolean, issueFactory?: (context) => string } - Optional configuration

**Returns**: Validation function that returns true if comparison passes

**Custom Error Message**:

```typescript
.compareField("startDate", {
  compareFn: (end, start) => new Date(end) > new Date(start),
  issueFactory: ({ path, value, params }) =>
    `${path} must be after ${params.fieldPath}`
})
```

---

#### equalsField

**Description**: Validates that a field's value equals another field's value in the same form

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `date`

**Usage Example**:

```typescript
// Password confirmation
const validator = Builder()
  .use(equalsFieldPlugin)
  .for<SignupForm>()
  .v("password", (b) => b.string.required().min(8))
  .v("confirmPassword", (b) => b.string.required().equalsField("password"))
  .build();

// Email confirmation
builder
  .v("email", (b) => b.string.required().email())
  .v("confirmEmail", (b) => b.string.required().equalsField("email"));

// Nested field comparison
builder
  .v("shipping.zipCode", (b) => b.string.required())
  .v("billing.zipCode", (b) => b.string.equalsField("shipping.zipCode"));
```

**Parameters**:

- fieldPath: string - Path to the field to compare against (supports dot notation)
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if field values are equal

**Custom Error Message**:

```typescript
.equalsField("password", {
  issueFactory: ({ path, value, params }) =>
    `${path} must match ${params.fieldPath}`
})
```

---

#### literal

**Description**: Validates that a value exactly matches a specific literal value

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`

**Usage Example**:

```typescript
// String literal - exact value match
const validator = Builder()
  .use(literalPlugin)
  .for<Config>()
  .v("type", (b) => b.string.literal("user"))
  .v("version", (b) => b.string.literal("v1"))
  .build();

// Number and boolean literals
builder.v("maxRetries", (b) => b.number.literal(3));
builder.v("enabled", (b) => b.boolean.literal(true));
```

**Parameters**:

- expected: string | number | boolean - The exact value to match
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true only if value exactly matches expected

**Custom Error Message**:

```typescript
.literal("active", {
  issueFactory: ({ path, value, params }) =>
    `${path} must be exactly "${params.expected}" (received: "${value}")`
})
```

---

#### nullable

**Description**: Allows a field to accept null as a valid value

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `array`
- `object`
- `date`
- `union`

**Usage Example**:

```typescript
// Basic usage - field can be null or valid string
const validator = Builder()
  .use(nullablePlugin)
  .for<UserProfile>()
  .v("middleName", (b) => b.string.nullable().min(3))
  .v("avatar", (b) => b.string.nullable().url())
  .build();

// With other validations - null bypasses all validators
builder.v("score", (b) => b.number.nullable().min(0).max(100));
```

**Parameters**:

- No parameters - this is a modifier plugin

**Returns**: Validation function that returns true for null values and continues validation for non-null values

**Custom Error Message**:

```typescript
This plugin does not generate errors - it allows null values
```

---

#### numberFinite

**Description**: Validates that a number is finite (not Infinity, -Infinity, or NaN)

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - ensures number is finite
const validator = Builder()
  .use(numberFinitePlugin)
  .for<CalculationResult>()
  .v("score", (b) => b.number.finite())
  .v("ratio", (b) => b.number.required().finite())
  .build();

// For division results that might be infinite
builder.v("average", (b) => b.number.finite().min(0));

// For mathematical calculations
builder.v("result", (b) => b.number.required().finite().range(-1000, 1000));
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is finite

**Custom Error Message**:

```typescript
.finite({
  issueFactory: ({ path, value }) =>
    `${path} must be a finite number (received: ${value})`
})
```

---

#### numberInteger

**Description**: Validates that a number is an integer (whole number without decimals)

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - ensures number is an integer
const validator = Builder()
  .use(numberIntegerPlugin)
  .for<OrderData>()
  .v("quantity", (b) => b.number.integer())
  .v("count", (b) => b.number.required().integer())
  .build();

// Combined with range validation
builder.v("score", (b) => b.number.integer().min(0).max(100));

// For ID validation
builder.v("userId", (b) => b.number.required().integer().positive());
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is an integer

**Custom Error Message**:

```typescript
.integer({
  issueFactory: ({ path, value }) =>
    `${path} must be a whole number (received: ${value})`
})
```

---

#### numberMax

**Description**: Validates that a number is less than or equal to the specified maximum value

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - set maximum allowed value
const validator = Builder()
  .use(numberMaxPlugin)
  .for<Settings>()
  .v("percentage", (b) => b.number.max(100))
  .v("discount", (b) => b.number.max(50))
  .v("temperature", (b) => b.number.max(40))
  .build();

// For percentages with range
builder.v("successRate", (b) => b.number.min(0).max(100));
```

**Parameters**:

- max: number - Maximum allowed value (inclusive)
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is less than or equal to maximum

**Custom Error Message**:

```typescript
.max(100, {
  issueFactory: ({ path, value, params }) =>
    `${path} must not exceed ${params.max} (received: ${value})`
})
```

---

#### numberMin

**Description**: Validates that a number is greater than or equal to the specified minimum value

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - set minimum allowed value
const validator = Builder()
  .use(numberMinPlugin)
  .for<OrderForm>()
  .v("age", (b) => b.number.min(18))
  .v("quantity", (b) => b.number.min(1))
  .v("price", (b) => b.number.min(0.01))
  .build();

// Combined with max for range validation
builder.v("percentage", (b) => b.number.min(0).max(100));
```

**Parameters**:

- min: number - Minimum allowed value (inclusive)
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is greater than or equal to minimum

**Custom Error Message**:

```typescript
.min(18, {
  issueFactory: ({ path, value, params }) =>
    `${path} must be at least ${params.min} (received: ${value})`
})
```

---

#### numberMultipleOf

**Description**: Validates that a number is a multiple of a specified divisor

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - ensures number is a multiple of divisor
const validator = Builder()
  .use(numberMultipleOfPlugin)
  .for<PricingData>()
  .v("quantity", (b) => b.number.multipleOf(5))
  .v("price", (b) => b.number.required().multipleOf(0.25))
  .build();

// For time intervals (minutes)
builder.v("duration", (b) => b.number.multipleOf(15).min(0).max(240));

// For currency with cents
builder.v("amount", (b) => b.number.multipleOf(0.01).positive());
```

**Parameters**:

- divisor: number - The number that the value must be divisible by
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is a multiple of divisor

**Custom Error Message**:

```typescript
.multipleOf(0.25, {
  issueFactory: ({ path, value, params }) =>
    `${path} must be in increments of ${params.divisor} (received: ${value})`
})
```

---

#### numberNegative

**Description**: Validates that a number is strictly negative (less than zero)

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - ensures number is negative (< 0)
const validator = Builder()
  .use(numberNegativePlugin)
  .for<TemperatureData>()
  .v("temperature", (b) => b.number.negative())
  .v("debt", (b) => b.number.required().negative())
  .build();

// For temperature below freezing
builder.v("celsius", (b) => b.number.negative().max(-1));

// For negative offsets or adjustments
builder.v("adjustment", (b) => b.number.negative().integer());
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is less than zero

**Custom Error Message**:

```typescript
.negative({
  issueFactory: ({ path, value }) =>
    `${path} must be negative (received: ${value})`
})
```

---

#### numberPositive

**Description**: Validates that a number is strictly positive (greater than zero)

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - ensures number is positive (> 0)
const validator = Builder()
  .use(numberPositivePlugin)
  .for<PricingData>()
  .v("price", (b) => b.number.positive())
  .v("quantity", (b) => b.number.required().positive())
  .build();

// For monetary values
builder.v("payment", (b) => b.number.positive().multipleOf(0.01));

// For counts and quantities
builder.v("itemCount", (b) => b.number.positive().integer());
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is greater than zero

**Custom Error Message**:

```typescript
.positive({
  issueFactory: ({ path, value }) =>
    `${path} must be positive (received: ${value})`
})
```

---

#### numberRange

**Description**: Validates that a number is within a specified range (inclusive)

**Since**: 1.0.0
/

**Allowed Types**:

- `number`

**Usage Example**:

```typescript
// Basic usage - ensures number is within range
const validator = Builder()
  .use(numberRangePlugin)
  .for<FormData>()
  .v("age", (b) => b.number.range(18, 65))
  .v("percentage", (b) => b.number.required().range(0, 100))
  .build();

// For ratings
builder.v("rating", (b) => b.number.range(1, 5).integer());

// For temperature ranges
builder.v("celsius", (b) => b.number.range(-273.15, 100));
```

**Parameters**:

- min: number - Minimum value (inclusive)
- max: number - Maximum value (inclusive)
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if number is within range

**Custom Error Message**:

```typescript
.range(0, 100, {
  issueFactory: ({ path, value, params }) =>
    `${path} must be between ${params.min} and ${params.max} (received: ${value})`
})
```

---

#### object

**Description**: Validates that a value is a plain object (not null, array, or other types)

**Since**: 1.0.0
/

**Allowed Types**:

- `object`

**Usage Example**:

```typescript
// Basic usage - validates that value is an object
const validator = Builder()
  .use(objectPlugin)
  .for<FormData>()
  .v("settings", (b) => b.object.object())
  .v("config", (b) => b.object.required().object())
  .build();

// For nested object validation
builder
  .v("data", (b) => b.object.object())
  .v("data.name", (b) => b.string.required())
  .v("data.age", (b) => b.number.min(0));

// Combined with required for mandatory objects
builder.v("user", (b) => b.object.required().object());
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if value is a plain object

**Custom Error Message**:

```typescript
.object({
  issueFactory: ({ path, value }) =>
    `${path} must be an object (received: ${typeof value})`
})
```

---

#### objectRecursively

**Description**: Enables recursive validation for nested objects at any depth

**Since**: 1.0.0
/

**Allowed Types**:

- `object`

**Usage Example**:

```typescript
// Basic usage - applies validation rules to all nested objects
const validator = Builder()
  .use(objectRecursivelyPlugin)
  .for<TreeData>()
  .v("nestedData", (b) => b.object.recursively())
  .build();

// Validate all nested objects with specific rules
builder
  .v("config", (b) => b.object.required())
  .v("config", (b) => b.object.recursively())
  .v("config.*.apiKey", (b) => b.string.required());

// Validate nested user objects in a tree structure
builder
  .v("userTree", (b) => b.object.recursively())
  .v("userTree.*.name", (b) => b.string.required())
  .v("userTree.*.children", (b) => b.array.optional());
```

**Parameters**:

- options?: { maxDepth?: number; validate?: (ctx: RecursiveValidationContext) => ValidationResult } - Optional configuration

**Returns**: Validation function that marks object for recursive validation

**Custom Error Message**:

```typescript
This plugin does not generate errors - it enables recursive validation
```

---

#### oneOf

**Description**: Validates that a value is one of the specified allowed values (enum-like validation)

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`

**Usage Example**:

```typescript
// String enum validation
const validator = Builder()
  .use(oneOfPlugin)
  .for<FormData>()
  .v("status", (b) => b.string.oneOf(["active", "inactive", "pending"]))
  .v("role", (b) => b.string.oneOf(["admin", "user", "guest"]))
  .build();

// Number enum validation
builder.v("priority", (b) => b.number.oneOf([0, 1, 2, 3]));

// With TypeScript const for type safety
const ROLES = ["admin", "user", "guest"] as const;
builder.v("userRole", (b) => b.string.oneOf(ROLES));
```

**Parameters**:

- allowed: Array<string | number | boolean> - Array of allowed values
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if value is in the allowed list

**Custom Error Message**:

```typescript
.oneOf(["A", "B", "C"], {
  issueFactory: ({ path, value, params }) =>
    `${path} must be one of: ${params.allowed.join(", ")} (received: ${value})`
})
```

---

#### optional

**Description**: Allows a field to be undefined (but not null or empty string)

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `array`
- `object`
- `date`
- `union`

**Usage Example**:

```typescript
// Basic usage - field can be undefined
const validator = Builder()
  .use(optionalPlugin)
  .for<UserProfile>()
  .v("nickname", (b) => b.string.optional().min(3))
  .v("age", (b) => b.number.optional().min(0))
  .build();

// Arrays and objects can be optional
builder.v("hobbies", (b) => b.array.optional().minLength(1));
builder.v("settings", (b) => b.object.optional());
```

**Parameters**:

- No parameters - this is a modifier plugin

**Returns**: Validation function that returns true and skips further validation if value is undefined

**Custom Error Message**:

```typescript
This plugin does not generate errors - it allows undefined values
```

---

#### recursivelyWithContext

**Description**: Advanced recursive validation with access to depth and parent context

**Since**: 1.0.0
/

**Allowed Types**:

- `object`

**Usage Example**:

```typescript
// Basic recursive validation with max depth
const validator = Builder()
  .use(recursivelyWithContextPlugin)
  .for<TreeData>()
  .v("tree", (b) => b.object.recursivelyWithContext({ maxDepth: 3 }))
  .build();

// Conditional validation based on depth
builder.v("nestedConfig", (b) =>
  b.object.recursivelyWithContext({
    validateBasedOnDepth: (depth) => depth <= 2,
  })
);

// Tree structures with depth limits
builder.v("categoryTree", (b) =>
  b.object.recursivelyWithContext({
    maxDepth: 10,
    issueFactory: () => "Category nesting too deep",
  })
);
```

**Parameters**:

- options?: { maxDepth?: number; validateBasedOnDepth?: (depth: number) => boolean; issueFactory?: (context) => string } - Optional configuration

**Returns**: Validation function with recursive context support

**Custom Error Message**:

```typescript
.recursivelyWithContext({
  maxDepth: 5,
  issueFactory: ({ params }) =>
    `Maximum depth of ${params.maxDepth} exceeded`
})
```

---

#### required

**Description**: Validates that a field is required (not null, undefined, or empty string)

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `date`
- `array`
- `object`
- `tuple`
- `union`

**Usage Example**:

```typescript
// Basic usage
const validator = Builder()
  .use(requiredPlugin)
  .for<UserProfile>()
  .v("name", (b) => b.string.required())
  .v("age", (b) => b.number.required())
  .v("terms", (b) => b.boolean.required())
  .build();

// Custom error message
builder.v("email", (b) =>
  b.string.required({
    issueFactory: ({ path }) => `${path} is required`,
  })
);
```

**Parameters**:

- issueFactory?: (context: IssueContext) => string - Custom error message factory

**Returns**: Validation function that returns true if value exists (not null/undefined/empty string)

**Custom Error Message**:

```typescript
.required({
  issueFactory: ({ path, value }) =>
    `${path} field is required (current value: ${value})`
})
```

---

#### selfRecursively

**Description**: Validates self-referential objects recursively (tree structures, parent/child relationships)

**Since**: 1.0.0
/

**Allowed Types**:

- `object`

**Usage Example**:

```typescript
// Basic usage - validates tree structure recursively
const validator = Builder()
  .use(selfRecursivelyPlugin)
  .for<TreeNode>()
  .v("tree", (b) => b.object.selfRecursively())
  .build();

// With custom validation logic
builder.v("category", (b) =>
  b.object.selfRecursively({
    maxDepth: 5,
    validate: (ctx) => {
      const node = ctx.current;
      // Validate each node
      if (!node.id || typeof node.id !== "string") {
        ctx.reporter.report({
          path: ctx.path + ".id",
          message: "ID is required",
          code: "invalid_id",
        });
      }
      return { valid: true };
    },
  })
);
```

**Parameters**:

- options?: { maxDepth?: number; validate?: (ctx: RecursiveValidationContext) => ValidationResult } - Optional configuration

**Returns**: Validation function for self-referential object validation

**Custom Error Message**:

```typescript
.selfRecursively({
  validate: (ctx) => {
    // Custom validation logic
    ctx.reporter.report({
      path: ctx.path,
      message: 'Invalid node structure',
      code: 'INVALID_NODE'
    });
  }
})
```

---

#### stringAlphanumeric

**Description**: Validates that a string contains only alphanumeric characters (letters and numbers)

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - only letters and numbers allowed
const validator = Builder()
  .use(stringAlphanumericPlugin)
  .for<UserData>()
  .v("username", (b) => b.string.alphanumeric())
  .v("userId", (b) => b.string.required().alphanumeric())
  .build();

// Allow spaces in addition to alphanumeric characters
builder.v("displayName", (b) => b.string.alphanumeric(true));

// Combined with length validation
builder.v("productCode", (b) => b.string.alphanumeric().min(3).max(20));
```

**Parameters**:

- allowSpaces?: boolean - Whether to allow spaces (default: false)
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string contains only allowed characters

**Custom Error Message**:

```typescript
.alphanumeric(false, {
  issueFactory: ({ path, value }) =>
    `${path} must contain only letters and numbers (received: ${value})`
})
```

---

#### stringDatetime

**Description**: Validates that a string is a valid ISO 8601 datetime format

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - validates ISO 8601 datetime format
const validator = Builder()
  .use(stringDatetimePlugin)
  .for<EventData>()
  .v("createdAt", (b) => b.string.datetime())
  .v("updatedAt", (b) => b.string.required().datetime())
  .build();

// Valid formats:
// 2024-03-14T10:30:00Z
// 2024-03-14T10:30:00.000Z
// 2024-03-14T10:30:00+09:00
// 2024-03-14T10:30:00.123-05:00
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string matches ISO 8601 datetime format

**Custom Error Message**:

```typescript
.datetime({
  issueFactory: ({ path, value }) =>
    `${path} must be a valid ISO 8601 datetime (received: ${value})`
})
```

---

#### stringEmail

**Description**: Validates that a string is a valid email address format

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - validates email format
const validator = Builder()
  .use(stringEmailPlugin)
  .for<UserProfile>()
  .v("email", (b) => b.string.email())
  .v("contactEmail", (b) => b.string.required().email())
  .build();

// Combined with other string validators
builder.v("email", (b) => b.string.required().email().max(100));
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string matches email format

**Custom Error Message**:

```typescript
.email({
  issueFactory: ({ path, value }) =>
    `${path} must be a valid email address (received: ${value})`
})
```

---

#### stringEndsWith

**Description**: Validates that a string ends with a specific suffix

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - checks if string ends with suffix
const validator = Builder()
  .use(stringEndsWithPlugin)
  .for<FileData>()
  .v("filename", (b) => b.string.endsWith(".pdf"))
  .v("configFile", (b) => b.string.required().endsWith(".json"))
  .build();

// For file extension validation
builder.v("document", (b) => b.string.endsWith(".pdf").min(5));

// Email domain validation
builder.v("email", (b) => b.string.email().endsWith("@company.com"));
```

**Parameters**:

- suffix: string - The suffix that the string must end with
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string ends with the suffix

**Custom Error Message**:

```typescript
.endsWith(".json", {
  issueFactory: ({ path, value, params }) =>
    `${path} must end with '${params.suffix}' (received: ${value})`
})
```

---

#### stringEquals

**Description**: Validates that a string exactly matches a specific value

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - exact string match
const validator = Builder()
  .use(stringEqualsPlugin)
  .for<ConfigData>()
  .v("status", (b) => b.string.equals("active"))
  .v("environment", (b) => b.string.required().equals("production"))
  .build();

// For API version validation
builder.v("apiVersion", (b) => b.string.equals("2.0").required());

// For exact value matching in forms
builder.v("confirmation", (b) => b.string.equals("yes"));
```

**Parameters**:

- expectedValue: string - The exact string value to match
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string equals the expected value

**Custom Error Message**:

```typescript
.equals("production", {
  issueFactory: ({ path, value, params }) =>
    `${path} must be exactly '${params.expected}' (received: ${value})`
})
```

---

#### stringExactLength

**Description**: Validates that a string has exactly the specified length

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - requires exact string length
const validator = Builder()
  .use(stringExactLengthPlugin)
  .for<FormData>()
  .v("zipCode", (b) => b.string.exactLength(5))
  .v("countryCode", (b) => b.string.required().exactLength(2))
  .build();

// For product codes or SKUs
builder.v("productCode", (b) => b.string.exactLength(8).alphanumeric());

// For fixed-format phone extensions
builder.v("extension", (b) => b.string.optional().exactLength(4));
```

**Parameters**:

- expectedLength: number - The exact length the string must have
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string has exact length

**Custom Error Message**:

```typescript
.exactLength(4, {
  issueFactory: ({ path, value, params }) =>
    `${path} must be exactly ${params.expected} characters (received: ${params.actual})`
})
```

---

#### stringMax

**Description**: Validates that a string does not exceed the specified maximum length

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - set maximum string length
const validator = Builder()
  .use(stringMaxPlugin)
  .for<UserProfile>()
  .v("username", (b) => b.string.max(20))
  .v("bio", (b) => b.string.max(500))
  .build();

// Combined with min for length range
builder.v("description", (b) => b.string.min(10).max(200));
```

**Parameters**:

- max: number - Maximum character count
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string length is within the maximum

**Custom Error Message**:

```typescript
.max(100, {
  issueFactory: ({ path, value, params }) =>
    `${path} must not exceed ${params.max} characters (current: ${value.length})`
})
```

---

#### stringMin

**Description**: Validates that a string has at least the specified minimum length

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - set minimum string length
const validator = Builder()
  .use(stringMinPlugin)
  .for<UserProfile>()
  .v("password", (b) => b.string.min(8))
  .v("username", (b) => b.string.min(3))
  .build();

// Combined with other validators
builder.v("bio", (b) => b.string.required().min(10).max(500));
```

**Parameters**:

- min: number - Minimum character count
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string length is at least the minimum

**Custom Error Message**:

```typescript
.min(8, {
  issueFactory: ({ path, value, params }) =>
    `${path} must be at least ${params.min} characters (current: ${value.length})`
})
```

---

#### stringPattern

**Description**: Validates that a string matches a regular expression pattern

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - validate against regex pattern
const validator = Builder()
  .use(stringPatternPlugin)
  .for<UserData>()
  .v("phone", (b) => b.string.pattern(/^\d{3}-\d{3}-\d{4}$/))
  .v("zipCode", (b) => b.string.pattern(/^\d{5}(-\d{4})?$/))
  .build();

// Common patterns
builder.v("hexColor", (b) => b.string.pattern(/^#[0-9A-Fa-f]{6}$/));
builder.v("slug", (b) => b.string.pattern(/^[a-z0-9-]+$/));
```

**Parameters**:

- pattern: RegExp - Regular expression to match against
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string matches the pattern

**Custom Error Message**:

```typescript
.pattern(/^[A-Z]{2}\d{4}$/, {
  issueFactory: ({ path, value, params }) =>
    `${path} must match pattern ${params.pattern} (received: ${value})`
})
```

---

#### stringStartsWith

**Description**: Validates that a string begins with a specific prefix

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - checks if string starts with prefix
const validator = Builder()
  .use(stringStartsWithPlugin)
  .for<ApiData>()
  .v("url", (b) => b.string.startsWith("https://"))
  .v("apiKey", (b) => b.string.required().startsWith("sk_"))
  .build();

// For protocol validation
builder.v("secureUrl", (b) => b.string.startsWith("https://").url());

// For ID prefixes
builder.v("orderId", (b) =>
  b.string.startsWith("ORD-").pattern(/^ORD-\d{8}$/)
);
```

**Parameters**:

- prefix: string - The prefix that the string must start with
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string starts with the prefix

**Custom Error Message**:

```typescript
.startsWith("REF-", {
  issueFactory: ({ path, value, params }) =>
    `${path} must start with '${params.prefix}' (received: ${value})`
})
```

---

#### stringUrl

**Description**: Validates that a string is a valid URL format

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - validate URL format
const validator = Builder()
  .use(stringUrlPlugin)
  .for<UserProfile>()
  .v("website", (b) => b.string.url())
  .v("profileUrl", (b) => b.string.required().url())
  .build();

// Optional URL field
builder.v("homepage", (b) => b.string.optional().url());
```

**Parameters**:

- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string is a valid URL

**Custom Error Message**:

```typescript
.url({
  issueFactory: ({ path, value }) =>
    `${path} must be a valid URL (received: ${value})`
})
```

---

#### uuid

**Description**: Validates that a string is a valid UUID (Universally Unique Identifier)

**Since**: 1.0.0
/

**Allowed Types**:

- `string`

**Usage Example**:

```typescript
// Basic usage - validate any UUID version
const validator = Builder()
  .use(uuidPlugin)
  .for<Entity>()
  .v("id", (b) => b.string.uuid())
  .v("correlationId", (b) => b.string.required().uuid())
  .build();

// Validate specific UUID version
builder.v("userId", (b) => b.string.uuid(4)); // UUID v4 only
builder.v("namespaceId", (b) => b.string.uuid(5)); // UUID v5 only
```

**Parameters**:

- version?: 1 | 3 | 4 | 5 - Specific UUID version to validate (optional)
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that returns true if string is a valid UUID

**Custom Error Message**:

```typescript
.uuid(4, {
  issueFactory: ({ path, value, params }) =>
    `${path} must be a valid UUID v${params.version} (received: ${value})`
})
```

---

### Conditional Validation

#### optionalIf

**Description**: Makes a field optional based on a dynamic condition evaluated at validation time

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `array`
- `object`
- `date`
- `union`

**Usage Example**:

```typescript
// Basic conditional optional
const validator = Builder()
  .use(optionalIfPlugin)
  .for<UserForm>()
  .v("middleName", (b) =>
    b.string.optionalIf((values) => !values.includeMiddleName).min(2)
  )
  .build();

// Phone optional if email provided
builder.v("phone", (b) =>
  b.string.optionalIf((values) => !!values.email).pattern(/^\d{10}$/)
);
```

**Parameters**:

- condition: (allValues: TObject) => boolean - Condition function that determines if field is optional

**Returns**: Validation function that skips validation when condition is true and value is empty

**Custom Error Message**:

```typescript
This plugin does not generate errors - it conditionally allows empty values
```

---

#### requiredIf

**Description**: Makes a field required based on a dynamic condition evaluated at validation time

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `array`
- `object`
- `date`
- `union`

**Usage Example**:

```typescript
// Basic conditional required
const validator = Builder()
  .use(requiredIfPlugin)
  .for<ContactForm>()
  .v("email", (b) =>
    b.string.requiredIf((values) => values.contactMethod === "email")
  )
  .v("phone", (b) =>
    b.string.requiredIf((values) => values.contactMethod === "phone")
  )
  .build();

// Multiple conditions
builder.v("ssn", (b) =>
  b.string.requiredIf(
    (values) => values.country === "US" && values.employmentType === "full-time"
  )
);
```

**Parameters**:

- condition: (allValues: TObject) => boolean - Condition function that receives all form values
- options?: { issueFactory?: (context: IssueContext) => string } - Optional configuration

**Returns**: Validation function that checks if field is required based on condition

**Custom Error Message**:

```typescript
.requiredIf(
  values => values.hasAccount,
  { issueFactory: ({ path }) => `${path} is required when account exists` }
)
```

---

#### skip

**Description**: Completely skips validation for a field based on a dynamic condition

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `array`
- `object`
- `date`
- `union`

**Usage Example**:

```typescript
// Skip validation when not needed
const validator = Builder()
  .use(skipPlugin)
  .for<FormData>()
  .v("advancedOptions", (b) =>
    b.object.skip((values) => !values.showAdvanced).required()
  )
  .build();

// Skip debug fields in production
builder.v("debugInfo", (b) =>
  b.string.skip((values) => values.environment === "production").min(10)
);

// Skip entire sections conditionally
builder.v("enterpriseSettings", (b) =>
  b.object.skip((values) => values.plan !== "enterprise").recursively()
);
```

**Parameters**:

- condition: (allValues: TObject) => boolean - Function that returns true if field should be skipped
- options?: ValidationOptions - Optional configuration

**Returns**: Validation function that skips field entirely when condition is true

**Custom Error Message**:

```typescript
This plugin does not generate errors - it removes fields from validation
```

---

#### validateIf

**Description**: Conditionally applies all validation rules to a field based on a dynamic condition

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `array`
- `object`
- `date`
- `union`

**Usage Example**:

```typescript
// Validate URL only when custom endpoint is enabled
const validator = Builder()
  .use(validateIfPlugin)
  .for<ConfigData>()
  .v("customEndpoint", (b) =>
    b.string
      .validateIf((values) => values.useCustomEndpoint)
      .url()
      .min(10)
  )
  .build();

// Skip validation in local environment
builder.v("apiKey", (b) =>
  b.string
    .validateIf((values) => values.environment !== "local")
    .required()
    .min(32)
);

// Conditional sections in forms
builder.v("businessDetails.taxId", (b) =>
  b.string
    .validateIf((values) => values.accountType === "business")
    .required()
    .pattern(/^\d{9}$/)
);
```

**Parameters**:

- condition: (allValues: TObject) => boolean - Function that returns true if validation should run
- options?: ValidationOptions - Optional configuration

**Returns**: Validation function that skips all validations when condition is false

**Custom Error Message**:

```typescript
This plugin does not generate errors - it controls whether validation runs
```

---

### advanced

#### stitch

**Description**: Validates a field based on multiple other fields' values (cross-field validation)

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `date`
- `object`
- `array`
- `null`
- `undefined`

**Usage Example**:

```typescript
// Date range validation
const validator = Builder()
  .use(stitchPlugin)
  .for<EventForm>()
  .v("eventDate", (b) =>
    b.string.datetime().stitch({
      fields: ["startDate", "endDate"],
      validate: (values, eventDate) => {
        const event = new Date(eventDate);
        const start = new Date(values.startDate);
        const end = new Date(values.endDate);
        return {
          valid: event >= start && event <= end,
          message: "Event date must be between start and end dates",
        };
      },
    })
  )
  .build();

// Price calculation validation
builder.v("total", (b) =>
  b.number.stitch({
    fields: ["price", "quantity", "discount"],
    validate: (values, total) => {
      const calculated = values.price * values.quantity * (1 - values.discount);
      return {
        valid: Math.abs(total - calculated) < 0.01,
        message: "Total does not match price * quantity * (1 - discount)",
      };
    },
  })
);

// Conditional requirement based on multiple fields
builder.v("shippingAddress", (b) =>
  b.string.stitch({
    fields: ["sameAsBilling", "billingAddress", "country"],
    validate: (values, shippingAddr) => {
      if (values.sameAsBilling && !shippingAddr) {
        return { valid: true }; // Optional when same as billing
      }
      if (values.country === "US" && !shippingAddr) {
        return {
          valid: false,
          message: "Shipping address required for US orders",
        };
      }
      return { valid: true };
    },
  })
);
```

**Parameters**:

- options: { fields: string[], validate: (values, currentValue) => { valid: boolean, message?: string } }

**Returns**: Validation function that validates based on multiple fields

**Custom Error Message**:

```typescript
.stitch({
  fields: ["min", "max"],
  validate: (values, current) => ({
    valid: current >= values.min && current <= values.max,
    message: `Value must be between ${values.min} and ${values.max}`
  })
})
```

---

### Transform Plugins

#### transform

**Description**: Transforms values after successful validation (type conversion, normalization, computed values)

**Since**: 1.0.0
/

**Allowed Types**:

- `string`
- `number`
- `boolean`
- `array`
- `object`
- `date`
- `union`

**Usage Example**:

```typescript
// String transformation (lowercase)
const validator = Builder()
  .use(transformPlugin)
  .for<UserData>()
  .v("email", (b) =>
    b.string
      .required()
      .email()
      .transform((v) => v.toLowerCase())
  )
  .build();

// Number to string conversion
builder.v("age", (b) =>
  b.number
    .required()
    .min(0)
    .transform((v) => String(v))
);

// Array element transformation
builder.v("tags", (b) =>
  b.array.transform((tags) => tags.map((t) => t.trim().toLowerCase()))
);
```

**Parameters**:

- transformFn: (value: T) => U - Transform function that takes input value and returns transformed value

**Returns**: Validation function with transformation

**Custom Error Message**:

```typescript
Transform plugin does not generate errors. Errors in transform function are treated as exceptions.
```

---

### Composable Plugins

#### unionGuard

**Description**: Validates union types by applying different validation rules based on type guards

**Since**: 1.0.0
/

**Allowed Types**:

- `union`

**Usage Example**:

```typescript
// Union type validation with type guards
type StringOrNumber = string | number;

const validator = Builder()
  .use(unionGuardPlugin)
  .for<{ value: StringOrNumber }>()
  .v("value", (b) =>
    b.union
      .guard(
        (v): v is string => typeof v === "string",
        (b) => b.string.min(3)
      )
      .guard(
        (v): v is number => typeof v === "number",
        (b) => b.number.min(0).max(100)
      )
  )
  .build();
```

**Parameters**:

- condition: TypeGuardCondition - Type guard function that returns true if value matches the type
- builderFn: (context: FieldBuilderContext) => any - Builder function for the specific type

**Returns**: Composable validation function that can chain multiple guards

**Custom Error Message**:

```typescript
Returns false if no guard condition matches the value
```

---
