# Breaking changes: 1.x → 2.x

This is the complete list. Every entry says what changed, why, and what to write
instead. Code blocks marked `luq-example: must-fail` are 1.x code kept here as
executable proof: `npm run check:docs` fails the build if any of them starts
compiling again, so this document cannot quietly become wrong.

Read [../guide/getting-started.md](../guide/getting-started.md) first if you
want the new shape rather than the diff.

A note on provenance. Several entries below are marked **documentation, not
behaviour**: 1.x's README and docs site described something its implementation
never did. Those are listed because they will break *your reading*, even though
nothing in the runtime changed.

---

## 1. Entry points

### 1.1 Plugins come from their own subpath; the root exports none

1.x's `dist/index.d.ts` declared 57 plugin exports that `dist/index.js` did not
have at run time, so `import { requiredPlugin } from "@maroonedog/luq"`
typechecked and gave you `undefined`.

<!-- luq-example: must-fail 1.x はここで型が通り、実行時に undefined を返した -->
```ts
import { requiredPlugin } from "@maroonedog/luq";

export const used = requiredPlugin;
```

```ts
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

export const used = requiredPlugin;
```

The root subpath now exports the entry point, the result vocabulary and the
plugin-author surface — and no plugins at all, deliberately: a barrel naming all
77 makes every one of them statically reachable and ends per-plugin
tree-shaking.

### 1.2 `@maroonedog/luq/plugins` now resolves

1.x's README told you to import from it. It was in no exports map, and threw
`ERR_PACKAGE_PATH_NOT_EXPORTED`. It is a real subpath now. It is measurably free
to use when your bundler tree-shakes (0.01% against per-plugin subpaths), but
the per-plugin subpaths remain the supported route.

### 1.3 `@maroonedog/luq/core/builder/plugins/plugin-creator` is gone

1.x's README documented this specifier for authoring plugins. It was also not in
the exports map. The plugin-author surface is `@maroonedog/luq/plugin-kit`.

| 1.x | 2.x |
|---|---|
| `@maroonedog/luq/core/builder/plugins/plugin-creator` | `@maroonedog/luq/plugin-kit` |
| — | `@maroonedog/luq/result` (result vocabulary alone) |
| — | `@maroonedog/luq/async` (promise resolution) |
| — | `@maroonedog/luq/package.json` |

### 1.4 `readOnlyWriteOnlyPlugin` split in two

`./plugins/readOnlyWriteOnly` still resolves and still exports `readOnlyPlugin`
and `writeOnlyPlugin`, as a deprecated alias. Prefer `./plugins/readOnly` and
`./plugins/writeOnly`.

### 1.5 `createPluginRegistry`, `useField` and `createFieldRule` moved to `@maroonedog/luq/field-rule`

1.x published them from the package root. They live on their own subpath now,
and two shapes changed:

- **`useField` is a free function, not a builder method.** `builder.useField(path, rule)`
  is gone (see 2.2); write `useField(builder, path, rule)`. It is a caller of
  `.v()`, so a rule cannot produce anything a hand-written `.v()` could not.
- **`createFieldRule` takes the builder first**: `createFieldRule(builder, define, options?)`.
  The 1.x shape — mint the rule from the registry — is still there as
  `registry.createFieldRule<TValue>(define, options?)`.

| 1.x | 2.x |
|---|---|
| `import { createPluginRegistry } from "@maroonedog/luq"` | `import { createPluginRegistry } from "@maroonedog/luq/field-rule"` |
| `builder.useField("name", rule)` | `useField(builder, "name", rule)` |

```ts
import { Builder } from "@maroonedog/luq";
import { createPluginRegistry, useField } from "@maroonedog/luq/field-rule";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type User = { name: string };

const registry = createPluginRegistry().use(requiredPlugin).use(stringMinPlugin);
const nameRule = registry.createFieldRule<string>(
  (b) => b.string.required().min(3),
  { name: "name" }
);

const validator = useField(
  registry.toBuilder().for<User>(),
  "name",
  nameRule
).build();

export const spliced = validator.validate({ name: "Ada" }).valid;
export const standalone = nameRule.validate("Ada").valid;
```

`registry.use()` is immutable — it returns a new registry and leaves the
receiver alone — which `Builder().use()` is not. That difference is the reason
the registry still exists rather than being folded into the builder.

---

## 2. The builder

### 2.1 `build()` returns an object, not a function

1.x's README showed `const validate = ...build(); validate(value)`. The
implementation never returned a callable.

<!-- luq-example: must-fail 1.x の README がそう書いていた形。実装は一度もこうではなかった -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type User = { name: string };

const validateUser = Builder()
  .use(requiredPlugin)
  .for<User>()
  .v("name", (b) => b.string.required())
  .build();

export const broken = validateUser({ name: "Jo" });
```

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type User = { name: string };

const userValidator = Builder()
  .use(requiredPlugin)
  .for<User>()
  .v("name", (b) => b.string.required())
  .build();

export const fixed = userValidator.validate({ name: "Jo" });
```

`build()` returns `{ validate, parse, pick, pickAll }`. 1.x had `validate`,
`parse` and `pick`; `pickAll` is new.

### 2.2 `.useField()`, `.field()` and `.strictOnEditor()` are gone

`.v()` is the one declaration mechanism. `strictOnEditor()` was an alias of
`strict()`; use `strict()`.

<!-- luq-example: must-fail 1.x の三つのメソッドはどれも FieldBuilder に無い -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type User = { name: string };

const partial = Builder()
  .use(requiredPlugin)
  .for<User>()
  .v("name", (b) => b.string.required());

export const brokenStrict = partial.strictOnEditor();
export const brokenUseField = partial.useField("name", {});
export const brokenField = partial.field("name");
```

### 2.3 `.v()`'s third argument lost three members and the shorthand

| 1.x | 2.x |
|---|---|
| `{ default }` | kept |
| `{ applyDefaultToNull }` | kept, still defaults to `true` |
| `{ description }` | removed |
| `{ deprecated }` | removed |
| `{ metadata }` | removed |
| `.v(path, define, "en")` — bare value shorthand | removed; write `{ default: "en" }` |

<!-- luq-example: must-fail 1.x の既定値ショートハンド。FieldOptions は生値を受けない -->
```ts
import { Builder } from "@maroonedog/luq";
import { optionalPlugin } from "@maroonedog/luq/plugins/optional";

type Settings = { language: string };

export const broken = Builder()
  .use(optionalPlugin)
  .for<Settings>()
  .v("language", (b) => b.string.optional(), "en")
  .build();
```

### 2.4 `Builder().withConfig()` is new

The per-builder override of the process-wide global config. It is merged once at
`build()` and reaches every plugin as `RuleBuildContext.config`. Nothing reads a
process-wide singleton during validation any more.

---

## 3. Results and errors

### 3.1 There is no `Result` class

1.x returned an object with `isValid()`, `isError()`, `unwrap()`, `unwrapOr()`,
`unwrapOrElse()`, `map()`, `flatMap()`, `tap()`, `tapError()`, `data()`,
`toPlainObject()`, `errors` and a compatibility `valid` property. 2.x returns a
plain discriminated union.

| 1.x | 2.x |
|---|---|
| `result.isValid()` | `result.valid` |
| `result.isError()` | `!result.valid` |
| `result.errors` | `result.issues` |
| `result.data()` | `result.data` (only on the success branch) |
| `result.unwrap()` | `unwrap(result)` from `@maroonedog/luq/result` |
| `result.unwrapOr(d)` | `result.valid ? result.data : d` |
| `result.map(fn)` | `result.valid ? fn(result.data) : result` |
| `result.toPlainObject()` | the result already is one |
| `LuqValidationException` | `ValidationFailure` from `@maroonedog/luq/result` |
| `e.errors` | `e.issues` |

<!-- luq-example: must-fail 1.x の Result メンバー。今の ValidationResult には無い -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type User = { name: string };

const userValidator = Builder()
  .use(requiredPlugin)
  .for<User>()
  .v("name", (b) => b.string.required())
  .build();

const result = userValidator.validate({ name: "Jo" });
export const broken = result.isValid() ? result.errors : result.unwrap();
```

The union is what buys you the narrowing: `data` exists on the success branch
only, so no cast and no non-null assertion is needed to read it.

### 3.2 `ValidationError` is now `ValidationIssue`, and carries `severity`

| 1.x | 2.x |
|---|---|
| `{ path, message, code }` | `{ path, code, message, severity }` |
| `severity` sometimes absent | never absent |
| `ValidationError.paths()` | gone; map over `issues` |

`severity` is `"error" | "warning" | "info"`. A non-`error` issue is reported
**without** failing the result, so a successful result can carry issues — read
`issues` on both branches.

### 3.3 `ValidationOptions` is `ValidateOptions`, and `context` is `external`

| 1.x | 2.x |
|---|---|
| `{ abortEarly }` | kept, still defaults to `true` |
| `{ abortEarlyOnEachField }` | kept, still defaults to `true` |
| `{ context }` | `{ external }`, read via `./plugins/fromContext` |
| `{ messageFactory }` (call-level) | removed; pass it per rule |
| `{ translate }` | removed |

### 3.4 Documentation, not behaviour: `abortEarly` never defaulted to `false`

1.x's docs said `abortEarly` defaulted to `false` (collect everything). Its
implementation tested `options?.abortEarly !== false`, which makes the default
`true`. 2.x keeps the implementation's answer and writes it as an explicit
`?? true`. If you read the old docs and never passed the option, your validators
were short-circuiting all along.

---

## 4. Field paths

Four accepted path forms are now compile errors. They come from one rule —
**array members are never enumerated, and built-in objects are opaque** — not
from four special cases.

| 1.x | 2.x | Why |
|---|---|---|
| `"items.name"` | `"items[*].name"` | 1.x returned the raw array and ignored `name` |
| `"items.*.name"` | `"items[*].name"` | recognised at run time, never generated by the type layer |
| `"items[0].name"` | `"items[*].name"` | a fixed index was already documented as unsupported |
| `"tags.length"` | `.minLength()` / `.maxLength()` | that was reaching the array's own property |
| `"when.getTime"` | — | no path enters a `Date`, `RegExp`, `Map`, `Set`, `Promise`, `Error`, buffer, function or class |

<!-- luq-example: must-fail 1.x が受けていたパス。すべて型エラーになる -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Model = { items: { name: string }[]; tags: string[]; when: Date };

export const broken = Builder()
  .use(requiredPlugin)
  .for<Model>()
  .v("items.name", (b) => b.string.required())
  .v("items.*.name", (b) => b.string.required())
  .v("items[0].name", (b) => b.string.required())
  .v("tags.length", (b) => b.number.required())
  .v("when.getTime", (b) => b.any.required())
  .build();
```

Path generation also counts down a depth budget of 6, so a self-referential
model yields a finite path union instead of TS2589. Use `objectRecursively` for
deeper recursion.

`NestedKeyOf` / `TypeOfPath` are replaced by `FieldPath` / `ValueAtPath`. One
consequence you can delete code over: 1.x needed
`pick("employees[*].name" as any)` because `NestedKeyOf` broke on array-element
paths. The cast is gone.

---

## 5. Types

### 5.1 A slot unrelated to the field's type is now an error

<!-- luq-example: must-fail 型と無関係なスロット。1.x では黙って通っていた -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Person = { age: number };

export const broken = Builder()
  .use(requiredPlugin)
  .for<Person>()
  .v("age", (b) => b.string.required())
  .build();
```

Use `b.any` when you genuinely mean "whatever this is".

### 5.2 `.required()` narrows out `null` as well as `undefined`

1.x's `.required({ allowNull: true })` has no option to pass, because
`required` takes no options beyond the uniform `RuleOptions`.

<!-- luq-example: must-fail required は allowNull を受け付けない -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Row = { closedAt: string | null };

export const broken = Builder()
  .use(requiredPlugin)
  .for<Row>()
  .v("closedAt", (b) => b.string.required({ allowNull: true }))
  .build();
```

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { nullablePlugin } from "@maroonedog/luq/plugins/nullable";

type Row = { closedAt: string | null };

export const fixed = Builder()
  .use(requiredPlugin)
  .use(nullablePlugin)
  .for<Row>()
  .v("closedAt", (b) => b.string.required().nullable())
  .build();
```

---

## 6. Rules and codes

### 6.1 The default error code is the plugin's name

1.x emitted constants like `REQUIRED` and `VALIDATION_ERROR`. 2.x uses the
plugin's `name`, uniformly, with `options.code` overriding it. Any code you
match on will have changed.

| Rule | 1.x code | 2.x code |
|---|---|---|
| `.required()` | `REQUIRED` | `required` |
| `.min(3)` on a string | `VALIDATION_ERROR` family | `stringMin` |
| `.custom(fn)` | `VALIDATION_ERROR` | `custom` |
| `.orFail(fn)` | `VALIDATION_ERROR` | `orFail` |

### 6.2 `orFail` lost its `message` option

There is one message channel: `messageFactory`. A constant message is
`{ messageFactory: () => "..." }`, and there is no second precedence rule to
remember.

### 6.3 `custom`'s predicate takes the value only

<!-- luq-example: must-fail custom の述語は第2引数を受け取らない -->
```ts
import { Builder } from "@maroonedog/luq";
import { customPlugin } from "@maroonedog/luq/plugins/custom";

type Order = { total: number; discount: number };

export const broken = Builder()
  .use(customPlugin)
  .for<Order>()
  .v("discount", (b) =>
    b.number.custom((value, rootData: Order) => value <= rootData.total)
  )
  .build();
```

Reading another field is `compareField`'s job (one path) or `stitch`'s (several,
typed by the paths you name). Two more differences: the predicate runs exactly
once — 1.x called it a second time to build the message — and a predicate that
throws is now a failed validation carrying the thrown message, not a crashed
`validate()`.

### 6.4 `requiredIf` / `optionalIf` are presence rules

They decide the field's presence gate instead of running as a check. The
consequence you will see: **when the condition makes a field required and the
value is missing, the rest of that field's chain does not run.** You get one
issue under `requiredIf`, not one per remaining rule.

Measured, on `.v("reason", b => b.string.requiredIf(r => r.kind === "other").min(5))`:

| Input | 2.x issues |
|---|---|
| `{ kind: "other" }` | `reason` / `requiredIf` only |
| `{ kind: "other", reason: "ab" }` | `reason` / `stringMin` |
| `{ kind: "a" }` | none |

As a check — which is what 1.x had — `.requiredIf()` could only ever reject an
empty string, and a genuinely missing field passed in silence. That was the one
case the plugin exists for.

### 6.5 `validateIf` / `skip` no longer depend on chain position

They are gates, and every gate on a field is asked before any check runs. In 1.x
`.min(3).validateIf(c)` still ran `min(3)`; now `.min(3).validateIf(c)` and
`.validateIf(c).min(3)` are the same declaration.

### 6.6 `stitchSimple` and `stitchTyped` are merged into `stitch`

1.x shipped three implementations, all three claiming the method name `stitch`.
There is one, with the positional shape `(fields, check, options?)`; the untyped
call still works because the declared paths are all the type system needs to
see. The check runs once.

### 6.7 `tupleBuilder`'s argument shape changed

Now `b.tuple.builder([position0, position1, ...], rest?)` — an array of
per-position sub-chains and an optional rest chain. Worth knowing before you
port: 1.x's `tupleBuilder` threw during `build()` through a mechanism that
reached for a `builder._executionPlan` nobody ever set, so tuple validation
never ran a line. There is no 1.x behaviour to preserve here.

### 6.8 No implicit `required`

A field that declares no presence rule accepts a missing value silently. 1.x had
a fast-path/slow-path split in which adding an array *elsewhere in the schema*
switched implicit-required on for unrelated fields. If you relied on that, add
`.required()` explicitly.

### 6.9 Transforms always run last, and only in `parse()`

1.x's mainline order was default → presence → checks → transforms, but a
plugin-registry fallback path ran transforms **first**. There is one order now:

```text
default -> presence -> gates -> checks -> transforms -> recursion
```

---

## 7. Writing plugins

`plugin({...})` is replaced by `definePlugin<Signature>()({...})`.

| 1.x | 2.x |
|---|---|
| `name` | `name` (unchanged; still the default error code) |
| `methodName` | `method` |
| `allowedTypes` | `slots` |
| `category` | gone — the `out` marker says what kind of rule it is |
| `impl: (...args) => ({ check, code, getErrorMessage, params })` | `build: (ctx, ...args) => Rule`, built by `check` / `presence` / `gate` / `transform` / `composite` / `recursive` |
| the descriptor's `code` | `ctx.code`, already resolved from `options.code` |
| `getErrorMessage` | `describe` on the rule, plus `messageFactory` via `ctx` |

`allowedTypes: undefined` used to mean "attach to every type". Declare all nine
slots explicitly instead. And where 1.x silently let the later of two plugins
overwrite a colliding `methodName`, a collision is now refused.

See [../guide/writing-a-plugin.md](../guide/writing-a-plugin.md) for the full
surface, the eleven argument markers and the four output markers.

---

## 8. JSON Schema

### 8.1 `fromJsonSchema` is a function, not a builder method

1.x grew `.fromJsonSchema()` onto `Builder` through a builder-extension
mechanism. `Builder` has exactly `use` / `withConfig` / `for` now, so the
conversion front door is a function.

<!-- luq-example: must-fail Builder に fromJsonSchema メソッドは無い -->
```ts
import { Builder } from "@maroonedog/luq";
import { jsonSchemaFullFeaturePlugin } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

export const broken = Builder()
  .use(jsonSchemaFullFeaturePlugin)
  .fromJsonSchema({ type: "object" })
  .build();
```

```ts
import { fromJsonSchema } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

export const fixed = fromJsonSchema({ type: "object" });
```

### 8.2 The two bundles have distinct method names

1.x let both claim `.fromJsonSchema` and relied on registration order to pick a
winner. They are `.jsonSchema(document, bag)` and
`.jsonSchemaFullFeature(document)` now, and one builder may hold both.

### 8.3 Conformance moved, a lot

1.x failed 32 of its own 42 `fromJsonSchema` integration cases, with recorded
symptoms including `format: date` accepting `"2024-13-01"`, `format: ipv4`
accepting `"999.999.999.999"`, `minItems` evaporating, and every sub-schema
inside an applicator being ignored. 2.x scores 828/929 = 89.13% on the official
Draft-07 suite. Documents that passed under 1.x because a keyword was ignored
will now be rejected — which is the point, but it is a behaviour change.

---

## 9. Performance, honestly

`validate()` on flat and nested shapes is **slower** than 1.x: ×0.09 on a single
field, ×0.34 on three fields, ×0.29 nested, measured side by side in one process
on one machine. It is faster on arrays (×1.56) and JSON Schema documents
(×1.15). 1.x carried a directory of specialised fast paths that 2.x has no
equivalent of. Numbers and method are in the README; the raw record is
`config/perf-baseline.json`.

If your workload is millions of flat-object validations per second, measure
before upgrading.

Bundle size moved the other way: the core floor is 7,420 B gzipped against 1.x's
17,423 B, and adding a plugin costs 129–224 B.
