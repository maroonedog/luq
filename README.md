<div align="center">
  <img src="./public/img/library_image.png" alt="Luq Logo" width="300" />

  # Luq

[![npm version](https://img.shields.io/npm/v/@maroonedog/luq.svg)](https://www.npmjs.com/package/@maroonedog/luq)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**A TypeScript validation library where the wrong rule does not compile.**

</div>

Your types were probably not written by you. `openapi-typescript` generates
them from a spec you do not own. Prisma and Drizzle generate them from the
schema of record. protobuf and GraphQL codegen generate them for services in
four languages at once. Increasingly, a model generates the code that uses them.

A validator whose schema is the source of truth assumes you are the one who
decides the shape. When that assumption holds, it is the better arrangement and
this README will say so again below. When it does not, you end up maintaining a
second description of a shape you did not choose. You can have the compiler check
the copy against the original — zod's `satisfies z.ZodType<Order>` does exactly
that — but you still author it, update it, and remember to write the check.

Luq runs the other way. It takes the type you already have and lets you declare
rules against its field paths. What makes those declarations worth writing is
that the compiler checks them against the type: a rule that does not apply to
the field it is written on is a compile error, not a rule that quietly never
fires.

That matters most when the code calling this library is generated rather than
typed by hand. A generator that picks the wrong rule, misspells a path or drops
an array wildcard gets a red squiggle, not a validator that passes everything.

| Mistake | Result |
|---|---|
| A slot unrelated to the field's type (`b.string` on a `number`) | compile error |
| A missing `[*]` (`"items.name"`) | compile error |
| Descending into a built-in (`"when.getTime"` on a `Date`) | compile error |
| A method that does not exist inside an element sub-chain | compile error |
| A JSON Schema keyword bound to a chain method that does not exist | compile error |
| A documented example drifting from the API | fails CI |

Every rule you can call is a plugin you imported by name, so the bundle contains
what you used and nothing else.

Every number on this page was measured on this repository, and the file it came
from is named next to it. Where a measurement is worse than 1.x — and some are —
it is written down as worse.

## Install

```bash
npm install @maroonedog/luq
```

## Quick start

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
import { stringEmailPlugin } from "@maroonedog/luq/plugins/stringEmail";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";

type User = {
  name: string;
  age: number;
  email: string;
};

const userValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .for<User>()
  .v("name", (b) => b.string.required().min(3))
  .v("age", (b) => b.number.required().min(18))
  .v("email", (b) => b.string.required().email())
  .build();

const result = userValidator.validate({
  name: "Jo",
  age: 25,
  email: "jo@example.com",
});

if (result.valid) {
  // `data` exists only on this branch — no cast, no non-null assertion.
  console.error(result.data.name);
} else {
  for (const issue of result.issues) {
    console.error(`${issue.path}: ${issue.message} (${issue.code})`);
  }
}
```

`build()` returns an **object**, not a function. It has four members:

| Member | What it gives back |
|---|---|
| `validate(value, options?)` | `ValidationResult<T>` holding the **original** value |
| `parse(value, options?)` | `ValidationResult<TParsed>` holding the value **after transforms** |
| `pick(path)` | a single-field validator for one declared path |
| `pickAll(paths)` | a validator returning exactly those paths, keyed by the path string |

A `ValidationResult<T>` is a discriminated union on `valid`: the success branch
carries `data`, both branches carry `issues`, and each issue is
`{ path, code, message, severity }`.

> Every code block on this page is extracted and typechecked against the built
> package by `npm run check:docs`. It exists because documentation drifts from
> the API it documents unless something compiles it — 1.x's quick start had drifted
> in three places at once (a `build()` result called as a function, a `result.issues`
> member that did not exist, and a subpath missing from the exports map), and each
> was the readable kind of mistake that nobody reads.

## It patches onto the types you already have

This is the practical consequence of being type-first, and it is the main reason
to reach for Luq: **your type definitions do not change.** Not re-authored as a
schema, not replaced by an inferred one, not moved. `.for<Order>()` takes the
`Order` you already have, exactly as it is, and every rule is declared against
it.

So Luq asks you to describe the **rules**, not the shape — the shape is already
written down. Adopting a schema-first validator on an existing codebase means
producing a second description of the same shape for every type you cover, and
then keeping the two in agreement; that is per-type work whether you author the
schema alongside the type or switch the type to be inferred from it. Luq skips
that step because it never needs the second description.

Which is what makes adoption a patch rather than a migration:

**Declare only the fields you care about.** A path you did not declare is not
validated, not required, and not read. There is no "unknown key" behaviour to
opt out of, so a partly-covered type is a normal state and not a half-finished
one.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Order = {
  id: string;
  customerNote: string;
  legacyBlob: unknown;
};

// One field of three.
const orderValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<Order>()
  .v("id", (b) => b.string.required().min(3))
  .build();

// `customerNote` and `legacyBlob` are never read, so anything goes there —
// including being absent.
console.error(orderValidator.validate({ id: "abc" } as Order).valid); // true
console.error(orderValidator.validate({ id: "ab" } as Order).valid); // false
```

**Validate one field at a time.** `pick(path)` gives back a validator for a
single declared path, which is what a form needs on blur. It takes the field's
own value, and optionally its siblings for cross-field rules.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Order = { id: string; customerNote: string };

const id = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<Order>()
  .v("id", (b) => b.string.required().min(3))
  .build()
  .pick("id");

console.error(id.validate("ab").valid); // false
console.error(id.validate("abc").valid); // true
```

`pickAll(["a", "b"])` does the same for a named subset and hands back exactly
those paths, keyed by the strings you asked for.

**Keep what you already have.** Luq implements Standard Schema v1, so a Luq
validator and a zod schema are interchangeable at any boundary that accepts one.
Adding Luq to one route does not commit the next one, and does not remove zod
from the routes it is already in.

None of this needs a migration step, because there is nothing global to migrate:
no registry, no plugin installation, no shared configuration object. A validator
is a value in a module, declared against a type that was there before it.

**And when you want the opposite, ask for it: `.strict()`.** Partial coverage is
the default because that is what makes a patch possible, but a builder that
declares `.strict()` will not compile until every leaf path of `T` is declared —
and the error names the ones you missed:

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Order = { id: string; customerNote: string; nested: { deep: number } };

export const incomplete = Builder()
  .use(requiredPlugin)
  .for<Order>()
  .v("id", (b) => b.string.required())
  .strict()
  // @ts-expect-error strict() returned
  // MissingFieldsError<"customerNote" | "nested.deep">, which has no build().
  .build();
```

It counts leaves, so an optional property, a `Date`, an array's elements
(`tags[*]`) and a field inside an array of objects (`items[*].sku`) are each
required in their own right. It has no run-time effect at all — the obligation
is discharged by the compiler.

So the choice between "cover one field" and "cover everything" is a single call,
made per builder, and reported at compile time with the missing names rather than
at run time as a value that quietly passed. What `.strict()` does **not** cover is
properties that are not in the type; rejecting those is a run-time rule and
belongs to `additionalProperties(false)`.

## When schema-first is the right answer

Worth stating plainly, because it is a real tension and not a debating point:
**if the schema genuinely is your single source of truth, schema-first is the
coherent arrangement, and zod, valibot or TypeBox are the right tools.** You
write one artefact, your types come out of it, and there is nothing to keep in
step. That is a better position than Luq's, and Luq cannot give it to you.

Luq is for the case where that artefact already exists somewhere else and is not
yours to move — an OpenAPI document you consume, a Prisma schema, a `.proto`
shared with three other services, a type someone generated last week. There, the
schema-first arrangement asks you to author a *second* source of truth, and the
question stops being which library is nicer and becomes which copy is right.

Two things follow that are easy to miss:

- **Luq contains both directions.** `fromJsonSchema(document)` is schema-first —
  the document decides, and Luq builds the rules from it. That is not a
  contradiction to be argued away; it is the same principle applied to a
  different upstream. What Luq declines to do is make you *hand-write* the second
  copy.
- **You do not have to pick a side per project, only per boundary.** Standard
  Schema means a zod schema and a Luq validator are interchangeable where they
  meet, so "the schema is the truth here, the type is the truth there" is a
  workable arrangement rather than an unresolved argument.

If you are starting from nothing and you will own the shape, use zod. It is
mature, it is everywhere, and every question you will have is already answered
somewhere.

## Field paths

A path is a string literal that TypeScript resolves against your type. Nested
fields use dots; array elements use `[*]`, and the issue you get back names the
**real index**.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Order = {
  customer: { name: string };
  items: { productId: string }[];
};

const orderValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<Order>()
  .v("customer.name", (b) => b.string.required().min(2))
  .v("items[*].productId", (b) => b.string.required().min(5))
  .build();

const rejected = orderValidator.validate({
  customer: { name: "Acme" },
  items: [{ productId: "PROD-1" }, { productId: "X" }],
});

// -> ["items[1].productId"], never "items[*].productId"
export const failedPaths = rejected.issues.map((issue) => issue.path);
```

A path that does not exist on the type is a compile error, not a silent no-op.
So is choosing a slot the field's type cannot be: `b.number` on a `string`
field fails to compile.

**Cross-field rules read those paths back with their types intact.** `stitch`
takes the paths it needs and hands them over as a bundle keyed by the path
string — each one typed from your type, nested paths included. There is no
`unknown` to narrow and no cast to write.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";
import { stitchPlugin } from "@maroonedog/luq/plugins/stitch";

type Booking = { seats: number; venue: { capacity: number } };

const bookingValidator = Builder()
  .use(requiredPlugin)
  .use(numberMinPlugin)
  .use(stitchPlugin)
  .for<Booking>()
  .v("venue.capacity", (b) => b.number.required().min(1))
  .v("seats", (b) =>
    b.number.required().stitch(["venue.capacity"], (fieldValues, value) => ({
      // fieldValues["venue.capacity"] is number, and value is number.
      valid: value <= fieldValues["venue.capacity"],
      message: "seats must fit the venue",
    }))
  )
  .build();
```

Asking for a path the type does not have is a compile error, and so is using a
bundled value at the wrong type. 1.x passed this bundle as
`Record<string, unknown>`, which meant every cross-field rule opened with a
cast; the paths were already declared, so the types were always knowable.

## Plugins are imports

There is no plugin registry to populate and no barrel you have to pay for.
`.use()` puts a plugin in the builder's bag, and the bag decides which methods
exist on which slots — so an unimported plugin is not merely absent at runtime,
its method does not typecheck.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Draft = { title: string };

const draftValidator = Builder()
  .use(requiredPlugin)
  .for<Draft>()
  // `.min(3)` is not offered here: stringMinPlugin was never `use`d.
  .v("title", (b) => b.string.required())
  .build();

export const isTitled = draftValidator.validate({ title: "x" }).valid;
```

78 plugin objects ship across 77 subpaths, plus one deprecated alias kept from
1.x. The complete table — subpath, symbol, chain method, slots — is generated
from the built package: **[docs/guide/plugin-reference.md](docs/guide/plugin-reference.md)**.

A convenience barrel exists at `@maroonedog/luq/plugins`. It is measurably free
when a bundler can tree-shake (three plugins via the barrel gzip to 7,986 B
against 7,987 B via three subpaths — 0.01%), but the per-plugin subpaths are the
supported route.

**Presets, for when the list gets long.** Writing `.use()` thirteen times before
the first field is a real cost of the design above, so the common bundles are
named. `.useAll(bundle)` registers every plugin in one.

```ts
import { Builder } from "@maroonedog/luq";
import { everydayRules } from "@maroonedog/luq/presets";

type Order = { id: string; quantity: number };

const orderValidator = Builder()
  .useAll(everydayRules)
  .for<Order>()
  .v("id", (b) => b.string.required().min(3))
  .v("quantity", (b) => b.number.required().integer().min(1))
  .build();
```

| Preset | What is in it |
|---|---|
| `presence` | `required` / `optional` / `nullable` |
| `strings` | presence plus `min` / `max` / `pattern` / `email` |
| `numbers` | presence plus `min` / `max` / `integer` |
| `arrays` | presence plus `minLength` / `maxLength` / `each` |
| `everydayRules` | all four, 13 plugins |

A preset is an ordinary object of plugins, so `.useAll()` and `.use()` mix, and
you can spread one to make your own. Registration is **first-wins**: a plugin
already registered is not silently replaced by a preset that also carries it,
whichever order they arrive in.

```ts
import { Builder } from "@maroonedog/luq";
import { presence, strings } from "@maroonedog/luq/presets";
import { stringUrlPlugin } from "@maroonedog/luq/plugins/stringUrl";

type Link = { href: string };

const linkValidator = Builder()
  .useAll({ ...presence, ...strings })
  .use(stringUrlPlugin)
  .for<Link>()
  .v("href", (b) => b.string.required().url())
  .build();
```

The bytes are still only what you reach. `presence` alone gzips to 8,203 B
against the 7,954 B floor, and `everydayRules` to 9,437 B — both are in the
size budget and re-measured on every build, because a convenience that quietly
costs a kilobyte is not a convenience.

## Normalising before the rules run

A form gives you a string in a number field and spaces around a name. `normalize`
sits beside `default` in `.v()`'s third argument and tidies the value **before**
anything judges it, so `validate()` and `parse()` never disagree about what they
looked at — and only `parse()` writes the tidied value back.

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
```

It takes and returns `unknown` on purpose: the value has not been validated yet,
and `"42"` → `42` is the point — typing it `(value: T) => T` would be a lie.

**It is never called with `undefined` or `null`.** So `(v) => String(v).trim()`
cannot turn a missing field into the string `"undefined"` and sneak it past
`required`. Absence is `default`'s job; `normalize` only sees a value that is
there, which is also why you never write a null check inside one.

The order is what makes the common case work: `"  "` → trim → `""` → presence
reads an empty string as missing → `required` fires.

## JSON Schema

```ts
import { fromJsonSchema } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

type Account = { email: string; age?: number };

const accountValidator = fromJsonSchema<Account>({
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    age: { type: "number", minimum: 18 },
  },
  required: ["email"],
});

export const accepted = accountValidator.validate({
  email: "a@example.com",
}).valid;
```

Measured Draft-07 conformance against the official
[JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)
(required tests only, skipped cases counted as **failures**):

**929 / 929 = 100.00%.** Read that against the floor, not against zero: a
validator that returned `true` unconditionally scores 551 / 929 = 59.31% on
this corpus. The skip list is empty, and its `cause` union is `never`, so
excluding a case again means adding a name to a type. Full breakdown, including
what closed each cause and what is still bounded:
[docs/json-schema-conformance.md](docs/json-schema-conformance.md).

External `$ref` resolves against a map of documents **you** already have —
`jsonSchemaFullFeature(document, { externalDocuments })`. Luq never fetches, so
a URI written in a schema cannot make the process open a socket, conversion
stays synchronous, and nothing is evaluated.

`jsonSchemaFullFeature` bundles 49 plugins so one import covers a whole
document. `@maroonedog/luq/plugins/jsonSchema` adds a chain method instead, so a
single declared field can be constrained by a document; it takes the plugin bag
explicitly. It is billed as the tree-shakeable half, and measured below, it is
not — use it for the chain method, not to save bytes.

The other direction works too: `toStandardJsonSchema(validator)` writes a built
validator back out as a Draft-07 or 2020-12 document. Targets, what happens to a
rule that cannot be expressed, and the ordering it needs are in
[docs/guide/json-schema.md](docs/guide/json-schema.md#the-other-direction-writing-a-document-out).

## Standard Schema

Luq implements [Standard Schema v1](https://standardschema.dev). Anything that
accepts a Standard Schema — tRPC, TanStack Form, Hono, t3-env — accepts a Luq
validator wherever it accepts a zod schema.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
import { toStandardSchema } from "@maroonedog/luq/standard-schema";

type Account = { handle: string };

const standard = toStandardSchema(
  Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Account>()
    .v("handle", (b) => b.string.required().min(2))
    .build()
);

// `standard` is still the Validator — `validate`, `parse`, `pick` and `pickAll`
// are all there — and it now also satisfies Standard Schema v1, so it can be
// handed to tRPC, TanStack Form, Hono or t3-env unchanged.
const outcome = standard["~standard"].validate({ handle: "j" });

if (outcome.issues === undefined) {
  console.error(outcome.value.handle);
} else {
  for (const issue of outcome.issues) {
    console.error(issue.message, issue.path);
  }
}
```

Three decisions the spec leaves open, made explicit here:

- `validate` calls Luq's `parse()`, not `validate()`. The spec's success result
  is `{ value: Output }`, and `Output` is the value *after* validation — so a
  `transform` has to be applied, and only `parse()` applies it.
- It collects every issue rather than stopping at the first. The consumer of
  this seam is a form, and returning one issue at a time produces a UI where
  fixing an error reveals the next one. Callers who want the fast path use the
  `Validator` directly.
- `InferInput` is the type you wrote in `.for<T>()`, not a type inferred back
  out of a schema value.

It is a subpath, not part of `build()`. Measured on the 2.0.0 core (7,420 B) and
carrying `~standard` on every validator adds 312 B — 4.2% charged to everyone,
including the people who never pass a validator to tRPC. Importing the subpath
costs those 312 B only when you import it, and nothing when you don't.

### react-hook-form

react-hook-form takes any Standard Schema, so the integration is one line:

<!-- luq-example: skip — needs react and react-hook-form, which the doc harness's scratch consumer does not install -->

```ts
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useForm } from "react-hook-form";

const { register, handleSubmit, formState } = useForm<Signup>({
  resolver: standardSchemaResolver(signupSchema),
});
```

Pair it with `normalize` and the payload reaching `handleSubmit` is already
tidied — the name trimmed, the email lowercased, and the number input's string
turned into a number — without `valueAsNumber` or a `setValueAs` per field,
because the resolver reads the value Luq wrote back.

A running form is in [examples/react-hook-form](examples/react-hook-form):
`npm install && npm run dev`.

## Your own rules

```ts
import { definePlugin, check, PASS, fail } from "@maroonedog/luq/plugin-kit";
import type { Unchanged } from "@maroonedog/luq/plugin-kit";

export const productCodePlugin = definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: { readonly prefix: string };
}>()({
  name: "productCode",
  method: "productCode",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        typeof value === "string" && value.startsWith("PROD-")
          ? PASS
          : fail({ actual: value }),
      describe: (_detail, messageContext) =>
        `${messageContext.path} must start with PROD-`,
      buildMessageContext: () => ({ prefix: "PROD-" }),
    }),
});
```

The `out` marker is the whole contract: it decides what `build()` is allowed to
return and what the chain's type becomes afterwards. Eleven argument markers and
four output markers make up the vocabulary — see
**[docs/guide/writing-a-plugin.md](docs/guide/writing-a-plugin.md)**.

## Measured numbers

### Bundle size

esbuild 0.25.5, `bundle + minify + esm + es2020 + platform:neutral + treeShaking`,
then `zlib.gzipSync` — the same options 1.x's own `bundle-size-comparison` used,
so the two columns are comparable. Recorded in
[config/size-budget.json](config/size-budget.json) and re-measured by
`npm run check:size` on every build.

| Entry | gzip | 1.x, same method |
|---|---:|---:|
<!-- generated:bundle-size -->
| `Builder` only, zero plugins | **8,208 B** | 17,423 B |
| + 6 plugins (1.x's "simple" set) | **9,124 B** | 19,562 B |
| core + `jsonSchema`, the plugin alone | **21,145 B** | — |
| core + `jsonSchemaFullFeature` | **23,536 B** | — |
| all 77 plugins | **26,253 B** | — |
<!-- /generated:bundle-size -->

1.x published "tree-shakeable, 19–23KB gzipped". Measured the same way, its
core was 17.4 KB **before any plugin was imported** — 89.1% of its "simple"
figure. Here the core is <!-- generated:bundle-core-share -->31.3% of the all-plugins build (8,208 of 26,253 B)<!-- /generated:bundle-core-share -->,
and adding a plugin costs 129–224 B of gzip. Both figures are in the table above;
the difference is where the bytes sit, not which README is right.

Two lines that are **not** wins:

- The all-plugins figure is larger than the 23,015 B 1.x published for its
  `complex` case. The two are not comparable — 1.x's figure was one schema's
  plugin set, not its whole catalogue — so it is not counted either way here.
- The `jsonSchema` row measures the plugin **without a bag**, which is not a
  configuration you can validate with. Supplying one costs about what
  `jsonSchemaFullFeature` costs, so the tree-shakeable JSON Schema route saves
  nothing worth having today; use `jsonSchemaFullFeature` unless you need the
  chain method for one field.
- A third figure used to sit here — `jsonSchema` plus a working 49-plugin bag —
  and it is gone. **Which 49 was never written down**, so nobody could
  re-measure it. A number nobody can reproduce is worth less than no number.

### Speed

`npm run bench:record`, recorded verbatim in
[config/perf-baseline.json](config/perf-baseline.json). Machine: AMD Ryzen 7
5825U, 16 logical cores, Node v23.11.0, Windows. Subject is `src/` transpiled by
ts-node, not the bundle. `abortEarly: true`, input accepted, so no rule is
skipped. Every subject rotates over a pool of at least four distinct values —
one frozen input let V8 delete a subject outright, which is the artefact
described below. Each figure is the median of the fastest half of 9 samples; the
spread quoted alongside is the full range over that figure, and on these ten it
is <!-- generated:perf-spread -->1.2–12.3%<!-- /generated:perf-spread -->.

| Shape | `validate` ops/sec | `parse` ops/sec |
|---|---:|---:|
<!-- generated:perf-throughput -->
| 1 field, 1 check | 5,581,199 | 5,593,550 |
| 3 fields, 6 plugins | 2,444,308 | 1,933,180 |
| nested, depth 2–3 | 1,722,770 | 1,701,094 |
| array of 50 elements | 90,590 | 90,013 |
| JSON Schema document | 312,630 | 309,502 |
<!-- /generated:perf-throughput -->

**This rewrite is slower than 1.x on flat and nested shapes.** Measured side by
side, in one process on one machine, 1.x source against this source, sample by
sample interleaved so a drift in the machine hits both halves of every ratio:

| Shape | 1.x | this | ratio |
|---|---:|---:|---:|
<!-- generated:perf-legacy -->
| 1 field | 26,568,111 | 5,463,953 | **×0.21** |
| 3 fields | 3,082,290 | 2,434,509 | **×0.79** |
| nested | 2,203,633 | 1,842,200 | **×0.83** |
| array of 50 | 19,610 | 84,707 | ×4.30 |
| JSON Schema | 146,283 | 306,778 | ×2.10 |
<!-- /generated:perf-legacy -->

1.x carried a directory of specialised fast paths that this implementation has
no equivalent of. The comparison was checked for the ways it could be wrong: 1.x
demonstrably rejects bad values on all five shapes, so it is not winning by
doing less work, and both halves are asserted to accept the accepted pool and
reject the rejected pool before either is timed.

Also worth stating plainly: **neither figure 1.x's README published reproduces
here.** It claimed 1.2M ops/sec simple and 43K complex; on this machine 1.x
itself does <!-- generated:perf-legacy-simple -->3.08M<!-- /generated:perf-legacy-simple -->
on the shape rebuilt from its own "simple" benchmark source, and "complex" has
no reproducible definition to measure.

`build()` costs 14–662 µs depending on shape, against sub-microsecond
`validate()` calls — so one `build()` pays for itself after 35–100 `validate()`
calls on four of the five shapes, and after 2 calls on the 50-element array
(where `validate()` itself costs ~33 µs).

CI does not gate on any absolute number. It gates on the ratio between Luq and a
hand-written validator measured in the same process, so the runner's speed
cancels out. Fifteen pairings are gated: five shapes × `validate` on accepted
input, `parse` on accepted input, and `validate` on rejected input — the
rejected path is a different program under `abortEarly` (early exit, issue
construction, path strings) and was previously not measured at all.

The gate's resolution is recorded rather than assumed. Slowing every shape's
validator by a fixed factor and re-running (`gateSensitivity` in
config/perf-baseline.json, one run per level): **+35% is caught** on 14 of the
15 pairings, +25% on 3, and **+15% is missed** on all 15. So the gate sees
roughly a third-slower regression and does not see a sixth-slower one.

The reference implementations are held to two conditions of their own, both
asserted before any timing. `bench/assert-reference-agreement.ts` requires the
hand-written reference and Luq to agree on every value in both pools, which is
what stops the denominator drifting into a cheaper check than the one Luq
performs — the email, UUID and date-time references were rewritten to the
plugins' own semantics after this was added, and the rejected pool carries one
value per known difference so reverting any of them fails the assertion.
`bench/measure-reference-work.ts` requires each reference to be slower than 0.95
of an empty loop over the same pool, which is how the deleted-subject artefact
is caught: when V8 removes the work the ratio sits at 1.00 or above, and the ten
figures recorded here span 0.01–0.86.

### CSP-safe

No `eval`, no `new Function`. Checked mechanically over all 762 emitted `.js`
and `.mjs` files by `npm run check:no-dynamic-code`, and over `src/` by the
public-API smoke test: **0 occurrences**.

The check is there because the claim is easy to make and easy to stop being true
— 1.x's README made it while `src/types/array-type-analysis.ts` still carried a
live `new Function`. This is the first release where a script enforces it on
every build rather than a sentence asserting it.

### Package

86 keys in `exports`, every one resolving to files that exist: 8 fixed keys
(`.`, `./package.json`, `./result`, `./plugin-kit`, `./field-rule`, `./async`,
`./plugins`, `./standard-schema`) and 78 under `./plugins/` — 77 plugins plus one
deprecated alias.
`npm pack --dry-run`: 1,197 files, 376.9 kB packed, 1.4 MB unpacked —
`LICENSE`, `README.md`, `package.json` and `dist/` (398 `.d.ts` + 398 `.js` +
398 `.mjs`), with nothing from `src/`, `test/`, `scripts/`, `bench/` or `docs/`,
no raw `.ts` and no source maps. A scratch consumer typechecks **every one of
the 86 keys** against the published declarations under **both** `node16` and
`bundler` resolution, and an unpublished subpath is proven to fail.

1.x's `createPluginRegistry` / `useField` / `createFieldRule` are published at
`@maroonedog/luq/field-rule`; `useField` is a free function now. See
[docs/migration/breaking-changes.md](docs/migration/breaking-changes.md#15-createpluginregistry-usefield-and-createfieldrule-moved-to-maroonedogluqfield-rule).

## Documentation

- **[Getting started](docs/guide/getting-started.md)** — the builder, what
  `build()` returns, reading a result, `parse` vs `validate`, options, defaults
- **[Field paths](docs/guide/field-paths.md)** — what a path may be, and what
  changed from 1.x
- **[Presence and conditionals](docs/guide/presence-and-conditionals.md)** —
  `required` / `optional` / `nullable` / `requiredIf`, the order rules run
  in, and the cross-field rules (`compareField` / `stitch` / `stitchWith`)
- **[JSON Schema](docs/guide/json-schema.md)** — the two front doors, writing a
  document back out, and the keywords that are not supported
- **[Writing a plugin](docs/guide/writing-a-plugin.md)** — markers, `out`,
  message factories, and the isolation rule
- **[Plugin reference](docs/guide/plugin-reference.md)** — generated table of
  every subpath, method and slot
- **[Breaking changes from 1.x](docs/migration/breaking-changes.md)** — every
  incompatibility with the fix beside it
- **[Draft-07 conformance](docs/json-schema-conformance.md)** — the 100% and
  what closed each of the ten causes that used to fail

## Status, and how this gets changed

The 2.x API is stable and the surface below is gated, but the production track
record is still short. Breaking changes happen in a major and nowhere else, an
API being removed is deprecated one major ahead, and each major ships with the
codemod needed to cross it.

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — `npm run verify` is the whole
  contract; the gates and what each one refuses
- **[SECURITY.md](SECURITY.md)** — reporting, zero runtime dependencies, the
  prototype-pollution and SSRF positions, and what is *not* protected against
- **[docs/RELEASING.md](docs/RELEASING.md)** — the release steps, the versioning
  policy, what each CI workflow watches, and what is still decided by hand

## About the "universal platform" goal

1.x described a `.luq` DSL that would generate validators for other languages,
against dated milestones. Those dates have passed and none of it shipped, so the
plan has been withdrawn rather than moved: no part of it is in this package, and
this release makes no claim about when any of it will exist. What is in the box
is the TypeScript validation library described above.

## License

MIT
