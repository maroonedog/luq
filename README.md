<div align="center">
  <img src="https://raw.githubusercontent.com/maroonedog/luq/master/public/img/library_image.png" alt="Luq Logo" width="300" />

  # Luq

[![npm version](https://img.shields.io/npm/v/@maroonedog/luq.svg)](https://www.npmjs.com/package/@maroonedog/luq)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**A TypeScript validation library where the wrong rule does not compile.**

[Documentation](https://luq.dev) · [Getting started](https://luq.dev/docs/getting-started) · [Plugins](https://luq.dev/plugins) · [JSON Schema](https://luq.dev/json-schema)

</div>

## Why this exists

Your types were probably not written by you. `openapi-typescript` generates
them from a spec you do not own. Prisma and Drizzle generate them from the
schema of record. protobuf and GraphQL codegen generate them for services in
four languages at once. Increasingly, a model generates the code that uses them.

A validator whose schema is the source of truth assumes you are the one who
decides the shape. When that assumption holds, it is the better arrangement and
this page says so again below. When it does not, you end up maintaining a second
description of a shape you did not choose. You can have the compiler check the
copy against the original — zod's `satisfies z.ZodType<Order>` does exactly that
— but you still author it, update it, and remember to write the check.

Luq runs the other way. It takes the type you already have and lets you declare
rules against its field paths. **Your type definitions do not change**: not
re-authored as a schema, not replaced by an inferred one, not moved. `.for<Order>()`
takes the `Order` you already have, exactly as it is.

What makes those declarations worth writing is that the compiler checks them
against the type: a rule that does not apply to the field it is written on is a
compile error, not a rule that quietly never fires.

| Mistake | Result |
|---|---|
| A slot unrelated to the field's type (`b.string` on a `number`) | compile error |
| A missing `[*]` (`"items.name"`) | compile error |
| Descending into a built-in (`"when.getTime"` on a `Date`) | compile error |
| A method that does not exist inside an element sub-chain | compile error |
| A JSON Schema keyword bound to a chain method that does not exist | compile error |
| A documented example drifting from the API | fails CI |

That matters most when the code calling this library is generated rather than
typed by hand. A generator that picks the wrong rule, misspells a path or drops
an array wildcard gets a red squiggle, not a validator that passes everything.

Two consequences worth knowing before you read further:

- **Adoption is a patch, not a migration.** A path you did not declare is not
  validated, not required, and not read, so a partly-covered type is a normal
  state rather than a half-finished one. There is nothing global to migrate: no
  registry, no plugin installation, no shared configuration object.
- **Every rule you can call is a plugin you imported by name**, so the bundle
  contains what you used and nothing else — an unimported plugin's method does
  not even typecheck. What each configuration costs is measured on every build:
  [luq.dev/benchmarks](https://luq.dev/benchmarks).

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

## Install

```bash
npm install @maroonedog/luq
```

Zero runtime dependencies. TypeScript 5.0 or later.

## The whole API

Four calls, in this order. There is no registry, no global setup and no config
file; a builder is built where it is used and carries its own settings.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";

// The type is yours, already written, wherever it already lives.
interface Order {
  readonly reference: string;
  readonly quantity: number;
  readonly note?: string;
}

const orderValidator = Builder()
  .use(requiredPlugin) //   every rule you can call is a plugin you imported
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .for<Order>() //          bind to the type; field paths are checked against it
  .v("reference", (b) => b.string.required().min(3))
  .v("quantity", (b) => b.number.required().min(1))
  .build(); //              returns Validator<Order>

const result = orderValidator.validate({ reference: "ab", quantity: 0 });
if (!result.valid) {
  for (const issue of result.issues) {
    // issue.path  "reference"   — where, with array indices filled in
    // issue.code  "stringMin"   — which rule, stable across messages
    // issue.message             — the text, overridable per call
    // issue.severity "error"    — only "error" makes the value invalid
  }
}
```

`.v(path, chain)` declares rules for one field. A path you do not declare is
not validated, not required and not read, so covering a type partly is a normal
state rather than a half-finished one.

### What a built validator gives you

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { transformPlugin } from "@maroonedog/luq/plugins/transform";

interface Account {
  readonly email: string;
}

const accounts = Builder()
  .use(requiredPlugin)
  .use(transformPlugin)
  .for<Account>()
  .v("email", (b) => b.string.required().transform((v) => v.toLowerCase()))
  .build();

accounts.validate({ email: "A@B.COM" }); // judges; never applies a transform
accounts.parse({ email: "A@B.COM" }); //    judges, then applies transforms
accounts.pick("email"); //                  one field, pre-resolved to its path
accounts.pickAll(["email"]); //             several fields, same plan
```

`validate` and `parse` return the same discriminated union: `{ valid: true,
data, issues }` or `{ valid: false, issues }`. `validate` hands back the object
you passed, by identity, when nothing was written.

### Slots

`b` offers one slot per kind: `b.string`, `b.number`, `b.boolean`, `b.date`,
`b.array`, `b.tuple`, `b.object`, `b.union`, `b.any`. The slot must match the
field's declared type, and `[*]` descends into array elements:

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { arrayMinLengthPlugin } from "@maroonedog/luq/plugins/arrayMinLength";

interface Basket {
  readonly items: readonly { readonly sku: string }[];
}

const baskets = Builder()
  .use(requiredPlugin)
  .use(arrayMinLengthPlugin)
  .for<Basket>()
  .v("items", (b) => b.array.required().minLength(1))
  .v("items[*].sku", (b) => b.string.required())
  .build();
```

### Settings

`.withConfig({ ... })` before `.use()`, resolved once at `build()`. Two
validators built under different settings keep their own.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

interface Payload {
  readonly id: string;
}

const strict = Builder()
  .withConfig({ rootMissingMessage: "Request body is missing" })
  .use(requiredPlugin)
  .for<Payload>()
  .v("id", (b) => b.string.required())
  .build();

strict.validate(null).valid; // false, with that message at the root path
```

## Finding the plugin for a rule

Every rule is a named import, so the bundle contains what you used and nothing
else. Two ways to get from a method to its import, both inside this package:

**The compiler tells you.** Calling a method whose plugin is not in the bag is
an error that names the symbol and the subpath:

> `This expression is not callable. Type 'PluginNotImported<"min",
> "stringMinPlugin", "@maroonedog/luq/plugins/stringMin">' has no call
> signatures.`

A misspelled method is a different error — `Property 'mim' does not exist` —
so the two mistakes stay apart.

**The manifest lists them all.** `PLUGIN_MANIFEST` ships with the package and
maps every plugin to the method it adds, the slots it adds it to, and the
specifier to import:

```ts
import { PLUGIN_MANIFEST } from "@maroonedog/luq/schema-tooling";

const forStringMin = PLUGIN_MANIFEST.filter((entry) =>
  entry.surfaces.some(
    (surface) => surface.method === "min" && surface.slots.includes("string")
  )
);
// [{ subpathName: "stringMin",
//    entryPoint: "@maroonedog/luq/plugins/stringMin",
//    exportedSymbols: ["stringMinPlugin"],
//    surfaces: [{ symbol: "stringMinPlugin", method: "min", slots: ["string"] }],
//    ... }]
```

## Documentation

### **[luq.dev](https://luq.dev)**

| | |
|---|---|
| [Getting started](https://luq.dev/docs/getting-started) | the builder, defaults, `normalize`, reading a result |
| [Core concepts](https://luq.dev/docs/core-concepts) | field paths, slots, presence, transforms |
| [Plugins](https://luq.dev/plugins) | every subpath, symbol, chain method and slot |
| [JSON Schema](https://luq.dev/json-schema) | reading a document in, writing one back out, measured Draft-07 conformance |
| [Standard Schema](https://luq.dev/standard-schema) | tRPC, TanStack Form, Hono, react-hook-form — and what does not cross that boundary |
| [Benchmarks](https://luq.dev/benchmarks) | bundle size and throughput, with the method |
| [Luq or zod?](https://luq.dev/luq-or-zod) | when schema-first is the better answer |

The guide is versioned with the code: `docs/` in the repository at any tag
describes that release. It is not part of the npm tarball — what ships is this
file, the compiled `dist/`, and `PLUGIN_MANIFEST` above.

## Status, and how this gets changed

The 2.x API is stable and gated, but the production track record is still short.
Breaking changes happen in a major and nowhere else, an API being removed is
deprecated one major ahead, and each major ships with the codemod needed to
cross it.

- **[CONTRIBUTING.md](https://github.com/maroonedog/luq/blob/master/CONTRIBUTING.md)** — `npm run verify` is the whole
  contract; the gates and what each one refuses
- **[SECURITY.md](https://github.com/maroonedog/luq/blob/master/SECURITY.md)** — reporting, zero runtime dependencies, the
  prototype-pollution and SSRF positions, and what is *not* protected against
- **[docs/RELEASING.md](https://github.com/maroonedog/luq/blob/master/docs/RELEASING.md)** — the release steps, the versioning
  policy, what each CI workflow watches, and what is still decided by hand

## About the "universal platform" goal

1.x described a `.luq` DSL that would generate validators for other languages,
against dated milestones. Those dates have passed and none of it shipped, so the
plan has been withdrawn rather than moved: no part of it is in this package, and
this release makes no claim about when any of it will exist. What is in the box
is the TypeScript validation library described above.

## License

MIT
