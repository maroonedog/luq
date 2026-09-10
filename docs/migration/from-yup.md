# Coming from yup

Every claim on this page was produced by running both libraries — yup 1.7.1 and
this release — on the same inputs.

The short version: **presence behaves the same, and casting does not exist.**
If your yup schemas lean on `required` / `optional` / `nullable`, they port
almost mechanically. If they lean on yup casting `"31"` into `31` for you, that
part becomes explicit, and it is the only part that needs thought.

## The shape of the change

yup describes the **shape** and derives the type. Luq takes the type you already
have and declares **rules** against its field paths.

<!-- luq-example: skip — yup, which the doc harness's scratch consumer does not install -->

```ts
import * as yup from "yup";

const signupSchema = yup.object({
  name: yup.string().trim().required().min(2),
  email: yup.string().required().email(),
  age: yup.number().required().min(18).max(120),
});

type Signup = yup.InferType<typeof signupSchema>;
```

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
import { stringEmailPlugin } from "@maroonedog/luq/plugins/stringEmail";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";
import { numberMaxPlugin } from "@maroonedog/luq/plugins/numberMax";

// The type is written once, by you or by a generator, and stays where it is.
type Signup = { name: string; email: string; age: number };

export const signupValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .use(numberMaxPlugin)
  .for<Signup>()
  .v("name", (b) => b.string.required().min(2), {
    normalize: (value) => (typeof value === "string" ? value.trim() : value),
  })
  .v("email", (b) => b.string.required().email())
  .v("age", (b) => b.number.required().min(18).max(120))
  .build();
```

Every rule you can call is a plugin you imported. That is the visible cost of
the arrangement, and it buys the bundle containing only what you used.

## What is identical

Verified by running both on each input. This is most of what a form schema
actually depends on:

| Input | yup | Luq |
|---|---|---|
| `required` + `""` | rejected | rejected |
| `required` + `"  "` | accepted | accepted |
| `required` + `undefined` | rejected | rejected |
| `required` + `null` | rejected | rejected |
| `optional` + `null` | rejected | rejected |
| `nullable` + `null` | accepted | accepted |
| an undeclared key | kept, not stripped | kept, not stripped |
| stop at the first error | yes, by default | yes, by default |

The empty-string rule is the one people expect to be different and it is not:
both treat `""` as absent, so `required` fires on it.

Trimming lands in the same place too. yup's `.trim()` is a transform that runs
before the tests, so `"  "` becomes `""` and `required` reports it. Luq's
`normalize` runs in that same position, with the same consequence.

## What is different

### 1. There is no casting

yup's `number()` casts. `"31"` arrives as `31` and `"abc"` is rejected during
the cast. Luq does not cast, so this is written out:

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";

type Signup = { age: number };

export const ageValidator = Builder()
  .use(requiredPlugin)
  .use(numberMinPlugin)
  .for<Signup>()
  .v("age", (b) => b.number.required().min(18), {
    normalize: (value) =>
      typeof value === "string" && value.trim() !== "" ? Number(value) : value,
  })
  .build();
```

Two things follow. `normalize` is per field rather than global, so a field that
should not be coerced is not coerced by accident — which is what yup's
`strict: true` exists to switch off. And `validate()` and `parse()` judge the
same normalized value; only `parse()` writes it back, so the two can never
disagree about what they looked at.

### 2. The slot is a compile-time contract, not a run-time check

This is the difference to read twice.

`b.number` decides which methods exist on the chain and is checked against your
TypeScript type. It does **not** assert at run time that the value is a number.
Given a value that contradicts the type, the rules do not re-decide the type and
the field passes:

<!-- luq-example: skip — shows a run-time outcome rather than a compiling API; the values contradict the declared type on purpose -->

```ts
// age is declared `number`. Handed a value that is not one:
ageValidator.validate({ age: "abc" } as never); // valid
ageValidator.validate({ age: {} } as never); // valid
```

yup would reject all of those, because yup's `number()` is a run-time type test
as well as a cast.

This is deliberate: the premise is that the type is already true, so re-checking
it on every call is work with no answer to give. It holds for data you produced
— a form you rendered, a payload you built, a row from a client whose types are
generated.

**It does not hold for input you did not produce**, and for that there is a
different door in the same library:

```ts
import { fromJsonSchema } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

type Signup = { name: string; age: number };

// `type` IS enforced at run time here: a string in `age` fails with code "type".
export const untrusted = fromJsonSchema<Signup>({
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number", minimum: 18 },
  },
  required: ["name", "age"],
});
```

So the rule of thumb is: `.for<T>()` for data whose shape you already own,
`fromJsonSchema` for a body off the wire. Both return the same `Validator<T>`,
so the rest of your code does not change between them.

If you want one field checked at run time inside a hand-written chain,
`.custom()` is the escape hatch; there is no `.type()` chain method.

### 3. Results come back, they are not thrown

yup's `validate()` rejects with a `ValidationError`. Luq returns a discriminated
union and throws nothing:

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Signup = { name: string };

const validator = Builder()
  .use(requiredPlugin)
  .for<Signup>()
  .v("name", (b) => b.string.required())
  .build();

const result = validator.validate({ name: "" });

if (result.valid) {
  // `data` exists only on this branch — no cast, no non-null assertion.
  console.error(result.data.name);
} else {
  for (const issue of result.issues) {
    console.error(`${issue.path}: ${issue.code}`);
  }
}
```

`validate()` is synchronous. There is no `validateSync` / `validate` pair,
because there is nothing asynchronous to wait for.

## Method mapping

| yup | Luq | Subpath |
|---|---|---|
| `.required()` | `.required()` | `./plugins/required` |
| `.optional()` | `.optional()` | `./plugins/optional` |
| `.nullable()` | `.nullable()` | `./plugins/nullable` |
| `.min(n)` on a string | `.min(n)` | `./plugins/stringMin` |
| `.max(n)` on a string | `.max(n)` | `./plugins/stringMax` |
| `.min(n)` on a number | `.min(n)` | `./plugins/numberMin` |
| `.max(n)` on a number | `.max(n)` | `./plugins/numberMax` |
| `.email()` | `.email()` | `./plugins/stringEmail` |
| `.url()` | `.url()` | `./plugins/stringUrl` |
| `.uuid()` | `.uuid()` | `./plugins/uuid` |
| `.matches(re)` | `.pattern(re)` | `./plugins/stringPattern` |
| `.integer()` | `.integer()` | `./plugins/numberInteger` |
| `.positive()` | `.positive()` | `./plugins/numberPositive` |
| `.negative()` | `.negative()` | `./plugins/numberNegative` |
| `.oneOf([...])` | `.oneOf([...])` | `./plugins/oneOf` |
| `.length(n)` on an array | `.minLength(n)` / `.maxLength(n)` | `./plugins/arrayMinLength`, `./plugins/arrayMaxLength` |
| `.default(v)` | `{ default: v }`, the third argument of `.v()` | — |
| `.trim()` / `.lowercase()` | `{ normalize }`, the third argument of `.v()` | — |
| `.test(name, msg, fn)` | `.custom(fn)` | `./plugins/custom` |
| `.when(...)` | `.requiredIf()` / `.validateIf()` | `./plugins/requiredIf`, `./plugins/validateIf` |
| `.transform(fn)` | `.transform(fn)` | `./plugins/transform` |
| `yup.ref` in `.test` | `.compareField(path)` | `./plugins/compareField` |
| `yup.array().of(...)` | a `[*]` path: `.v("items[*].sku", …)` | — |
| `yup.object({...})` nested | a dotted path: `.v("customer.email", …)` | — |

The full table, generated from the built package, is
[../guide/plugin-reference.md](../guide/plugin-reference.md).

Nested shapes are the one place the two look least alike. yup nests schemas;
Luq names the path:

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringEmailPlugin } from "@maroonedog/luq/plugins/stringEmail";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Order = {
  customer: { email: string };
  lines: { sku: string }[];
};

export const orderValidator = Builder()
  .use(requiredPlugin)
  .use(stringEmailPlugin)
  .use(stringMinPlugin)
  .for<Order>()
  .v("customer.email", (b) => b.string.required().email())
  .v("lines[*].sku", (b) => b.string.required().min(3))
  .build();
```

A misspelled path and a missing `[*]` are both compile errors.

## react-hook-form

yup reaches react-hook-form through `yupResolver`. Luq reaches it through
Standard Schema, which yup does not implement, so the resolver changes:

<!-- luq-example: skip — needs react-hook-form, which the doc harness's scratch consumer does not install -->

```ts
// before
import { yupResolver } from "@hookform/resolvers/yup";
useForm({ resolver: yupResolver(signupSchema) });

// after
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { toStandardSchema } from "@maroonedog/luq/standard-schema";
useForm<Signup>({ resolver: standardSchemaResolver(toStandardSchema(signupValidator)) });
```

Because `normalize` runs before the rules and `parse()` writes it back, the
payload reaching `handleSubmit` is already trimmed and coerced, with no
`valueAsNumber` and no per-field `setValueAs`. A running form is in
[examples/react-hook-form](../../examples/react-hook-form).

See [../guide/standard-schema.md](../guide/standard-schema.md) for what else
crosses that boundary — and what does not: `code` and `severity` have no field
in the Standard Schema spec.

## When to stay on yup

Worth saying plainly.

- **You own the shape and want it in one place.** If the schema is genuinely
  your source of truth and the type falls out of it, `yup.InferType` is the
  coherent arrangement and Luq cannot give it to you. Luq is for the case where
  the type already exists somewhere you do not control.
- **You rely on casting everywhere.** Every cast becomes an explicit
  `normalize`. That is more honest and more typing; whether it is worth it
  depends on how many fields do it.
- **You need asynchronous tests.** yup's `.test()` may return a promise. Luq's
  rules are synchronous, and there is no asynchronous validation path.
- **You are mid-migration and want both.** That works: Luq implements Standard
  Schema, so a Luq validator and a yup schema sit behind the same boundary. You
  do not have to convert a codebase to convert a route.
