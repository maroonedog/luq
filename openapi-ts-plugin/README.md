# @maroonedog/openapi-ts-luq

Turns a JSON Schema Draft-07 schema **object** into the **source** of a
TypeScript module that exports a Luq validator. An OpenAPI 3.0 component schema
is that shape, so a caller that has already parsed the document can hand one
straight in.

It writes source and returns it as a string. It does not read a file, parse
YAML, walk `paths` or `components`, or write anything to disk — the caller does
all of that. See [the worked example](#a-worked-example).

## Status

- **Not published.** `npm install @maroonedog/openapi-ts-luq` does not resolve.
  The only way to use it today is from this checkout, with a `file:` specifier —
  which is what [`examples/openapi`](../examples/openapi) does.
- **It is not a plugin for `@hey-api/openapi-ts`.** The name says otherwise;
  nothing in `src/` refers to that project, and there is no `defineConfig` or
  plugin handler here. The name is unfinished business, not a feature.
- **There is no CLI.** One exported function, called from your own script.
- It imports `@maroonedog/luq/schema-tooling` — the library's own schema
  flattener — so that the paths it writes and the paths the run-time converter
  produces come from the same code. `peerDependencies` therefore names
  `@maroonedog/luq` `>=2.4.0`: no earlier release carries that subpath. If the
  subpath ships under a different number, that range moves with it.

## The API

```ts
import { generateValidatorModule } from "@maroonedog/openapi-ts-luq";
import type { GenerateOptions, GeneratedModule } from "@maroonedog/openapi-ts-luq";

generateValidatorModule(schema: Draft07Schema, options: GenerateOptions): GeneratedModule;
```

`schema` is the Draft-07 document, already an object in memory.

### `GenerateOptions`

| Field | | What it is |
|---|---|---|
| `validatorName` | required | The name of the const to declare, e.g. `"orderValidator"`. |
| `typeExpression` | required | Emitted verbatim inside `.for<…>()`, e.g. `'components["schemas"]["Order"]'`. |
| `typeImport` | optional | One block of source emitted after `import { Builder }`. Omitted, the type named by `typeExpression` is assumed to be in scope already. |

### `GeneratedModule`

| Field | What it is |
|---|---|
| `source` | The whole module text: the header comment, the skipped-keyword notice, the imports, the builder chain, a trailing newline. |
| `pluginExports` | The plugin export names used, deduplicated and sorted. Every one of them is both imported and `.use()`d in `source`, and nothing else is. |
| `skipped` | `{ path, keyword, reason }` for every keyword that produced no rule. `path` is `""` for the root. |

`ChainCall`, `FieldChain` and `SkippedKeyword` are exported as types as well.

Two things are normalised, and both are pinned by tests: the keywords within one
field are walked in sorted key order, and the plugin imports are sorted by export
name. So the same schema object always produces the same source.

**Field order is not normalised.** It follows the document's `properties` order,
so writing the same two properties the other way round produces the same rules in
the other order. If you diff generated output across regenerations, reorder a
property upstream and the diff will show it.

## A worked example

[`examples/openapi`](../examples/openapi) is a running one — one
`openapi.yaml`, types from `openapi-typescript`, rules from this generator,
`npm run verify` to generate, typecheck and run it. Its README explains the
setup; the part that concerns this package is the call:

```js
const document = parse(readFileSync(SPEC, "utf8"));
const schema = document.components.schemas.Order;

const { source, skipped } = generateValidatorModule(schema, {
  validatorName: "orderValidator",
  typeExpression: 'components["schemas"]["Order"]',
});
```

The script picks the component out of the parsed document, prepends its own
`import type { components } from "./api.generated";` line, and writes `source`
to a file. What comes out is ordinary Luq:

```ts
export const orderValidator = Builder()
  .use(arrayMinLengthPlugin)
  .use(numberMinPlugin)
  // …
  .for<components["schemas"]["Order"]>()
  .v("id", (b) => b.string.required().uuid())
  .v("customer.email", (b) => b.string.required().email())
  .v("lines", (b) => b.array.required().minLength(1))
  .v("lines[*].quantity", (b) => b.number.required().min(1))
  .build();
```

## What a keyword becomes

| Keyword | Method | | Keyword | Method |
|---|---|---|---|---|
| `minLength` | `.min()` | | `maxItems` | `.maxLength()` |
| `maxLength` | `.max()` | | `uniqueItems: true` | `.unique()` |
| `pattern` | `.pattern()` | | `minProperties` | `.minProperties()` |
| `minimum` | `.min()` | | `maxProperties` | `.maxProperties()` |
| `maximum` | `.max()` | | `const` | `.literal()` |
| `multipleOf` | `.multipleOf()` | | `enum` | `.oneOf()` |
| `minItems` | `.minLength()` | | | |

`format` values that become a method: `email`, `uuid`, `uri` (`.url()`),
`hostname`, `ipv4`, `ipv6`, `date`, `date-time` (`.datetime()`), `time`,
`duration`, `json-pointer` (`.jsonPointer()`), `iri`. Every other `format` is
skipped by name.

`type` chooses the slot after `b.`: `string`, `number` (also for `integer`),
`boolean`, `array`, `object`. Anything else — no `type`, several types, `null`
alone — falls to `any`, which checks nothing.

Only the plugins actually used are imported, each from its own subpath
(`@maroonedog/luq/plugins/uuid`, never the barrel), so the generated module
pays for what it declares and nothing more.

## Nothing is dropped in silence

A keyword that cannot become a rule is returned in `skipped` **and** named in a
comment at the top of the generated file:

```
// Keywords in this schema that did not become rules:
//   id: type — selects the slot; it is not a method
//   customer: properties — expands into declarations for the child fields
//   lines: items — expands into the declaration for array elements
//   … one line per keyword; the real block for examples/openapi has twelve
```

Most entries are structural rather than omissions: `type` chooses the slot, and
`properties`, `items` and `required` become declarations rather than rules. The
ones worth reading are the rest — a keyword with **no chain method** is a
constraint the document states and the generated validator does not check.

Three different things share that list, and a reader has to separate them:

- **Structural** — `type`, `properties`, `items`, `required`, `$ref`. Nothing
  was lost; these decide the slot and the shape of the declarations instead of
  becoming rules of their own.
- **Deliberate** — annotations (`title`, `description`, `default`, `example`,
  `deprecated`, `readOnly`, `writeOnly`), and `uniqueItems: false`, which in
  Draft-07 is the absence of a constraint.
- **Unexpressed** — the reason reads `no chain method corresponds to it` or
  `no plugin corresponds to format "…"`. This is the set to read before
  trusting the output: the document says something the validator does not
  check.

`examples/openapi/scripts/generate.mjs` filters the first group out and prints
what is left, which is the shape to copy in your own script.

## What it does not handle

A validator that quietly checks less than the document says is the failure
worth naming, so here is everything known to be missing.

**Keywords that never become a rule.** `exclusiveMinimum`, `exclusiveMaximum`,
`oneOf`, `anyOf`, `not`, `if`/`then`/`else`, `contains`, `dependencies`,
`propertyNames`, `patternProperties`, `additionalProperties`,
`additionalItems`, `contentEncoding`, `contentMediaType`. Each is reported in
`skipped`; none is checked.

**`format` values outside the twelve above** — `byte`, `int64`,
`uri-reference`, `regex`, `idn-email` and the rest. Reported by name, not
checked.

**A child-level `allOf` is dropped whole.** Only an `allOf` at the root is
folded into the schema before flattening. On a nested schema, both its
constraints *and* the properties it contributes disappear: the field gets a
bare `b.any.optional()` and no declarations for the subtree. The keyword is
listed in `skipped`, but its reason text says "folded away during flattening",
which is true only at the root.

**Tuple `items: [A, B]`** produces the array rule and no element declarations.

**`nullable: true` produces no rule.** On a required field the emitted
`.required()` rejects `null`, so the generated validator is stricter than the
document.

**`$ref` resolves only inside the object you pass.** A component schema
containing `$ref: "#/components/schemas/Line"` makes the function **throw**,
because there is no `components` under the root it was given. Passing the whole
document as the root does resolve it, at the cost of a root-level declaration —
see below. `#/definitions/…` inside a self-contained schema works.

**A constraint on a slotless field emits a method that slot does not have.**
`{ "a": { "minLength": 2 } }` — no `type` — becomes
`.v("a", (b) => b.any.optional().min(2))`, and `min` is not on the `any` slot.
The same happens for `enum` anywhere but a `string`, `number` or `boolean`
field, and for any rule-bearing keyword at the **root** — an array-rooted
schema with `minItems`, for instance, or a whole OpenAPI document handed in as
the root — which becomes `.v("", (b) => b.any.…)`.

This fails loudly rather than silently: the method is not in the slot's type,
so the generated file does not compile.

```
error TS2339: Property 'min' does not exist on type 'FieldChain<…, "any", …>'
```

That is still a broken generation. Give the field a `type` in the document, or
write that rule by hand.

**A nested `required` is lowered only when every ancestor object is itself
required.** In Draft-07 a subschema applies only to a value that exists, so
`{ properties: { a: { required: ["b"] } } }` accepts `{}`. Emitting
`.required()` on `"a.b"` would reject it and disagree with the run-time
converter. When an ancestor is not required the generator emits `.optional()`
instead and reports the omission in `skipped` with that reason. An array in the
path does not break the chain: an absent array has no elements, so no element
rule runs.

## Generating, or converting at run time

This package writes source you commit and read. The library can also convert a
Draft-07 document at run time, with `fromJsonSchema` — that path handles the
whole of Draft-07 rather than the subset above, and is the right answer when
the document is only known at run time. See
[docs/guide/json-schema.md](../docs/guide/json-schema.md).

Generating is the right answer when the document is known now: the rules are
plain code you can diff and step through, and they are declared against the
generated type, so a spec change that renames a field breaks the compiler
instead of the validator.

## Working on it

```bash
npm install --ignore-scripts   # links @maroonedog/luq from the repository root
npm run verify                 # typecheck, build, dist gates, tests
```

`npm run build` emits `dist/` with the same shape as the library: `.js` is
CommonJS, `.mjs` is ESM, `.d.ts` beside them, one emitted module per source
module, nothing bundled. It reuses the root's own emit steps rather than
running a second build system.

The library must be built first (`npm run build` at the repository root),
because this package imports it by package specifier and resolves it through
its `dist`. CI runs both in that order.

`check:dist` runs the same two gates as the root package: no dynamic code in
anything shipped, and no private artefact or unresolvable **relative**
specifier in `dist`. It does not resolve bare ones, so the import of
`@maroonedog/luq/schema-tooling` that every emitted module carries is not its
business — that is covered by loading the built entries for real, which
`test/built-package.test.ts` does under both `require` and ESM.

The tests cover the generator, the keyword table against the library's, the
built CommonJS and ESM entries, and one end-to-end case that writes a generated
module to a temp directory, compiles it with `tsc --strict`, and runs it
against a good and a bad document.
