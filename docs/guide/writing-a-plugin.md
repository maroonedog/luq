# Writing a plugin

A plugin is a value. It has four members, it is created by one function, and it
imports one subpath:

```ts
import { definePlugin, check, PASS, fail } from "@maroonedog/luq/plugin-kit";
import type { Unchanged } from "@maroonedog/luq/plugin-kit";

export const evenPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: { readonly actual: number };
}>()({
  name: "even", //   the default error code
  method: "even", //  what you call in a chain: b.number.even()
  slots: ["number"] as const, // where the method appears
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        typeof value !== "number" || value % 2 === 0
          ? PASS
          : fail({ actual: value }),
      describe: (_detail, messageContext) =>
        `${messageContext.path} must be even`,
      buildMessageContext: (detail) => ({
        actual: typeof detail.actual === "number" ? detail.actual : 0,
      }),
    }),
});
```

```ts
import { Builder } from "@maroonedog/luq";
import { definePlugin, check, PASS, fail } from "@maroonedog/luq/plugin-kit";
import type { Unchanged } from "@maroonedog/luq/plugin-kit";

const evenPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: Record<string, never>;
}>()({
  name: "even",
  method: "even",
  slots: ["number"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        typeof value !== "number" || value % 2 === 0 ? PASS : fail({}),
      describe: (_detail, messageContext) => `${messageContext.path} must be even`,
      buildMessageContext: () => ({}),
    }),
});

type Basket = { count: number };

export const basketValidator = Builder()
  .use(evenPlugin)
  .for<Basket>()
  .v("count", (b) => b.number.even())
  .build();
```

Note the two halves of `definePlugin<Sig>()(spec)`. The signature is written
explicitly; the identity strings are inferred as literals from the spec. That
split is what lets `name`, `method` and `slots` stay literal types while `args`,
`out` and `context` stay yours to declare.

`/*#__PURE__*/` matters: it lets a bundler that ignores `sideEffects: false`
still drop a plugin nobody imported.

## The signature is the whole contract

```ts
interface PluginSignature {
  readonly args: readonly unknown[]; // what the chain method takes
  readonly out: unknown; //             what happens to the chain afterwards
  readonly context: object; //          what messageFactory receives
}
```

`args` and `out` are written with **markers** — brands that mean "resolve this
into the right thing at the call site, and into the right thing inside
`build()`". A marker is never a value you construct; it only ever appears in a
type position.

### The 11 argument markers

| Marker | The call site writes | `build()` receives |
|---|---|---|
| `FieldRef` | `FieldPath<TRoot>` — a checked path literal | `string` |
| `FieldRefs` | `readonly FieldPath<TRoot>[]` | `readonly string[]` |
| `RootPredicate` | `(root: TRoot, item?) => boolean` | `(root: unknown, item?) => boolean` |
| `RootReader<R>` | `(root: TRoot) => R` | `(root: unknown) => R` |
| `SelfReader<R>` | `(value: TValue) => R` | `(value: unknown) => R` |
| `SelfGuard` | `(value: TValue) => boolean` | `(value: unknown) => boolean` |
| `SelfValue` | `TValue` — the field's own type | `unknown` |
| `ElementChain` | `(b) => chain` over the array's **element** | `readonly Rule[]` |
| `NarrowedChain` | `(b) => chain` over the **narrowed** value | `readonly Rule[]` |
| `PropertyValueChain` | `(b) => chain` over any **property value** | `readonly Rule[]` |
| `PropertyKeyChain` | `(b) => chain` over the property **key** (a string) | `readonly Rule[]` |

Note the asymmetry, because it is the point: the caller writes typed things, and
`build()` receives erased things. A plugin cannot see `TRoot`, so it cannot
depend on it, so one plugin works for every type.

Markers nest. `readonly ElementChain[]` (a tuple's positions) and
`Readonly<Record<string, NarrowedChain>>` (a key set, as `patternProperties`
needs) both resolve, element by element and key by key.

A plugin whose arguments carry **no** marker can be driven from a JSON Schema
keyword, because its chain parameters equal its declared args verbatim. That is
checked structurally, not shallowly.

### The 4 output markers

| `out` | `build()` must return | The chain becomes |
|---|---|---|
| `Unchanged` | a `Rule` | unchanged |
| `TransformOut` | a `TransformRule` | the map's return type |
| `GuardOut` | a `Rule` | same type, one union member covered |
| `PresenceShift<K>` | a `PresenceRule` | narrowed by `K` |

`K` is one of `"excludeMissing"` (what `.required()` declares),
`"excludeUndefined"`, `"excludeNull"` (`.optional()`), or `"allowNull"`
(`.nullable()`).

**`out` constrains `build()`'s return type.** Declaring
`out: PresenceShift<"excludeMissing">` and returning a `check()` does not
compile. The type the chain carries afterwards and the runtime policy the field
gets are therefore the same declaration; they cannot drift apart.

**Two of the markers also REPLACE the chain method's signature**, so for those
two your `args` no longer describes what the caller writes
(`src/chain/chain-method.types.ts:28-38`):

| `out` | what the caller actually passes |
|---|---|
| `TransformOut` | `<R>(map: (value) => R, options?)` — one mapping function, whatever `args` says |
| `GuardOut` | `<X>(condition: (value) => value is X, define: b => chain, options?)` |

Declaring `out: TransformOut` with `args: readonly [prefix: string]` therefore
compiles as a plugin and then rejects every call site, because the marker has
already decided the parameters. Write the `args` the marker implies.

`GuardOut` additionally records the narrowed member in the chain's state
(`CoverWith`), which is why `.build()` does not exist on a `.union.guard(...)`
chain until every member of the union has been covered — the error you get is
`Property 'build' does not exist on type 'UnionGuardCoverageError<…>'`, and it
means a member is still uncovered rather than that `build` was misspelled.

<!-- luq-example: must-fail out と build() の戻り値が食い違うと落ちることの証明 -->
```ts
import { definePlugin, check, PASS } from "@maroonedog/luq/plugin-kit";
import type { PresenceShift } from "@maroonedog/luq/plugin-kit";

export const broken = definePlugin<{
  args: readonly [];
  out: PresenceShift<"excludeMissing">;
  context: Record<string, never>;
}>()({
  name: "broken",
  method: "broken",
  slots: ["string"] as const,
  // `out` demands a PresenceRule; this is a CheckRule.
  build: (ctx) =>
    check({
      code: ctx.code,
      severity: ctx.severity,
      run: () => PASS,
      describe: () => "",
      buildMessageContext: () => ({}),
    }),
});
```

## The rule constructors

`build()` returns exactly one rule, made by one of eight constructors from
`@maroonedog/luq/plugin-kit`:

| Constructor | Kind | Runs |
|---|---|---|
| `check` | a value test | after presence, in declaration order |
| `presence` | a presence policy | before every check |
| `gate` | should this field run at all | before every check; reports nothing |
| `transform` | rewrite the value | in `parse()` only, after all checks pass |
| `branch` / `composite` | label a rule list and combine sub-results | as one check |
| `fieldsBranch` | a rule list over named sibling fields | as one check |
| `recursive` | re-enter a plan on a nested structure | last |

`check`'s `run` returns `PASS` or `fail(detail)`. The detail is what
`describe()` and `buildMessageContext()` read, and it is the reason a predicate
runs **once**: the message travels with the outcome instead of being rebuilt by
a second call.

## Arguments, and rejecting bad ones

```ts
import {
  definePlugin,
  check,
  PluginArgumentError,
  PASS,
  fail,
  isString,
} from "@maroonedog/luq/plugin-kit";
import type { Unchanged } from "@maroonedog/luq/plugin-kit";

export interface PrefixContext {
  readonly prefix: string;
  readonly actual: string;
}

export const prefixPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [prefix: string];
  out: Unchanged;
  context: PrefixContext;
}>()({
  name: "prefix",
  method: "prefix",
  slots: ["string"] as const,
  build: (ctx, prefix) => {
    // A bad argument is a BUILD-time error, not a validation that never fires.
    if (prefix.length === 0) {
      throw new PluginArgumentError(ctx.pluginName, "prefix", prefix);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) =>
        !isString(value) || value.startsWith(prefix)
          ? PASS
          : fail({ expected: prefix, actual: value }),
      describe: (_detail, messageContext) =>
        `${messageContext.path} must start with ${prefix}`,
      buildMessageContext: (detail) => ({
        prefix,
        actual: isString(detail.actual) ? detail.actual : "",
      }),
    });
  },
});
```

Two conventions that are load-bearing:

- **A wrong-typed value passes.** `!isString(value) || ...` is not defensive
  clutter. The slot guard owns type and the presence rules own `null` and
  `undefined`, so a value rule that re-decides either produces a duplicate
  issue under the wrong code.
- **`ctx.code`, `ctx.messageFactory` and `ctx.severity` are already resolved**
  from the caller's `RuleOptions`, falling back to the plugin name and the
  builder's config. Read them; never re-resolve them. Two resolution sites is
  how an override stops working.

## `RuleBuildContext`

`build()`'s first parameter carries everything a plugin may know:

| Member | Is |
|---|---|
| `pluginName` | the plugin's own `name` |
| `code` | `options.code ?? pluginName` |
| `messageFactory` | `options.messageFactory`, typed with your `context` |
| `severity` | `options.severity ?? config.defaultSeverity` |
| `config` | the effective `GlobalConfig` for this builder |
| `fieldPath` | the path this rule is attached to |
| `declaredSiblingKeys` | the immediate child keys declared under it |

There is no process-wide singleton read at validation time. A builder's
`.withConfig()` reaches a plugin through `ctx.config` and nowhere else.

## Sub-chains

A plugin that takes a sub-chain declares **which argument positions** carry
one, because a `NarrowedChain` and a `RootPredicate` are both plain functions
once the types are erased:

```ts
import { definePlugin, branch, composite, PASS } from "@maroonedog/luq/plugin-kit";
import type { ElementChain, Unchanged } from "@maroonedog/luq/plugin-kit";

export const firstElementPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [element: ElementChain];
  out: Unchanged;
  context: Record<string, never>;
}>()({
  name: "firstElement",
  method: "firstElement",
  slots: ["array"] as const,
  // Position 0 holds a sub-chain: resolve it to Rule[] before build() runs.
  subChainArguments: [0],
  build: (ctx, element) =>
    composite({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      branches: [branch("first", element)],
      combine: (runners) => (value, runContext) =>
        Array.isArray(value) && value.length > 0
          ? (runners[0]?.run(value[0], runContext) ?? PASS)
          : PASS,
      describe: () => "first element is invalid",
      buildMessageContext: () => ({}),
    }),
});
```

The callback the user writes runs **once**, at `build()` time. Nothing in a
plugin should run per-`validate()` that could have run per-`build()`.

## Isolation

Plugins in this repository live in one of two tiers, enforced by
`npm run check:plugin-isolation`:

- **isolated** (`src/plugins/<kebab-name>/`) — may import `plugin-kit`, `types`,
  `path`, and its own directory. Nothing else. Not a sibling plugin, not the
  JSON Schema layer, not the builder.
- **extension** (`src/json-schema/extensions/<kebab-name>/`) — may additionally
  import the JSON Schema layer and other plugins' **entry files**.

That rule is why importing one plugin does not drag in the other 76, and it is
measured: a plugin costs 129–224 B of gzip to add.

A plugin published from your own package has the same shape and imports
`@maroonedog/luq/plugin-kit` instead of relative paths. Nothing about it is
privileged; the built-in 77 are written against exactly this surface.

## Naming rules inside this repository

- Directory `kebab-case`, public subpath `camelCase`, derived from each other
  and round-trip asserted at build time.
- `index.ts` re-exports only.
- One method name per slot across the whole catalogue —
  `npm run check:plugin-uniqueness` refuses a collision. `stringMin` and
  `numberMin` may both be `.min()` because their slots do not overlap.
