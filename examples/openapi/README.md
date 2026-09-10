# Validators generated from OpenAPI

One document, two generators, no hand-written constraint.

```bash
# Both dependencies are this checkout, so build them first.
( cd ../.. && npm run build )
( cd ../../openapi-ts-plugin && npm install && npm run build )

npm install
npm run verify     # generate, typecheck, run
```

## What is generated

`openapi.yaml` is the only place a constraint is written. `npm run generate`
turns it into two files, and neither is edited:

| File | Written by |
|---|---|
| `src/api.generated.ts` | `openapi-typescript` — the **types** |
| `src/order-validator.generated.ts` | `@maroonedog/openapi-ts-luq` — the **rules** |

The second refers to the first, so they cannot drift apart:

```ts
export const orderValidator = Builder()
  .use(requiredPlugin)
  .use(uuidPlugin)
  // …
  .for<components["schemas"]["Order"]>()
  .v("id", (b) => b.string.required().uuid())
  .v("customer.email", (b) => b.string.required().email())
  .v("lines", (b) => b.array.required().minLength(1))
  .v("lines[*].quantity", (b) => b.number.required().min(1))
  .build();
```

That is ordinary Luq. Nothing about it is a special "generated" mode, and you
can read it, diff it, and step through it like anything else in the codebase —
which is the reason to generate code rather than interpret the document at run
time. (`fromJsonSchema` does interpret it at run time, and is the right answer
when the document is only known then. See
[docs/guide/json-schema.md](../../docs/guide/json-schema.md).)

`src/main.ts` is the only hand-written file, and it names no constraint.

## What it prints

```
a document-shaped order: accepted
every constraint broken at once: rejected
  id: uuid — Value must be a valid UUID format
  customer.name: stringMin — String must have at least 2 characters, but got 1
  customer.email: stringEmail — Invalid email: invalid format
  lines: arrayMinLength — Array must have at least 1 elements, but got 0
a value of the wrong type: rejected
  lines[0].quantity: numberType — Value must be a number
```

The last one is worth a second look: no keyword asked for it. `quantity` is an
`integer` in the document, so the generator put the rule on `b.number`, and
entering that slot checks the type. A string there is reported even though the
only keyword on the field was `minimum: 1`.

## Nothing is dropped in silence

A keyword the generator cannot express is named — in the generated file's
header, and in the output of `npm run generate`:

```
every constraint in the document became a rule
```

`type`, `properties`, `items` and `required` are listed in the file but are not
omissions: they choose the slot and the shape of the declarations rather than
becoming rules of their own.

A validator that quietly checks less than the document says is worse than one
that admits it, so this is the number to read before trusting the output.

## When the spec changes

Regenerate, and run the compiler:

```bash
npm run generate
npm run typecheck
```

The generated rules follow the spec by construction — rename `customer` to
`buyer` upstream and the new `order-validator.generated.ts` declares
`buyer.email` without being asked. What breaks is **your** code that still
refers to the old field:

```
src/main.ts(27,3): error TS2353: Object literal may only specify known properties,
and 'customer' does not exist in type '{ id: string; buyer: { … }; … }'
```

So the guarantee is not "the rules cannot go stale" — they cannot, they are
regenerated. It is that a caller left behind by the spec is a compile error
rather than a validator that passes everything.

## The dependency on Luq

`package.json` installs both packages from this checkout: `@maroonedog/luq`
from the repository root and `@maroonedog/openapi-ts-luq` from
`../../openapi-ts-plugin`, neither of which is published yet. Each is imported
by package name, exactly as it would be from npm, so in your own project the two
`file:` specifiers become versions and nothing else about this example moves.
