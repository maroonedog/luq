# Adopt validation around an existing type

Start with one input boundary and the type its application already uses.
Keep that type in its current module; import it into the validator. A partial
declaration checks only the paths you name. Use `.strict()` when every leaf
must have a declaration, remembering that it checks declaration coverage,
not whether every business constraint has been written.

## Make the first boundary explicit

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";

type Order = { quantity: number };

export const orderValidator = Builder()
  .use(requiredPlugin)
  .use(numberMinPlugin)
  .for<Order>()
  .v("quantity", (b) => b.number.required().min(1))
  .strict()
  .build();

orderValidator.validate({ quantity: 2 }); // valid
orderValidator.validate({ quantity: 0 }); // numberMin issue
```

Before expanding coverage, exercise accepted input, rejected input, and the
application's error display. The [form example](../../examples/react-hook-form/README.md)
connects an existing type to react-hook-form through Standard Schema. Confirm
normalization and submitted output as well as displayed errors.

## Exercise a type change

If the upstream quantity becomes a string, the unchanged numeric rule must
stop compiling. This example is checked as a compile failure by the docs gate:

<!-- luq-example: must-fail a changed upstream field rejects its old numeric slot -->
```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";

type Order = { quantity: string };

export const orderValidator = Builder()
  .use(requiredPlugin)
  .use(numberMinPlugin)
  .for<Order>()
  .v("quantity", (b) => b.number.required().min(1))
  .strict()
  .build();
```

Decide what the new string means before replacing its rule. The compiler
detects an incompatible slot; it cannot infer business meaning, discover a
missing constraint, or notice a semantic change that leaves the type unchanged.

## Bound the pilot

Record the setup work, rejected-input behavior, type-change diagnostics, and
maintenance needed in one existing project. The repository examples show
integration mechanics; they are not a production adoption study.

For type-changing transforms, declare rules directly with `.v()` to retain
`parse()` output inference; `useField()` currently erases that information.
For schema conversion, read the [JSON Schema limits](json-schema.md) first.
Generated validators need an explicit decision on every skipped constraint,
and successful compilation alone does not establish schema equivalence.
