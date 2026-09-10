# Plugins and presets

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

The complete table — subpath, symbol, chain method, slots — is generated from
the built package: [plugin-reference.md](plugin-reference.md). It carries the
counts, so they are not repeated here.

A convenience barrel exists at `@maroonedog/luq/plugins`. It is measurably free
where a bundler can tree-shake — `npm run check:barrel-equivalence` fails the
build if importing three plugins through the barrel diverges from importing the
same three by subpath by more than the recorded tolerance — but the per-plugin
subpaths are the supported route.

## Presets, for when the list gets long

Writing `.use()` thirteen times before the first field is a real cost of the
design above, so the common bundles are named. `.useAll(bundle)` registers every
plugin in one.

```ts
import { Builder } from "@maroonedog/luq";
import { everydayRules } from "@maroonedog/luq/presets";

type Order = { id: string; quantity: number };

const orderValidator = Builder()
  .useAll(everydayRules)
  .for<Order>()
  .v("id", (b) => b.string.required().min(3))
  .v("quantity", (b) => b.number.required().integer().min(1))
  .build();
```

| Preset | What is in it |
|---|---|
| `presence` | `required` / `optional` / `nullable` |
| `strings` | presence plus `min` / `max` / `pattern` / `email` |
| `numbers` | presence plus `min` / `max` / `integer` |
| `arrays` | presence plus `minLength` / `maxLength` / `each` |
| `everydayRules` | all four |

A preset is an ordinary object of plugins, so `.useAll()` and `.use()` mix, and
you can spread one to make your own. Registration is **first-wins**: a plugin
already registered is not silently replaced by a preset that also carries it,
whichever order they arrive in.

```ts
import { Builder } from "@maroonedog/luq";
import { presence, strings } from "@maroonedog/luq/presets";
import { stringUrlPlugin } from "@maroonedog/luq/plugins/stringUrl";

type Link = { href: string };

const linkValidator = Builder()
  .useAll({ ...presence, ...strings })
  .use(stringUrlPlugin)
  .for<Link>()
  .v("href", (b) => b.string.required().url())
  .build();
```

The bytes are still only what you reach: a preset costs the plugins it carries
and nothing more. `presence` and `everydayRules` each have their own entry in
the size budget and are re-measured on every build, because a convenience that
quietly costs a kilobyte is not a convenience. The figures are in
[../measurements.md](../measurements.md) and
[../../config/size-budget.json](../../config/size-budget.json); they are not
repeated here, so that they cannot drift here.
