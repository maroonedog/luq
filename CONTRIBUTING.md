# Contributing

This document exists so that someone who is not the author can change this
repository. Right now nobody else has, and that is the problem it is meant to
solve — not by asking for contributions, but by making the shape of the work
legible.

## The short version

```bash
npm ci
npm run verify        # everything CI runs, in one command, about 5 minutes
```

If `npm run verify` is green, your change is mergeable as far as this repository
is concerned. If it is red, the failure message names the gate and what it wants;
none of them are advisory.

## What the gates are, and why there are so many

Most of this repository's rules are enforced by a script rather than by review.
That is deliberate: the previous major version made claims in its README that
nothing checked — "tree-shakeable, 19–23KB gzipped" measured a core that cost
17.4 KB before you imported anything, "no eval" was written while a live
`new Function` shipped, and the quick-start example did not compile. Every gate
below exists because something like that got through.

| Gate | What it refuses |
|---|---|
| `npm run typecheck` | `any`, and the 191 negatives pinned by `@ts-expect-error` in `test/type/` |
| `npm run test:types` | a type test that stopped failing (TypeScript reports an unused directive) |
| `npm run lint` | abstract names (`common`, `data`, `manager`, …), among others |
| `npm run lint:filenames` | a filename that does not match its export |
| `npm run check:contract-arity` | a change to the plugin-author contract without updating its lock |
| `npm run check:module-has-test` | a module no runtime test reaches |
| `npm run check:catalog` | a plugin whose subpath, barrel entry or exports key is missing |
| `npm run check:docs` | a documented example that no longer compiles |
| `npm run check:size` | a bundle over its recorded ceiling |
| `npm run check:no-dynamic-code` | `eval` or `new Function` in the published artifact |
| `npm test` | 2,594 tests, including 929/929 JSON Schema Draft-07 conformance |

A file over 200 lines and a module without a test are both failures. So is a
plugin that appears in the catalogue without appearing in `package.json#exports`.

## House rules that a linter cannot check

**One file, one responsibility, 200 lines.** The limit is enforced; the
responsibility is not, and it is the one that matters. When a file needs to be
split, split it along what it is *for*, not at line 200.

**Names are specific.** `everydayRules`, not `common`. `collectBundleFields`,
not `processData`. The lint rule catches the worst offenders; the rest is on you.

**No type assertions.** `src/core/type-erasure.ts` is the only file permitted to
write one, and every function in it carries a comment saying why. A test
enforces the exclusivity. If you need an assertion somewhere else, the design is
usually wrong.

**Comments say why, not what.** The code says what. A comment that survives
review explains a decision, names a measurement, or records a defect that the
code now prevents. Several files in `src/` open with the bug that made them
necessary; that is the register to aim for.

**Measure before claiming.** Any number that reaches the README or the docs site
comes from a file in `config/` that a script re-measures. If you want to say
something is faster or smaller, add the measurement first. Three separate times
a hand-copied figure in this repository went stale without anything noticing;
that is why the numbers are generated now.

## Adding a plugin

A plugin is a directory under `src/plugins/`, and adding one touches more than
that directory on purpose:

1. `src/plugins/<kebab-name>/<kebab-name>.ts` and an `index.ts` beside it
2. `npm run generate` — regenerates the manifest, the barrel, `package.json#exports` and the catalogue lock
3. a runtime test under `test/unit/plugins/`
4. a type test under `test/type/plugins/` if the plugin's chain method has a shape worth pinning
5. an entry in `docs-site/scripts/plugin-copy.mjs` — the site typechecks the example you write there

`npm run verify` will tell you which of these you forgot.

## Commit messages

Written in Japanese in this repository, and long. A commit message here explains
what changed and *why that was the right change*, including the measurement if
there was one and the alternative if one was rejected. `git log` is the design
record; `docs/design/` holds the decisions that outlived a single commit.

## Releasing

See [`docs/RELEASING.md`](docs/RELEASING.md).

## What is not settled

Nothing about the plugin-author contract is frozen for third parties yet. If you
are building a plugin outside this repository, say so in an issue — the contract
is stable enough to use and not yet stable enough to promise.
