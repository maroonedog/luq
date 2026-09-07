# JSON Schema

Luq validates a Draft-07 document by **converting** it into the same field
declarations you would have written by hand. There is no second engine: the
plan a schema produces is the plan `.v()` produces, so everything on this page
composes with everything in the rest of the guide.

## Conformance, measured

**828 / 929 = 89.13%** of the official
[JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)
draft7 required tests. Skipped cases are counted as **failures**, and the skip
list is asserted to be exactly the failing set — so a case cannot be hidden to
raise the number. A validator that returned `true` unconditionally scores
59.31% on this corpus.

The per-keyword breakdown and all 101 failures are in
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

Measured with the same esbuild + gzip method as the README's size table:

| Entry | gzip |
|---|---:|
| `Builder` + `jsonSchemaPlugin`, no bag | 18,992 B |
| `Builder` + `jsonSchemaPlugin` + a working 49-plugin bag | 21,371 B |
| `Builder` + `jsonSchemaFullFeaturePlugin` | 21,383 B |

The first row is not a usable configuration — `.jsonSchema()` needs a bag. Once
you supply one, the "tree-shakeable" route is **12 bytes** smaller than the
bundled one. So: use `jsonSchemaFullFeature`, and reach for `./plugins/jsonSchema`
when you want the per-field chain method, not to save bytes. The two share one
implementation; `jsonSchemaFullFeaturePlugin.build` calls
`jsonSchemaPlugin.build`.

## What it does not do

- **`null` at a field the document forbids it on.** Absence is settled before
  any rule runs, so a converted `{"type":"string"}` cannot itself reject `null`.
  Nullability is the field's presence policy; the converter declares
  `.optional()` for every non-required property, which is what expresses it.
- **The 101 failing suite cases.** They are enumerated, each with a cause, in
  [../json-schema-conformance.md](../json-schema-conformance.md). Nothing is
  silently skipped: the skip list is compile-checked against the failing set in
  both directions, so a skipped case that starts passing fails the build too.

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
