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
decides the shape. When you are not, it asks you to write that shape a second
time and keep the copy in step by hand — and nothing checks that the two still
agree. They drift, and the first sign is a value that passed the copy and does
not fit the original.

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

Every number on this page was measured on this repository. Where a measurement
is worse than the 1.x release, it is written down as worse. The provenance of
each figure is named next to it.

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
> package by `npm run check:docs`. The 1.x README's quick start called `build()`'s
> return value as a function, read a `result.issues` member 1.x's `Result` did not
> have, and imported a subpath the exports map did not contain. That is what the
> gate exists to prevent.

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

77 plugin objects ship across 76 subpaths, plus one deprecated alias kept from
1.x. The complete table — subpath, symbol, chain method, slots — is generated
from the built package: **[docs/guide/plugin-reference.md](docs/guide/plugin-reference.md)**.

A convenience barrel exists at `@maroonedog/luq/plugins`. It is measurably free
when a bundler can tree-shake (three plugins via the barrel gzip to 7,986 B
against 7,987 B via three subpaths — 0.01%), but the per-plugin subpaths are the
supported route.

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

**855 / 929 = 92.03%.** A validator that returned `true` unconditionally would
score 551 / 929 = 59.31% on this corpus, which is the number the 89% should be
read against. Full breakdown, including every one of the 101 failures:
[docs/json-schema-conformance.md](docs/json-schema-conformance.md).

`jsonSchemaFullFeature` bundles 49 plugins so one import covers a whole
document. `@maroonedog/luq/plugins/jsonSchema` adds a chain method instead, so a
single declared field can be constrained by a document; it takes the plugin bag
explicitly. It is billed as the tree-shakeable half, and measured below, it is
not — use it for the chain method, not to save bytes.

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

It is a subpath, not part of `build()`. Measured: the core gzips to 7,420 B and
carrying `~standard` on every validator adds 312 B — 4.2% charged to everyone,
including the people who never pass a validator to tRPC. Importing the subpath
costs those 312 B only when you import it, and nothing when you don't.

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
| `Builder` only, zero plugins | **7,420 B** | 17,423 B |
| + 6 plugins (1.x's "simple" set) | **8,373 B** | 19,562 B |
| all 76 plugins | **24,040 B** | — |
| core + `jsonSchema`, plugin alone (not usable) | **18,992 B** | — |
| core + `jsonSchema` + a working 49-plugin bag | **21,371 B** | 26.06–29.08 KB |
| core + `jsonSchemaFullFeature` | **21,383 B** | 31.75–32.31 KB |

The claim 1.x's README made — "tree-shakeable, 19–23KB gzipped" — was measuring
a core bundle that cost 17.4 KB **before you used anything**: 89.1% of its
"simple" figure was paid up front. Here the core is 30.9% of the all-plugins
build (7,420 of 24,040 B), and adding a plugin costs 129–224 B of gzip.

Two lines that are **not** wins:

- "all 76 plugins at 24,040 B" is larger than the 23,015 B 1.x published for its
  `complex` case. The two are not comparable — 1.x's figure was one schema's
  plugin set, not its whole catalogue — so it is not counted either way here.
- The 18,992 B for `jsonSchema` measures the plugin **without a bag**, which is
  not a configuration you can actually validate with. Supplying a working bag
  costs 21,371 B — 12 bytes, 0.06%, **less** than just importing
  `jsonSchemaFullFeature`. The tree-shakeable JSON Schema route saves nothing
  worth having today; use `jsonSchemaFullFeature` unless you need the chain
  method for one field.

### Speed

`npm run bench:record`, recorded verbatim in
[config/perf-baseline.json](config/perf-baseline.json). Machine: AMD Ryzen 7
5825U, 16 logical cores, Node v23.11.0, Windows. Subject is `src/` transpiled by
ts-node, not the bundle. `abortEarly: true`, input accepted, so no rule is
skipped. Every subject rotates over a pool of at least four distinct values —
one frozen input let V8 delete a subject outright, which is the artefact
described below. Each figure is the median of the fastest half of 9 samples; the
spread quoted alongside is the full range over that figure, and on these ten it
is 2.9–8.6%.

| Shape | `validate` ops/sec | `parse` ops/sec |
|---|---:|---:|
| 1 field, 1 check | 2,801,628 | 2,617,522 |
| 3 fields, 6 plugins | 1,073,925 | 1,078,706 |
| nested, depth 2–3 | 707,734 | 700,829 |
| array of 50 elements | 29,963 | 29,774 |
| JSON Schema document | 159,643 | 159,966 |

**This rewrite is slower than 1.x on flat and nested shapes.** Measured side by
side, in one process on one machine, 1.x source against this source, sample by
sample interleaved so a drift in the machine hits both halves of every ratio:

| Shape | 1.x | this | ratio |
|---|---:|---:|---:|
| 1 field | 25,660,195 | 2,724,339 | **×0.11** |
| 3 fields | 3,059,093 | 1,069,167 | **×0.35** |
| nested | 2,215,768 | 708,461 | **×0.32** |
| array of 50 | 18,941 | 29,629 | ×1.57 |
| JSON Schema | 138,809 | 152,536 | ×1.09 |

1.x carried a directory of specialised fast paths that this implementation has
no equivalent of. The comparison was checked for the ways it could be wrong: 1.x
demonstrably rejects bad values on all five shapes, so it is not winning by
doing less work, and both halves are asserted to accept the accepted pool and
reject the rejected pool before either is timed.

Also worth stating plainly: **neither figure 1.x's README published reproduces
here.** It claimed 1.2M ops/sec simple and 43K complex; on this machine 1.x
itself does 3.06M on the shape rebuilt from its own "simple" benchmark source,
and "complex" has no reproducible definition to measure.

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
public-API smoke test: **0 occurrences**. 1.x made this claim in its README while
carrying a live `new Function` in `src/types/array-type-analysis.ts`; this is the
first release where it is enforced rather than asserted.

### Package

84 keys in `exports`, every one resolving to files that exist: 7 fixed keys
(`.`, `./package.json`, `./result`, `./plugin-kit`, `./field-rule`, `./async`,
`./plugins`) and 77 under `./plugins/` — 76 plugins plus one deprecated alias.
`npm pack --dry-run`: 1,149 files, 322,079 B packed, 1,216,371 B unpacked —
`LICENSE`, `README.md`, `package.json` and `dist/` (382 `.d.ts` + 382 `.js` +
382 `.mjs`), with nothing from `src/`, `test/`, `scripts/`, `bench/` or `docs/`,
no raw `.ts` and no source maps. A scratch consumer typechecks **every one of
the 84 keys** against the published declarations under **both** `node16` and
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
  `required` / `optional` / `nullable` / `requiredIf` and the order rules run in
- **[JSON Schema](docs/guide/json-schema.md)** — the two front doors, and the
  keywords that are not supported
- **[Writing a plugin](docs/guide/writing-a-plugin.md)** — markers, `out`,
  message factories, and the isolation rule
- **[Plugin reference](docs/guide/plugin-reference.md)** — generated table of
  every subpath, method and slot
- **[Breaking changes from 1.x](docs/migration/breaking-changes.md)** — every
  incompatibility with the fix beside it
- **[Draft-07 conformance](docs/json-schema-conformance.md)** — the 92.03% and
  all 101 failures

## About the "universal platform" goal

1.x's README advertised a `.luq` DSL that generates validators for other
languages, with dated milestones. No part of it ships in this package and this
release makes no claim about when it will. What is in the box is the TypeScript
validation library described above.

## License

MIT
