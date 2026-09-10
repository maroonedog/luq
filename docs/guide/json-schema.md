# JSON Schema

Luq validates a Draft-07 document by **converting** it into the same field
declarations you would have written by hand. There is no second engine: the
plan a schema produces is the plan `.v()` produces, so everything on this page
composes with everything in the rest of the guide.

## Conformance, measured

**929 / 929 = 100.00%** of the official
[JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)
draft7 required tests. Skipped cases are counted as **failures**, and the skip
list is asserted to be exactly the failing set — so a case cannot be hidden to
raise the number. A validator that returned `true` unconditionally scores
59.31% on this corpus, which is the figure to read this one against.

The per-keyword breakdown, and what closed each cause that used to fail, are in
[../json-schema-conformance.md](../json-schema-conformance.md).

## One import: `jsonSchemaFullFeature`

```ts
import { fromJsonSchema } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

type Order = {
  id: string;
  customer: { email: string };
  lines: { sku: string; quantity: number }[];
};

export const orderValidator = fromJsonSchema<Order>({
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  definitions: {
    sku: { type: "string", pattern: "^SKU-" },
  },
  properties: {
    id: { type: "string", format: "uuid" },
    customer: {
      type: "object",
      properties: { email: { type: "string", format: "email" } },
      required: ["email"],
    },
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          sku: { $ref: "#/definitions/sku" },
          quantity: { type: "integer", minimum: 1 },
        },
        required: ["sku", "quantity"],
      },
    },
  },
  required: ["id", "customer", "lines"],
});
```

`fromJsonSchema<T>()` returns the same `Validator<T>` the builder returns:
`validate`, `parse`, `pick`, `pickAll`, results shaped the same way, issue paths
in the same `lines[0].sku` grammar. `T` defaults to `Record<string, unknown>` —
never `any` — and under the default no declared path is checked, which is the
escape hatch for a document you only know at run time.

```ts
import { fromJsonSchema } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";

// Rules loaded at run time, with no type to name.
export async function loadValidator(): Promise<
  ReturnType<typeof fromJsonSchema>
> {
  const response = await fetch("/api/validation-rules");
  const schema: unknown = await response.json();
  return fromJsonSchema(schema);
}
```

This works under a Content-Security-Policy that forbids `unsafe-eval`: the
conversion builds closures, never source text. `npm run check:no-dynamic-code`
proves there is no `eval` and no `new Function` in any of the 762 emitted
modules.

## One field: the `.jsonSchema()` chain method

`@maroonedog/luq/plugins/jsonSchema` adds a chain method so a **single declared
field** can be constrained by a document, and it takes the plugin bag
explicitly.

```ts
import { Builder } from "@maroonedog/luq";
import { jsonSchemaPlugin } from "@maroonedog/luq/plugins/jsonSchema";
import { jsonSchemaBag } from "@maroonedog/luq/plugins/jsonSchemaFullFeature";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";

type Envelope = { id: string; payload: Record<string, unknown> };

const PAYLOAD_SCHEMA = {
  type: "object",
  properties: { kind: { type: "string", minLength: 1 } },
  required: ["kind"],
  additionalProperties: false,
};

export const envelopeValidator = Builder()
  .use(requiredPlugin)
  .use(jsonSchemaPlugin)
  .for<Envelope>()
  .v("id", (b) => b.string.required())
  .v("payload", (b) => b.object.required().jsonSchema(PAYLOAD_SCHEMA, jsonSchemaBag))
  .build();
```

This method reaches keywords the document **root** cannot otherwise use.
`fromJsonSchema` declares rules per field, and the empty path is not a field, so
root-level `additionalProperties`, `anyOf`, `not`, `if`/`then`/`else`,
`minProperties` and `propertyNames` are reachable through this method and
through no other route.

### Which one to use

Both entries are measured on every build and live in one place — the size table
in [the README](../../README.md#bundle-size). Reading them: `jsonSchema` on its
own is not a usable configuration, because `.jsonSchema()` needs a bag of
plugins behind it, and once you supply one the "tree-shakeable" route saves
nothing worth having.

So: use `jsonSchemaFullFeature`, and reach for `./plugins/jsonSchema` when you
want the per-field chain method, not to save bytes. The two share one
implementation; `jsonSchemaFullFeaturePlugin.build` calls
`jsonSchemaPlugin.build`.

## The other direction: writing a document out

Everything above reads a document in. `toStandardJsonSchema` writes one out. It
takes a built validator and returns it with a `~standard.jsonSchema` converter
attached; what comes back is still a Standard Schema, so the same value goes on
working anywhere that takes one.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { optionalPlugin } from "@maroonedog/luq/plugins/optional";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
import { stringEmailPlugin } from "@maroonedog/luq/plugins/stringEmail";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";
import { toStandardJsonSchema } from "@maroonedog/luq/standard-schema";

type Account = { name: string; email: string; age?: number };

const account = toStandardJsonSchema(
  Builder()
    .use(requiredPlugin)
    .use(optionalPlugin)
    .use(stringMinPlugin)
    .use(stringEmailPlugin)
    .use(numberMinPlugin)
    .for<Account>()
    .v("name", (b) => b.string.required().min(2))
    .v("email", (b) => b.string.required().email())
    .v("age", (b) => b.number.optional().min(18))
    .build()
);

const document = account["~standard"].jsonSchema.input({
  target: "draft-2020-12",
});
```

`document` is then:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 2 },
    "email": { "type": "string", "format": "email" },
    "age": { "type": "number", "minimum": 18 }
  },
  "required": ["name", "email"]
}
```

Four things decide how it behaves.

**Two targets, and no guessing.** `draft-2020-12` and `draft-07`. Anything else
throws `UnsupportedJsonSchemaTargetError`. `openapi-3.0` descends from draft-04
and is a different lineage, so it is not admitted on a resemblance: writing
draft-07 silently when 2020-12 was asked for hands the caller a document they
will read under the wrong rules.

**`input` and `output` return the same schema.** The spec asks for the input
type and the output type separately, and for a validator carrying a transform
they genuinely differ — but a Luq declaration does not carry a transform's
*result* type, because a function's return value is unknowable without running
it. Inventing a second shape would be a lie, so a field declaring a transform
counts as unwritable instead.

**An unwritable declaration throws, by default.** What comes out gets used for
validation by whoever receives it, so a silently dropped `.custom()` produces a
schema that admits values it must not, with no trace of the omission — the
missing constraint is then discovered by the incident it causes. Emitting for
documentation or for a form layout rather than for validation is a legitimate
thing to want, and it is available by asking:

<!-- luq-example: skip — continues the block above, so `account` is not declared here -->

```ts
account["~standard"].jsonSchema.input({
  target: "draft-07",
  libraryOptions: { unrepresentable: "omit" },
});
```

The lax choice is never the default, and having made it stays visible in the
calling code.

**Import before you build.** The record of declared calls is made as the chain
is walked, and importing `@maroonedog/luq/standard-schema` is what asks the
chain to keep one — it does not on its own, so that nothing is charged to
callers who never emit. A `build()` that runs before the import therefore
produces no record, and `DeclarationsUnavailableError` says so, naming both
causes.

## What it does not do

- **`null` at a field the document forbids it on.** Absence is settled before
  any rule runs, so a converted `{"type":"string"}` cannot itself reject `null`.
  Nullability is the field's presence policy; the converter declares
  `.optional()` for every non-required property, which is what expresses it.
- **`optional/` in the suite.** The measured corpus is the required tests; the
  optional directory is excluded, and what that leaves out is named in
  [../json-schema-conformance.md](../json-schema-conformance.md). Nothing is
  silently skipped inside the measured set: the skip list is compile-checked
  against the failing set in both directions, so a skipped case that starts
  passing fails the build too.

## What 1.x got wrong here

1.x's `fromJsonSchema` integration suite failed 32 of its 42 cases. The recorded
symptoms were `format: date` accepting `"2024-13-01"`, `format: ipv4` accepting
`"999.999.999.999"`, `minItems` evaporating, and every sub-schema inside an
applicator being ignored. Each of those is asserted, by name, in
`test/integration/json-schema-conversion.test.ts`.

1.x also let both JSON Schema bundles claim the method name `fromJsonSchema` and
relied on registration order to pick a winner. They are two distinct methods
now, `.jsonSchema()` and `.jsonSchemaFullFeature()`, and one builder may hold
both.
