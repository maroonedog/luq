# Getting started

Every code block below is extracted and typechecked against the built package
by `npm run check:docs`, so nothing here can drift away from what the library
does. Blocks marked `luq-example: must-fail` are the opposite claim: they are
required **not** to compile.

## The five calls

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Article = { title: string; body: string };

const articleValidator = Builder() // 1. start (a function, not a constructor)
  .use(requiredPlugin) //             2. put plugins in the bag
  .use(stringMinPlugin)
  .for<Article>() //                  3. name the type being validated
  .v("title", (b) => b.string.required().min(3)) // 4. declare each field
  .v("body", (b) => b.string.required())
  .build(); //                        5. compile once

export const outcome = articleValidator.validate({ title: "Hi", body: "x" });
```

`.use()` must come before `.for()`. Declaration order between `.v()` calls does
not matter; rule order **within** one chain does, and is described in
[presence-and-conditionals.md](presence-and-conditionals.md).

`build()` does the work: it resolves every chain into a compiled plan once.
Measured on this repository, `build()` costs 13–620 µs depending on the shape
and `validate()` costs a fraction of a microsecond, so build once and keep the
validator — do not rebuild per request.

## What `build()` returns

An object with four members. It is **not** callable.

<!-- luq-example: must-fail the previous major's README called this as a function; that it cannot be is the specification -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Article = { title: string };

const articleValidator = Builder()
  .use(requiredPlugin)
  .for<Article>()
  .v("title", (b) => b.string.required())
  .build();

// TS2349: this expression is not callable.
export const broken = articleValidator({ title: "Hi" });
```

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Profile = { name: string; bio: string };

const profileValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<Profile>()
  .v("name", (b) => b.string.required().min(2))
  .v("bio", (b) => b.string.required())
  .build();

// The whole object, original values.
export const whole = profileValidator.validate({ name: "Jo", bio: "b" });

// The whole object, transforms applied (see below).
export const parsed = profileValidator.parse({ name: "Jo", bio: "b" });

// One field, validated on its own. `siblings` feeds cross-field rules.
export const oneField = profileValidator.pick("name").validate("Jo");

// Several fields, returned keyed by the path you asked for.
export const subset = profileValidator
  .pickAll(["name", "bio"])
  .validate({ name: "Jo", bio: "b" });
```

## Reading the result

`ValidationResult<T>` is a discriminated union on `valid`. There is no result
class, no `unwrap()` method on the value, and no `errors` member.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import type { ValidationIssue } from "@maroonedog/luq";

type Note = { text: string };

const noteValidator = Builder()
  .use(requiredPlugin)
  .for<Note>()
  .v("text", (b) => b.string.required())
  .build();

const result = noteValidator.validate({ text: "" });

export function describe(): string {
  if (result.valid) {
    // `data` is reachable only here. No cast, no `!`.
    return result.data.text;
  }
  return result.issues
    .map((issue: ValidationIssue) => `${issue.path} ${issue.code}`)
    .join(", ");
}
```

Every issue is `{ path, code, message, severity }`. `severity` is
`"error" | "warning" | "info"` and is never absent. The default `code` is the
**plugin's name** — `stringMin`, `stringEmail`, `required` — not a generic
`VALIDATION_ERROR`.

If you prefer exceptions, the `./result` subpath has the helpers:

```ts
import { unwrap, isOk, ValidationFailure } from "@maroonedog/luq/result";
import type { ValidationResult } from "@maroonedog/luq/result";

export function readOrThrow(result: ValidationResult<{ text: string }>): string {
  // `isOk` narrows exactly like reading `.valid` does.
  if (isOk(result)) return result.data.text;
  throw new ValidationFailure(result.issues);
}

export function readOrReport(result: ValidationResult<{ text: string }>): string {
  try {
    // `unwrap` throws a ValidationFailure that CARRIES the issues.
    return unwrap(result).text;
  } catch (thrown) {
    if (thrown instanceof ValidationFailure) return thrown.issues[0]?.path ?? "";
    throw thrown;
  }
}
```

## `validate` vs `parse`

`validate()` never changes your value. `parse()` applies `.transform()` rules,
and only to a field whose checks all passed.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { transformPlugin } from "@maroonedog/luq/plugins/transform";

type Signup = { email: string };

const signupValidator = Builder()
  .use(requiredPlugin)
  .use(transformPlugin)
  .for<Signup>()
  .v("email", (b) => b.string.required().transform((value) => value.trim()))
  .build();

// -> "  a@b.com  " (unchanged)
export const kept = signupValidator.validate({ email: "  a@b.com  " });
// -> "a@b.com"
export const trimmed = signupValidator.parse({ email: "  a@b.com  " });
```

`.transform()` also changes the chain's **type**, so a transform to another type
is reflected in what `parse()` hands back.

## Options

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Form = { first: string; last: string };

const formValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<Form>()
  .v("first", (b) => b.string.required().min(2))
  .v("last", (b) => b.string.required().min(2))
  .build();

const bad = { first: "a", last: "b" };

// Default: stop at the first field that fails -> 1 issue.
export const short = formValidator.validate(bad);

// Every field, one representative issue each -> the form UX combination.
export const perField = formValidator.validate(bad, { abortEarly: false });

// Every violation of every field.
export const everything = formValidator.validate(bad, {
  abortEarly: false,
  abortEarlyOnEachField: false,
});
```

Both flags **default to `true`**. 1.x's documentation said `abortEarly` defaulted
to `false`; its implementation defaulted to `true`, and the implementation is
what carried over.

The third option is `external`, a pre-resolved bag that
`@maroonedog/luq/plugins/fromContext` reads. That is the whole of the async
story: `@maroonedog/luq/async` resolves your promises and hands the result in on
this channel, so there is no second execution engine.

## Defaults

The third argument of `.v()` is a field configuration, never a rule.

```ts
import { Builder } from "@maroonedog/luq";
import { optionalPlugin } from "@maroonedog/luq/plugins/optional";

type Settings = { language: string };

const settingsValidator = Builder()
  .use(optionalPlugin)
  .for<Settings>()
  .v("language", (b) => b.string.optional(), { default: "en" })
  .build();

// The default is substituted before any rule looks at the value, so validate()
// and parse() judge the same thing — but only parse() writes it back.
export const filled = settingsValidator.parse({});
```

`applyDefaultToNull` defaults to `true`. A bare value as the third argument —
1.x's `.v("language", b => b.string.optional(), "en")` shorthand — is gone; pass
`{ default: "en" }`.

## What entering a slot checks

`b.<slot>` decides which methods the chain offers, and it also seeds the chain
with one rule: the value is of that type. So a field declared `b.number` and
handed a string reports `numberType`, even with no value rule on it at all.

| Slot | Code | Accepts |
|---|---|---|
| `b.string` | `stringType` | `typeof value === "string"` |
| `b.number` | `numberType` | `typeof value === "number"` — `NaN` included |
| `b.boolean` | `booleanType` | `typeof value === "boolean"` |
| `b.date` | `dateType` | `value instanceof Date` |
| `b.array` | `arrayType` | `Array.isArray(value)` |
| `b.object` | `objectType` | a plain object: not an array, not `null` |

`tuple`, `union` and `any` seed nothing. `any` accepts everything by
definition, and the other two are settled by the branches declared inside them.

Two things it deliberately leaves alone:

- **`undefined` and `null` pass it.** Absence belongs to `required` /
  `optional` / `nullable`, which run in the same list. A missing field reports
  `required`, not a type error.
- **`NaN` is a number.** The rule answers the type question only; `min`,
  `integer` and `finite` are where you say what you think of `NaN`.

This is also why a value rule never re-decides the type: `.min(18)` answers
PASS for `"abc"` because the slot has already reported it. One invalid value
produces one issue, not one per rule in the chain — which is the convention
[writing-a-plugin.md](writing-a-plugin.md) asks your own plugins to keep.

### `strict` is not required for any of this

The COMPILE-time half — a slot that does not match the field, a missing `[*]`,
a path the type does not declare, a method whose plugin you did not import —
is an error whether or not your `tsconfig.json` turns `strict` on. It is
checked both ways, so a codebase with `strict` and one without get the same
answers, and adopting Luq does not ask you to change your compiler settings
first.

Turning `strict` on is still worth doing. It costs nothing here and it is what
catches the rest of your code.

## `normalize`

The other member of that third argument. A form hands over a string in a number
field and spaces around a name; `normalize` tidies the value **before** anything
judges it, so `validate()` and `parse()` never disagree about what they looked
at, and only `parse()` writes the tidied value back.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";

type Signup = { name: string; age: number };

const signupValidator = Builder()
  .use(requiredPlugin)
  .use(numberMinPlugin)
  .for<Signup>()
  .v("name", (b) => b.string.required(), {
    normalize: (value) => (typeof value === "string" ? value.trim() : value),
  })
  // A number input still hands over a string.
  .v("age", (b) => b.number.required().min(18), {
    normalize: (value) => (value === "" ? value : Number(value)),
  })
  .build();

export const parsed = signupValidator.parse({ name: "  Ada  ", age: "31" });
```

It takes and returns `unknown` on purpose: the value has not been validated yet,
and `"42"` → `42` is the point, so typing it `(value: T) => T` would be a lie.

**It is never called with `undefined` or `null`.** So `(v) => String(v).trim()`
cannot turn a missing field into the string `"undefined"` and sneak it past
`required`. Absence is `default`'s job; `normalize` only ever sees a value that
is there, which is why a normalizer needs no null check of its own.

The order is what makes the common case work: `"  "` → trim → `""` → presence
reads an empty string as missing → `required` fires.

Running in that position also means the tidied value is what a consumer of the
[Standard Schema](standard-schema.md) face receives, which is what lets a form
library get a coerced payload without a per-field rule of its own.

## `strict()`

`strict()` has no runtime effect. It is a compile-time assertion that every leaf
path of your type has been declared; if one is missing, the returned object has
no `build()` and names the missing paths in the error.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Pair = { left: string; right: string };

export const pairValidator = Builder()
  .use(requiredPlugin)
  .for<Pair>()
  .v("left", (b) => b.string.required())
  .v("right", (b) => b.string.required())
  .strict()
  .build();
```

<!-- luq-example: must-fail with a field left undeclared, strict() returns something with no build() -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Pair = { left: string; right: string };

// "right" was never declared, so `.strict()` returns MissingFieldsError.
export const broken = Builder()
  .use(requiredPlugin)
  .for<Pair>()
  .v("left", (b) => b.string.required())
  .strict()
  .build();
```

`strict()` does not reject extra properties at run time. For that, use
`objectAdditionalProperties`.

## Messages, codes and severity

Every plugin method takes the same trailing options object.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Account = { handle: string };

const accountValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<Account>()
  .v("handle", (b) =>
    b.string.required().min(3, {
      code: "handleTooShort",
      severity: "warning",
      // The context carries this plugin's own members, typed.
      messageFactory: (context) =>
        `${context.path}: need ${String(context.min)}, got ${String(context.actual)}`,
    })
  )
  .build();

export const warned = accountValidator.validate({ handle: "ab" });
```

There is no separate `message: string` option anywhere. A constant message is
`{ messageFactory: () => "..." }`.

A non-`error` severity is reported without failing the result. The call above
returns `valid: true` **and** one issue:

```text
{ valid: true, data: { handle: "ab" },
  issues: [{ path: "handle", code: "handleTooShort",
             message: "handle: need 3, got 2", severity: "warning" }] }
```

So `issues` is worth reading on the success branch too.

## Next

- [Field paths](field-paths.md)
- [Presence and conditionals](presence-and-conditionals.md)
- [JSON Schema](json-schema.md)
- [Writing a plugin](writing-a-plugin.md)
- [Plugin reference](plugin-reference.md)
