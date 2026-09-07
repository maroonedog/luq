# field-path-semantics

## 0. What was read

- `C:\projects\luq\src\core\plugin\utils\field-accessor.ts` (394 lines)
- `C:\projects\luq\src\core\plugin\utils\field-accessor-optimized.ts` (255 lines)
- `C:\projects\luq\src\core\builder\context\field-context.ts` (527 lines)
- `C:\projects\luq\src\core\builder\nested-array-processor.ts` (711 lines)
- Plus the call sites that actually define the semantics: `src\core\builder\validator-factory.ts` (lines 200-420, 990-1030, 1160-1310, 1791-2060, 2620-2680), `src\core\optimization\core\field-utils.ts` (lines 1-180), `src\types\util.ts` (all 132 lines), `src\core\plugin\jsonSchema\dsl-converter.ts` (lines 110-150), `src\core\builder\raw-validator.ts`, `src\constants.ts` (`DOT = "."`).
- Ran: `node node_modules/jest/bin/jest.js test/unit/core/plugin/utils/` → **1 suite failed, 1 passed; 8 failed / 84 passed of 92**.

`field-context.ts` turned out to contain **no path resolution logic at all**. It threads `fieldPath: string` opaquely into `createOptimizedTypeBuilder` / `attachPluginMethods` / `extractCheckFunction` (where it becomes `{ path: fieldPath, allValues }` handed to plugin `create()` results). Its only path-relevant contract is: **the path string a user wrote in `.v()` is passed verbatim to plugins as `context.path`** — it is never normalized, split, or rewritten before reaching a plugin.

---

## 1. The path grammar that is actually implemented

Two syntaxes coexist at runtime:

**A. Dot notation** — `"a.b.c"`. Split by the single-character constant `DOT = "."` (`src/constants.ts:7`). There is **no escaping mechanism whatsoever**. A property literally named `"a.b"` is unreachable; `test/unit/core/plugin/utils/field-accessor.test.ts` explicitly acknowledges this ("special characters in property names need to be handled by the calling code"). Numeric segments work in the *simple* accessor family (`createAccessor(["users","0","name"])` resolves `users[0].name`) but are **not** type-level reachable and break in the `createNestedValueAccessor` family (see §4).

**B. Wildcard bracket notation** — `[*]`:
- `items[*]` — validate each element of `items` as a whole
- `items[*].name` — validate `name` of each element
- `matrix[*][*]` — validate each element of each sub-array (multi-dimensional)
- `orders[*].items[*].productId` — arbitrary depth of interleaved arrays/objects
- `departments[*].teams[*]` — nested array-as-a-whole

**C. Legacy dot-star** — `"items.*.name"`. Recognized at runtime in exactly two places (`nested-array-processor.ts` `dotMatch`, `validator-factory.ts:1943` region `dotMatch`) and matched by `TypeOfPath`'s `` `${K}.*` `` / `` `${K}.*.${Rest}` `` branches — but **`NestedKeyOf` never generates it**, so `.v()` will not accept it under a typed builder. It is unreachable dead syntax.

---

## 2. Read resolution rules (`get`)

### 2.1 Simple accessor family — `createAccessor` / `createFieldAccessor`

`field-accessor.ts:17-68` and `field-accessor-optimized.ts:28-80`. Semantics (identical in both files):

| Input | Result |
|---|---|
| `[]` (zero segments) | identity — returns `obj` itself |
| 1-5 segments | unrolled `obj?.[k1]?.[k2]?...` — **optional chaining** |
| 6+ segments | loop with `result = result?.[key]`, plus `if (result === undefined) return undefined` early exit |
| missing intermediate key | `undefined`, no throw |
| `null` intermediate | `undefined`, no throw (`?.` short-circuits on `null`) |
| primitive intermediate (`{user:"John"}` + `"user.name.length"`) | reads the primitive's own property; `"John".length === 4` is returned by this family (`?.` does not stop at primitives) |
| array intermediate | treated as a plain object — `obj?.["users"]?.["name"]` → `undefined`. **No implicit mapping.** |
| array hole (`[ ,1]` index 0) | `undefined` |
| `__proto__` / `constructor` / `prototype` segment | **resolved normally — no guard anywhere in the codebase.** `grep -rn "__proto__" src` returns zero defensive checks. |
| `""` (empty path) | `"".split(".") === [""]` → reads `obj[""]`, **not** identity |

The 5-segment unrolled versions and the 6+ loop differ subtly: the unrolled form does not early-return, the loop does. Result is the same; only allocation differs.

### 2.2 Array-aware accessor family — `createNestedValueAccessor`

`field-accessor.ts:213-291` and `field-accessor-optimized.ts:160-239`. This is the accessor actually wired into the executor (`validator-factory.ts:1002/1014`, `getNestedValue` at `1791-1796`). Its semantics are **inconsistent by segment count**, and this is the single most important defect in this area:

- **1 segment**: `obj[path]` — no null guard on `obj` at all (`(obj) => obj[fieldPath]`; throws `TypeError` if `obj` is `null`).
- **2 segments** (`"users.name"`): if `obj[key1]` is an array → **returns the raw array**, ignoring `key2` entirely. Otherwise returns `obj[key1][key2]` when `key1` is a non-null object, else `undefined`. Note the stricter null handling here: it uses `!= null && typeof === "object"`, so `{user:"John"}` + `"user.name"` → `undefined` (unlike the simple family).
- **3+ segments** (`"users.profile.email"`): walks segments; the **first** array encountered mid-path triggers a `.map()` over its elements and returns a marker object `{ __isArrayElementField: true, values: [...], arrayPath: "<segments before and including the array>" }`. `arrayPath` is joined with `"."`.
- Inside that `.map()`, **arrays are not re-entered**. `"teams.members.name"` where `teams[i].members` is an array yields `values: [undefined, undefined]` — the loop does `elementCurrent = members["name"]` on an Array object. Only the outermost array is ever mapped.
- Elements that are `null` or non-object → `undefined` in `values`.
- Array **holes are skipped** by `.map()` and remain holes in `values` (they read as `undefined` but are not own properties).
- Non-object intermediate at 3+ segments → `undefined` (the loop guards `current == null || typeof current !== "object"`).
- **`[*]` is not understood by this function.** `createNestedValueAccessor("items[*].name")` splits to `["items[*]","name"]` and looks up the literal key `"items[*]"` → `undefined`. Every `[*]` path must be routed away from this function before it is called.

So: **`"users.name"` returns an array, `"users.profile.name"` returns a marker object, `"teams.members.name"` returns a marker full of `undefined`.** Three different shapes from one function.

### 2.3 A third, unrelated accessor — `src/core/optimization/core/field-utils.ts`

`createFieldAccessor` there is a fourth copy of the same unrolling (depths 1/2/3 + loop). Its loop guards `if (current == null) return undefined` **before** indexing rather than using `?.`, giving the same result. Its `parseFieldPath` (line 29) is a **stub that is hardcoded broken**: it sets `isArrayElement = false`, `arrayPath = undefined`, `elementKey = undefined` and never modifies them. Consequently `analyzeArrayField` (line 160) always returns `null` and `strategy-factory.ts:432`'s `FieldUtils.parseFieldPath(fieldDef.path).isArrayElement` is dead-always-false.

---

## 3. `[*]` resolution rules

There are **four independent, mutually inconsistent parsers** for the same `[*]` syntax:

**P1 — `field-accessor.ts:299` `parseFieldPath`** (dot-split, strips exactly one trailing `[*]` via `slice(0,-3)`):
- `"categories[*].name"` → `baseArrayPath: "categories"`, `elementPath: "name"` ✓
- `"a.b[*].c"` → `baseArrayPath: "a.b"`, `elementPath: "c"` ✓
- `"orders[*].items[*].id"` → `baseArrayPath: "orders"`, `elementPath: "items.id"` — **the inner `[*]` is silently erased**, producing a path that will not resolve
- `"matrix[*][*]"` → segment `"matrix[*][*]"` ends with `[*]` → `baseArrayPath: "matrix[*]"` → `createArrayElementAccessor` then does `obj["matrix[*]"]` → `undefined` → returns `null`. **Multi-dimensional arrays are broken in this parser.**

**P2 — `nested-array-processor.ts:21` `parseArrayElementPath`** (regex, the only one that is actually correct for the full grammar):
- `/^(.+\[\*\])\[\*\]$/` → `"matrix[*][*]"` → `arrayPath: "matrix[*]"`, `elementField: ""`; `"matrix[*][*][*]"` → `arrayPath: "matrix[*][*]"` (greedy) — recursion works
- `path.includes("[*].")` → `split(/\[\*\]\./)`; `"orders[*].items[*].productId"` → `arrayPath: "orders.items"`, `elementField: "productId"`; `"departments[*].teams[*]"` → `arrayPath: "departments.teams"`, `elementField: ""`
- `/^([^\[]+)\[\*\]\.(.+)$/`, `/^([^\[]+)\[\*\]$/`, `/^([^\.]+)\.\*\.(.+)$/` as fallbacks

**P3 — `validator-factory.ts:1932-1951`, inline inside `validateArrayElementPath`**: only three regexes (`X[*].Y`, `X.*.Y`, `X[*]`). **No multi-dimensional support** — `"matrix[*][*]"` falls through and `return errors` (an empty array), i.e. **the field is silently not validated**. Also, `"orders[*].items[*].id"` yields `elementField = "items[*].id"`, which is then fed to `getNestedValue(element, "items[*].id")` → `createNestedValueAccessor` → literal key lookup → `undefined`, so the inner array is validated against `undefined`.

**P4 — `src/types/util.ts` `TypeOfPath` / `NestedKeyOf`** (compile-time): supports `[*]`, `[*][*]`, `[*][*][*]` and their `.${Rest}` forms — hardcoded to **exactly 3 array dimensions**, with a recursion depth budget of 5 (`NestedKeyOfWithDepth<T, D = 5>`).

Which of P2 vs P3 runs for a given field is decided upstream by whether the field got assigned to an array batch — so **the same path string can be validated correctly, or silently skipped, depending on what other fields were declared alongside it.**

### 3.1 `[*]` value semantics (from the P2 path, `nested-array-processor.ts:378-676`)

- Target is not an array → `if (!Array.isArray(arrayData)) return { errors, transformedData }` — **silently valid**. Same in `validateArrayElementPath` (`return errors`).
- Empty array → the element loop body never runs → **no errors**; `validateArrayElementPath` additionally short-circuits with an explicit `if (arrayData.length === 0) return errors`.
- Array holes → the loop is index-based, so holes are visited as `undefined`; for `elementField !== ""` the guard `if (!element || typeof element !== "object") continue` **skips them silently** (this also skips `null`, `0`, `""`, and every primitive element). For `elementField === ""` (whole-element validation) there is no such guard, so holes/`null` **are** validated.
- `elementField === ""` (`matrix[*]`, `tags[*]`) validates the element itself.
- Multi-dimensional descent: `childArrayKey.startsWith("[*]")` → `childArrayData = element` (the element *is* the sub-array); otherwise `childArrayData = element[childArrayKey]`.
- `abortEarly` stops after the first element that produced an error; `abortEarlyOnEachField` is **hardcoded off inside array elements** (`const effectiveAbortEarlyOnEachField = false; // Always validate all fields in array elements`).
- Validator lookup for an element field tries, in order: `arrayPath.field`, `arrayPath[*].field`, `arrayPath.*.field`, then a **substring fallback** `fullPath.includes(elementField)` that can bind the wrong validator (e.g. elementField `"id"` matching a stored path `"orders.userId"`). For `elementField === ""` the fallback is worse: "use the first validator found in `fullFieldPaths`".

---

## 4. Error path emission (public-facing)

Wildcards in the **declaration** path become **numeric indices** in the **error** path:

- `nested-array-processor.ts`: `currentElementPath = parentPath ? \`${parentPath}[${i}]\` : \`${arrayPath}[${i}]\``, and field errors use `` `${currentElementPath}.${elementField}` ``
- `validator-factory.ts` `validateArrayElementPath`: `` `${arrayPath}[${i}].${elementField}` `` and `` `${arrayPath}[${i}]` ``
- Multi-dimensional composes naturally: `"matrix[0][2]"`
- `matchesFieldPattern` (`validator-factory.ts:2631`) formalizes the round-trip: `patternPath.replace(/\[\*\]/g, "\\[\\d+\\]")`, i.e. `"users[0].profile.tags"` matches `"users[*].profile.tags"`.
- Errors carry both `path: string` and `paths: () => string[]`.
- Root-level failure (`validate(null)`) uses `path: ""`.

Note the asymmetry, which is intentional and should be preserved: **`[*]` is input-only, `[n]` is output-only.** `NestedKeyOf` never produces `[0]`, so `.v("items[0].name", ...)` is a type error.

---

## 5. Write resolution rules (`set`, parse mode)

`createFieldSetter` (`field-accessor.ts:164`, `field-accessor-optimized.ts:108`, third copy in `field-utils.ts:84`, fourth as `createGlobalSetter` in `validator-factory.ts:1871`):

- Depths 1/2/3 unrolled, 4+ by loop.
- **Auto-vivification**: `if (!obj[k1]) obj[k1] = {}`. Note this is falsy-check, not null-check — an intermediate of `0`, `""`, or `false` is **overwritten with `{}`**, destroying data. `createGlobalSetter` instead uses `if (!(part in current) || typeof current[part] !== "object")` — which overwrites `null` (since `typeof null === "object"` is true, `null` survives there but not in the other three) — **four copies, three different vivification rules.**
- `field-accessor.ts` / `-optimized` setters do **not** null-guard `obj`; `field-utils.ts` does (`if (obj != null)`).
- Vivified containers are always `{}`, never `[]` — a numeric segment produces an object with a numeric key, not an array.
- **No prototype-pollution guard.** `createFieldSetter("__proto__.polluted")` writes to `Object.prototype`. This is reachable from untrusted input via `fromJsonSchema`: `dsl-converter.ts:121` builds paths as `` `${propertyPath}.${nestedName}` `` straight from schema property names, and `:138` as `` `${propertyPath}[*]` ``. A runtime-loaded Draft-07 schema with a property named `__proto__` (or one containing a `.`) becomes a field path directly.

---

## 6. Existence semantics (drives implicit REQUIRED)

Two conflicting definitions ship simultaneously:

- `createFieldExistenceChecker` (`field-accessor.ts:150`) = `accessor(obj) !== undefined`. **This is the one actually used** (`validator-factory.ts:1006,1018` → `fieldExistenceCache`). Therefore `{a:{b:undefined}}` and `{}` are indistinguishable, and `null` counts as **present**.
- `createExistenceChecker` (`validator-factory.ts:1799`, used only as the `hasNestedField` fallback) uses the `in` operator, which **walks the prototype chain** — `hasNestedField({}, "toString")` is `true`. It also requires every intermediate to be a non-null object.

The consequence chain (`validator-factory.ts:1269-1295`): field absent + optional → skip entirely; field absent + not optional + no explicit `required` plugin → emit a synthetic `{ code: "REQUIRED", message: "Field '<path>' is required" }`.

Separately, `validator-factory.ts:1224-1245` contains an ad-hoc rule: for a purely dotted path (no `[` and no `*`), each ancestor prefix is checked and **if any ancestor resolves to an empty array, the field is skipped entirely** — an undocumented interaction between dotted paths and arrays.

---

## 7. Type-level path semantics (`src/types/util.ts` — the real public contract)

`NestedKeyOf<T>` generates, for each key `K`:
- `K` always
- if `T[K]` is `Array<Array<V>>`: `K | \`${K}[*]\` | \`${K}[*][*]\` | \`${K}[*][*].${NestedKeyOf<V>}\``
- if `T[K]` is `Array<U>`: `K | \`${K}[*]\` | \`${K}[*].${NestedKeyOf<U>}\` | ArrayElementPaths<U, \`${K}[*]\`>`
- optional (`NonNullable<T[K]>`) arrays get the identical treatment
- plain objects (excluding `Function`, `Array`, `Date` via `IsPlainObject`): `K | \`${K}.${NestedKeyOf<...>}\``
- `ExcludeArrayMethods` strips `length`, `map`, `push`, … from generated paths
- depth budget: 5 (`[-1,0,1,2,3,4,5][D]`), max 3 array dimensions

`TypeOfPath<T, Path>` resolves in this branch order: `K[*][*][*]` → `K[*][*]` → `K[*]` → `K.*` → `K[*][*][*].Rest` → `K[*][*].Rest` → `K[*].Rest` → `K.*.Rest` → `K.Rest` → `Path extends keyof T`.

Critically, the final `K.Rest` branch contains **implicit array traversal at the type level**: `T[K] extends Array<infer U> ? TypeOfPath<U, Rest>`. This is the type-level mirror of `createNestedValueAccessor`'s implicit array mapping, and it is why "`users.name`" type-checks as `string` rather than erroring. **Both halves of this implicit behavior should be removed together.**

Used at: `plugin-types.ts:1284` (`v<Key extends NestedKeyOf<TObject> & string>`), `:1254` (`field`), `:1319` (`useField`), `:1140` (`pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>`), `:1203` (`Exclude<NestedKeyOf<TObject>, TDeclared>` for strict-completeness checking), `:296/:426/:437` (field-reference plugins). Re-exported publicly from `src/types/index.ts:74`.

---

## 8. Prototype-pollution posture: **none**

`grep -rn "__proto__|prototype|constructor\]" src` returns exactly three hits, none of them a guard: `type-guards.ts:25` (`proto === null || proto === Object.prototype`, a plain-object test), and two comments in `types/result.ts`. There is no key denylist, no `Object.hasOwn` check, no `Object.create(null)` intermediate, on any read, write, or existence path.

---

## 9. field-accessor vs field-accessor-optimized: the actual diff

**I compared them line by line. Their shared functions are behaviorally identical — there is no semantic divergence to adjudicate.**

`createAccessor`: identical (`if`-chain vs `switch`, both unroll 0-5 and fall back to the same loop with the same `undefined` early exit). `createFieldSetter`: identical (1/2/3 unrolled + loop, same falsy auto-vivification, neither guards `obj`). `createNestedValueAccessor`: identical, including the 2-segment-returns-raw-array quirk, the first-array-only mapping, and the marker object shape; the only textual differences are `remainingPath.indexOf('.') === -1` vs `remainingLength === 1` (equivalent after a dot-split) and `.join('.')` vs `.join(DOT)` (`DOT === "."`).

Differences are surface only:

| | `field-accessor.ts` | `field-accessor-optimized.ts` |
|---|---|---|
| extra exports | `createFieldAccessor`, `getCachedAccessor`, `createAccessorCacheFactory`, `createBatchAccessors`, `createMultiFieldGetter`, `createFieldExistenceChecker`, `parseFieldPath`, `createArrayElementAccessor` | `getPathSegments` (returns `Object.freeze`d array), `prewarmCache` (no-op, `@deprecated`), `clearAllCaches` (no-op, `@deprecated`) |
| `createAccessor` param | `string[]` | `readonly string[]` |
| who imports it | `nested-array-processor.ts`, `array-batch-optimizer.ts`, `ultra-fast-validator.ts`, `validator-factory.ts`, `compareField.ts`, `stitch.ts`, `stitch-typed.ts`, `stitchSimple.ts` | **only** `raw-validator.ts` |

**The test failures are not a behavioral divergence.** Of the 8 failures in `Field Accessor Optimized`, **5 assert caching identity against caches that were deliberately deleted** (the file's own comments say "Global caches removed to prevent memory leaks"): `getPathSegments` reference identity, `createFieldAccessor` reference identity, `createFieldSetter` reference identity, `prewarmCache`, `clearAllCaches`. The remaining 3 (`should handle array elements`, `should handle single property in array elements`, `should handle nested array element access`) assert a **uniform, recursive** `__isArrayElementField` marker — which **neither implementation produces**; `test/unit/core/plugin/utils/field-accessor.test.ts` passes only because it was rewritten to assert the actual buggy output ("For two-level access with array, it returns the array itself"; and a nested-array case that asserts only `values.toHaveLength(2)` while the values are in fact `[undefined, undefined]`).

**Verdict for the new implementation:** neither file is "the correct one." Keep the `createAccessor` / `createFieldSetter` semantics (identical in both, and correct modulo the missing prototype guard and the falsy auto-vivification bug). **Discard `createNestedValueAccessor` entirely** — its implicit array traversal is the root of the divergence and cannot be made coherent. Adopt `nested-array-processor.ts`'s `parseArrayElementPath` (P2) as the single source of truth for `[*]` grammar, since it is the only parser that handles multi-dimensional and interleaved arrays. Delete the other three parsers and the seven duplicate accessor/setter copies. The wish encoded in the optimized test (uniform marker, recursive descent into nested arrays) is the more coherent *design*, but it should be expressed by **explicit `[*]`**, not by implicit dotted traversal.

## 引き継ぐ契約 (15件)

### must-preserve (9)

#### Dot-notation field path
- 出典: `src/core/plugin/utils/field-accessor.ts:17-68 (createAccessor), src/constants.ts:7 (DOT)`
- 形: "a.b.c" — segments split on the single character "."; no escape syntax
- 意味: Walks own/inherited properties left to right. Missing key, null, or undefined at any point yields undefined without throwing. Never throws on a malformed path.

#### [*] array-element wildcard
- 出典: `src/core/builder/nested-array-processor.ts:21-103 (parseArrayElementPath)`
- 形: "items[*]", "items[*].name", "matrix[*][*]", "orders[*].items[*].productId", "departments[*].teams[*]"
- 意味: [*] means 'apply this field rule to every element'. A trailing [*] with no following field validates the element itself; [*].field validates that property of each element; consecutive [*][*] descends into sub-arrays. Arbitrary interleaving of object and array levels is supported.

#### Error path uses numeric indices
- 出典: `src/core/builder/nested-array-processor.ts:410-412, 550; src/core/builder/validator-factory.ts:2008, 2631`
- 形: error.path: "items[0].name", "matrix[0][2]", "" for root; error.paths: () => string[]
- 意味: A declaration path containing [*] emits errors with the wildcard replaced by the concrete index. The round-trip is formalized by matchesFieldPattern: patternPath.replace(/\[\*\]/g, "\\[\\d+\\]"). Declaration paths never contain [n]; error paths never contain [*].

#### NestedKeyOf<T>
- 出典: `src/types/util.ts:44-67; exported from src/types/index.ts:74`
- 形: type NestedKeyOf<T> = <union of all valid path strings for T>
- 意味: Constrains the first argument of .v(), .field(), .useField(), .pick(). Generates K, `K.sub…` for plain objects (Function/Array/Date excluded), and K | `K[*]` | `K[*].sub…` for arrays, plus `K[*][*]` forms for 2D arrays. Array method names (length, map, …) are excluded. Recursion depth 5; at most 3 array dimensions. Removing or narrowing this breaks every typed .v() call.

#### TypeOfPath<T, Path>
- 出典: `src/types/util.ts:69-131; exported from src/types/index.ts:74`
- 形: type TypeOfPath<T, Path extends string> = <the value type at Path>
- 意味: Resolves a path string to its value type; drives the b.string/b.number/... builder typing and pick()'s return type. Branch order: K[*][*][*], K[*][*], K[*], K.*, then the same with .Rest, then K.Rest, then keyof T.

#### Missing/null intermediate resolves to undefined, never throws
- 出典: `src/core/plugin/utils/field-accessor.ts:24-57`
- 形: accessor(obj) => value | undefined
- 意味: Validation of a deep path against a shallow object is not an exception — it is an undefined value which the field's own validators then judge. This is what makes .v("a.b.c", b => b.string.optional()) safe on {}.

#### fromJsonSchema path derivation
- 出典: `src/core/plugin/jsonSchema/dsl-converter.ts:121, 138`
- 形: nested property -> `${parentPath}.${name}`; array items -> `${parentPath}[*]`
- 意味: A Draft-07 schema is flattened to the same path grammar the builder uses, so runtime-loaded schemas and hand-written .v() calls share one path language.

#### Field path reaches plugins verbatim as context.path
- 出典: `src/core/builder/context/field-context.ts:384-393 (extractCheckFunction), :354`
- 形: result(value, { path: fieldPath, allValues: currentValue })
- 意味: The exact string the user wrote in .v() is handed to plugin implementations unmodified — never normalized, split, or rewritten. Field-reference plugins (compareField, stitch) rely on this.

#### Empty array => element rules do not fire
- 出典: `src/core/builder/nested-array-processor.ts:395-400 (loop never entered); src/core/builder/validator-factory.ts:1996-1999 (explicit early return)`
- 形: items: [] with a declared "items[*].name" rule => zero errors from that rule
- 意味: Element-level rules are vacuous over an empty array. Cardinality is expressed separately (arrayMinLength on "items"), not by the element rule.

### should-preserve (4)

#### Non-array value at an [*] path is silently skipped
- 出典: `src/core/builder/nested-array-processor.ts:391-393; src/core/builder/validator-factory.ts:1953-1957`
- 形: {items: "oops"} with "items[*].name" => no error from the element rule
- 意味: Element rules do not assert that the container is an array; that must be asserted by a separate rule on "items". This means a type error on the container produces zero errors unless the container itself was declared.

#### Existence = resolved value !== undefined
- 出典: `src/core/plugin/utils/field-accessor.ts:150-155; src/core/builder/validator-factory.ts:1269-1295`
- 形: createFieldExistenceChecker(path)(obj) => boolean
- 意味: Drives the implicit REQUIRED error ({code:"REQUIRED", message:"Field '<path>' is required"}) for declared, non-optional fields with no explicit required plugin. null counts as present; an own key explicitly set to undefined counts as absent.

#### Parse-mode writeback auto-vivifies missing intermediates
- 出典: `src/core/plugin/utils/field-accessor.ts:164-203`
- 形: createFieldSetter(path)(obj, value)
- 意味: Writing a transformed value to a nested path creates missing intermediate objects so transforms on deep paths work on partially-populated inputs.

#### abortEarlyOnEachField is disabled inside array elements
- 出典: `src/core/builder/nested-array-processor.ts:388`
- 形: const effectiveAbortEarlyOnEachField = false
- 意味: All declared field rules run on every array element even when abortEarlyOnEachField is set at the top level; only the top-level abortEarly stops iteration across elements.

### optional (2)

#### Numeric segment in a dot path
- 出典: `src/core/plugin/utils/field-accessor.ts:32-35; test/unit/core/plugin/utils/field-accessor-optimized.test.ts:117-121`
- 形: createAccessor(["users","0","name"])
- 意味: Resolves users[0].name in the simple accessor family. Not reachable through the typed .v() surface (NestedKeyOf never emits it) and broken in the array-aware family.

#### ".*." legacy wildcard syntax
- 出典: `src/core/builder/nested-array-processor.ts:92-99; src/core/builder/validator-factory.ts:1936-1941; src/types/util.ts:88-95, 111-117`
- 形: "items.*.name"
- 意味: Runtime-recognized as an alias for items[*].name, and present in TypeOfPath, but never generated by NestedKeyOf, so it cannot be typed through .v(). Effectively unreachable.

## 振る舞い規則

- One path grammar, one parser, one resolver. The new codebase must contain exactly ONE function that turns a path string into segments and exactly ONE that resolves segments against a value. Today there are four parsers (field-accessor.parseFieldPath, nested-array-processor.parseArrayElementPath, the inline regexes in validator-factory.validateArrayElementPath, field-utils.parseFieldPath) and four accessor/setter copies (field-accessor, field-accessor-optimized, field-utils, validator-factory.createGlobalSetter) that disagree.
- Parse paths once, at .build() time, into a typed segment list — never re-parse or re-split during validation. Model segments as a discriminated union, e.g. { kind: "key"; name: string } | { kind: "eachElement" }. String-sniffing (path.includes("[*]"), path.match(/\[\*\]/)) must not appear at validation time.
- Reject invalid path strings at build time with a thrown error naming the path. Silent fallbacks — the `return errors` when a regex misses, the `return () => null` when parseFieldPath fails — turn a typo into a rule that never runs. A declared rule must either execute or fail loudly.
- Array traversal happens only where the path says [*]. A dotted segment that lands on an array resolves to the array itself, full stop. The implicit map-over-array behavior of createNestedValueAccessor and the matching `T[K] extends Array<infer U> ? TypeOfPath<U, Rest>` branch in TypeOfPath must both be removed, together.
- The resolver returns one shape, always: a single value, or an ordered list of (concreteIndexPath, value) pairs when the path contains [*]. Never a bare array in one case and a { __isArrayElementField } marker in another. Sentinel objects smuggled through a value channel are banned.
- Guard every path segment against prototype pollution on read, write, and existence check. Reject or ignore "__proto__", "constructor", "prototype" as segment names — and reject them at build time, since fromJsonSchema derives segments verbatim from untrusted schema property names.
- Read only own properties. Existence must use Object.hasOwn (or an own-keys check), never the `in` operator, so hasNestedField({}, "toString") is false.
- Auto-vivification on write creates a container only when the existing value is null or undefined. Never overwrite a falsy-but-present value (0, "", false) with {} — createFieldSetter does exactly that today.
- Define behavior at every boundary explicitly and test it: missing key, own key set to undefined, null intermediate, primitive intermediate, array hole, empty array, non-array at an [*] path, [*] on an empty path, and a path segment that is the empty string. `"".split(".")` yields [""], not [], and today that silently reads obj[""].
- Support arbitrary [*] nesting depth uniformly. The current 3-dimension cap in TypeOfPath and NestedKeyOf, and the 5-level recursion budget, are implementation limits leaking into the type surface — pick a limit deliberately and document it, do not inherit these by accident.
- Never resolve a validator by substring match on a path. nested-array-processor's `fullPath.includes(elementField)` fallback and its 'use the first validator found' fallback can bind the wrong rule to a field. Validator lookup must be an exact keyed lookup against the parsed structure.
- The declaration grammar takes [*] only; the error grammar emits [n] only. Keep them distinct types in the new code so a wildcard path can never be emitted as an error path and vice versa. Provide the pattern-match direction (does "items[0].name" match "items[*].name") as one shared function.
- No caching of accessors keyed by string at module scope. Accessors are compiled once into the validator that owns them; module-level Maps were already removed here for leak reasons and must not come back.
- Segment splitting must be defined for keys containing a dot. Either define an escape, or reject such keys at build time with a clear error — the current silent-unreachable behavior is unacceptable now that fromJsonSchema feeds arbitrary property names in.

## 引き継がないもの

- **The entire `createNestedValueAccessor` function and its `{ __isArrayElementField, values, arrayPath }` marker object (both copies).** — It returns three different shapes depending on segment count: raw property for 1 segment, the raw ARRAY for 2 segments (ignoring the second key entirely), and a sentinel marker for 3+. It maps only the first array it meets and yields undefined for every array below that ("teams.members.name" -> [undefined, undefined]). It cannot parse [*] at all. It is the single largest source of the confusion in this area, and its 1-segment branch `(obj) => obj[fieldPath]` throws on a null object.
- **Implicit array traversal through dotted paths — both the runtime behavior above and its type-level twin `Path extends \`${K}.${Rest}\` ? T[K] extends Array<infer U> ? TypeOfPath<U, Rest>` in src/types/util.ts:118-121.** — It makes "users.name" mean something different from "users" with no marker in the syntax, and it collides with numeric-index segments ("items.0.name" hits the array branch and never reaches index 0). [*] already expresses this explicitly and unambiguously.
- **`field-accessor.ts`'s `parseFieldPath` and `createArrayElementAccessor` (lines 299-394).** — Broken for the grammar it claims to parse. `slice(0,-3)` strips exactly one trailing [*], so "matrix[*][*]" becomes baseArrayPath "matrix[*]" and then reads the literal key obj["matrix[*]"] -> undefined -> returns null (silently no validation). "orders[*].items[*].id" silently erases the inner [*], producing elementPath "items.id". Yet validator-factory.ts:404, :2130, :2186, :2451 depend on it for recursive array validators.
- **`src/core/optimization/core/field-utils.ts` `parseFieldPath` and `analyzeArrayField`.** — parseFieldPath is a stub that hardcodes isArrayElement=false and never sets arrayPath/elementKey, so analyzeArrayField always returns null and strategy-factory.ts:432's isArrayElement branch is dead code. Its header comment claims it 'consolidates logic duplicated across 4 files' — it consolidated nothing and added a fifth copy.
- **The inline path regexes inside `validator-factory.ts` `validateArrayElementPath` (lines 1932-1951).** — A third grammar with no multi-dimensional support: "matrix[*][*]" matches nothing and the function returns an empty error list, silently skipping the field. "orders[*].items[*].id" produces elementField "items[*].id" which is then resolved as a literal object key. Whether a field takes this route or the correct nested-array-processor route depends on unrelated sibling declarations.
- **Four divergent copies of createFieldSetter (field-accessor.ts:164, field-accessor-optimized.ts:108, field-utils.ts:84, validator-factory.ts:1871 createGlobalSetter) with three different auto-vivification rules and inconsistent null-object guards.** — `if (!obj[k]) obj[k] = {}` destroys a legitimate 0/""/false intermediate; `if (!(part in current) || typeof current[part] !== "object")` uses the prototype-walking `in` operator and leaves null intact. Data loss depends on which copy a given code path happens to call.
- **The two existence-check definitions, especially `createExistenceChecker` in validator-factory.ts:1799.** — It uses the `in` operator, so inherited members (toString, constructor, hasOwnProperty) report as existing fields. It contradicts createFieldExistenceChecker (value !== undefined), which is the one actually wired in — so the fallback path has different REQUIRED semantics from the fast path.
- **`prewarmCache` and `clearAllCaches` in field-accessor-optimized.ts (lines 245-256).** — Both are no-op bodies marked @deprecated, kept solely so a stale test file could still import them. Five of the eight failing tests in that suite assert reference-identity from caches that no longer exist.
- **`getCachedAccessor` and `createAccessorCacheFactory` (field-accessor.ts:79-104).** — Zero call sites in src/. Dead exported API kept alive by tests.
- **`createMultiFieldGetter` (field-accessor.ts:129-142) and the batch/multi-accessor duplication between the two files.** — Builds a Record keyed by the raw dotted path string, which cannot represent an [*] path and reintroduces string keys where a compiled structure belongs. createBatchAccessors already covers the stitch/compareField use case.
- **The 1-through-5-segment manual loop unrolling in both createAccessor implementations, and the 1-through-3 unrolling in both setters.** — ~120 lines across four files exist to hand-unroll a loop for a claimed V8 win with no benchmark in the repo justifying it; modern V8 inlines the loop. It is the reason the same semantics had to be written eight times and drifted.
- **The two field-accessor test files as they stand (test/unit/core/plugin/utils/field-accessor.test.ts, field-accessor-optimized.test.ts).** — field-accessor.test.ts was written to assert the buggy actual output ("For two-level access with array, it returns the array itself"; a nested-array case asserting only values.toHaveLength(2) while every value is undefined). field-accessor-optimized.test.ts asserts caching identity that no longer exists plus a marker semantics nothing implements. Neither records a decision worth keeping.
- **The ad-hoc 'skip this field if any ancestor prefix is an empty array' rule at validator-factory.ts:1224-1245.** — An undocumented special case, applied only to paths containing no `[` and no `*`, that silently suppresses validation of a dotted field. If empty-array suppression is desired it must be part of the resolution rule, not a guard bolted onto one loop.
- **`ArrayElementPaths<U, Prefix, D>` in src/types/util.ts:33-41.** — Its object-mapped type emits `${Prefix}.${P}` for array-valued properties only and `never` for everything else, duplicating paths that the main NestedKeyOfWithDepth branch already emits and contributing to the union blowup that forced the depth-5 budget.

## 公開シンボル (13)

`NestedKeyOf`, `TypeOfPath`, `ElementType`, `InferType`, `.v(path, builderFn)`, `.field(path, builderFn)`, `.useField(path)`, `.pick(path)`, `[*]`, `error.path`, `error.paths()`, `"REQUIRED"`, `fromJsonSchema`

