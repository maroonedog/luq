<div align="center">
  <img src="./public/img/library_image.png" alt="Luq Logo" width="300" />

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

The same documentation ships in `docs/` inside this repository, so the copy at
any tag describes that release.

## Status, and how this gets changed

The 2.x API is stable and gated, but the production track record is still short.
Breaking changes happen in a major and nowhere else, an API being removed is
deprecated one major ahead, and each major ships with the codemod needed to
cross it.

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
