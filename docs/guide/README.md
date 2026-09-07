# Luq guide

Start at the top; each page assumes the one before it.

| Page | Covers |
|---|---|
| [Getting started](getting-started.md) | the builder, what `build()` returns, reading a result, `validate` vs `parse`, options, defaults, `strict()`, messages |
| [Field paths](field-paths.md) | the path grammar, issue paths, what a path may not be, the depth budget, slots |
| [Presence and conditionals](presence-and-conditionals.md) | rule order, `required` / `optional` / `nullable`, `requiredIf` / `optionalIf`, gates, `orFail`, cross-field rules, `custom` |
| [JSON Schema](json-schema.md) | `fromJsonSchema`, the per-field chain method, measured conformance, what is not supported |
| [Writing a plugin](writing-a-plugin.md) | `definePlugin`, the 11 argument markers and 4 output markers, rule constructors, isolation |
| [Plugin reference](plugin-reference.md) | generated table of every subpath, symbol, method and slot |

Elsewhere:

- [Breaking changes from 1.x](../migration/breaking-changes.md)
- [Plugin catalogue migration notes](../migration/plugins.md)
- [Draft-07 conformance, measured](../json-schema-conformance.md)
- [README](../../README.md) — bundle size, speed and CSP figures, all measured

## About the code in these pages

Every fenced `ts` block in this directory, in `docs/migration/` and in the
README is extracted by `scripts/check-doc-examples.ts`, written into a scratch
package whose `node_modules` resolves `@maroonedog/luq` to the **built**
package, and typechecked with `moduleResolution: node16` — which is the
resolver that actually enforces the `exports` map. A block that stops compiling
fails `npm run verify`.

A block preceded by `<!-- luq-example: must-fail ... -->` asserts the opposite:
it is required **not** to compile, and the build fails if it ever does. That is
how the 1.x snippets in the migration guide stay true.

This exists because 1.x's README quick start was broken in three places at once
— it called `build()`'s return value as a function, read a `result.issues`
member the implementation did not have, and imported a subpath that was in no
exports map. All three are the kind of mistake a compiler catches instantly and
a reader does not.
