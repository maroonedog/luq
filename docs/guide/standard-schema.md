# Standard Schema

Luq implements [Standard Schema v1](https://standardschema.dev). Anything that
accepts a Standard Schema — tRPC, TanStack Form, Hono, t3-env, react-hook-form —
accepts a Luq validator wherever it accepts a zod schema.

It is a subpath, not part of `build()`. Carrying `~standard` on every validator
would charge every caller for a seam most of them never cross, so you import it
and pay for it when you use it.

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

const outcome = standard["~standard"].validate({ handle: "j" });

if (outcome.issues === undefined) {
  console.error(outcome.value.handle);
} else {
  for (const issue of outcome.issues) {
    console.error(issue.message, issue.path);
  }
}
```

`toStandardSchema` **adds** `~standard` and takes nothing away. What comes back
is still the validator, so `validate`, `parse`, `pick` and `pickAll` are all
still there for the rest of the application.

## Three decisions the spec leaves open

**`validate` calls Luq's `parse()`, not `validate()`.** The spec's success
result is `{ value: Output }`, and `Output` is the value *after* validation — so
a transform has to be applied, and only `parse()` applies it. This is also why a
[`normalize`](getting-started.md#normalize) reaches the consumer: the tidied
value is the one written back.

**It collects every issue rather than stopping at the first.** The library
default is `abortEarly: true`; this seam turns it off, because what consumes it
is usually a form, and returning one issue at a time produces a UI where fixing
an error reveals the next one. Callers who want the fast path use the validator
directly.

**`InferInput` is the type you wrote in `.for<T>()`,** not a type inferred back
out of a schema value.

## What does not cross the boundary

A Standard Schema issue carries `message` and `path`. Luq's own `code` and
`severity` have no field in the spec and do not survive, so a consumer that
switches on `issue.code` needs the validator rather than this face — and the
same value is the validator, so nothing has to be given up to get it.

## Writing JSON Schema out

`toStandardJsonSchema` is the same idea one step further: it attaches a
`~standard.jsonSchema` converter as well, so the value satisfies both
`StandardSchemaV1` and `StandardJSONSchemaV1`. The targets, what happens to a
rule that cannot be expressed, and the ordering it needs are in
[json-schema.md](json-schema.md#the-other-direction-writing-a-document-out).

## A worked example

[examples/react-hook-form](../../examples/react-hook-form) is a running form
driven this way. The integration is one line:

<!-- luq-example: skip — needs react and react-hook-form, which the doc harness's scratch consumer does not install -->

```ts
const { register, handleSubmit, formState } = useForm<Signup>({
  resolver: standardSchemaResolver(signupSchema),
});
```
