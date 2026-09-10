# Measured numbers

Every figure in this file was produced by running something on this repository,
and the file it came from is named next to it. Where a measurement is worse than
1.x — and some are — it is written down as worse.

The tables between `generated:` markers are written by
`npm run generate:perf-figures` out of `config/perf-baseline.json` and
`config/size-budget.json`, and `npm run check:perf-figures` fails the build when
they drift. The prose around them is written by a person.


## Bundle size

esbuild 0.25.5, `bundle + minify + esm + es2020 + platform:neutral + treeShaking`,
then `zlib.gzipSync` — the same options 1.x's own `bundle-size-comparison` used,
so the two columns are comparable. Recorded in
[config/size-budget.json](../config/size-budget.json) and re-measured by
`npm run check:size` on every build.

| Entry | gzip | 1.x, same method |
|---|---:|---:|
<!-- generated:bundle-size -->
| `Builder` only, zero plugins | **8,208 B** | 17,423 B |
| + 6 plugins (1.x's "simple" set) | **9,124 B** | 19,562 B |
| core + `jsonSchema`, the plugin alone | **21,145 B** | — |
| core + `jsonSchemaFullFeature` | **23,536 B** | — |
| all 77 plugins | **26,253 B** | — |
<!-- /generated:bundle-size -->

1.x published "tree-shakeable, 19–23KB gzipped". Measured the same way, its
core was 17.4 KB **before any plugin was imported** — 89.1% of its "simple"
figure. Here the core is <!-- generated:bundle-core-share -->31.3% of the all-plugins build (8,208 of 26,253 B)<!-- /generated:bundle-core-share -->,
and adding a plugin costs 129–224 B of gzip. Both figures are in the table above;
the difference is where the bytes sit, not which README is right.

Two lines that are **not** wins:

- The all-plugins figure is larger than the 23,015 B 1.x published for its
  `complex` case. The two are not comparable — 1.x's figure was one schema's
  plugin set, not its whole catalogue — so it is not counted either way here.
- The `jsonSchema` row measures the plugin **without a bag**, which is not a
  configuration you can validate with. Supplying one costs about what
  `jsonSchemaFullFeature` costs, so the tree-shakeable JSON Schema route saves
  nothing worth having today; use `jsonSchemaFullFeature` unless you need the
  chain method for one field.
- A third figure used to sit here — `jsonSchema` plus a working 49-plugin bag —
  and it is gone. **Which 49 was never written down**, so nobody could
  re-measure it. A number nobody can reproduce is worth less than no number.

## Speed

`npm run bench:record`, recorded verbatim in
[config/perf-baseline.json](../config/perf-baseline.json). Machine: AMD Ryzen 7
5825U, 16 logical cores, Node v23.11.0, Windows. Subject is `src/` transpiled by
ts-node, not the bundle. `abortEarly: true`, input accepted, so no rule is
skipped. Every subject rotates over a pool of at least four distinct values —
one frozen input let V8 delete a subject outright, which is the artefact
described below. Each figure is the median of the fastest half of 9 samples; the
spread quoted alongside is the full range over that figure, and on these ten it
is <!-- generated:perf-spread -->1.2–12.3%<!-- /generated:perf-spread -->.

| Shape | `validate` ops/sec | `parse` ops/sec |
|---|---:|---:|
<!-- generated:perf-throughput -->
| 1 field, 1 check | 5,581,199 | 5,593,550 |
| 3 fields, 6 plugins | 2,444,308 | 1,933,180 |
| nested, depth 2–3 | 1,722,770 | 1,701,094 |
| array of 50 elements | 90,590 | 90,013 |
| JSON Schema document | 312,630 | 309,502 |
<!-- /generated:perf-throughput -->

**This rewrite is slower than 1.x on flat and nested shapes.** Measured side by
side, in one process on one machine, 1.x source against this source, sample by
sample interleaved so a drift in the machine hits both halves of every ratio:

| Shape | 1.x | this | ratio |
|---|---:|---:|---:|
<!-- generated:perf-legacy -->
| 1 field | 26,568,111 | 5,463,953 | **×0.21** |
| 3 fields | 3,082,290 | 2,434,509 | **×0.79** |
| nested | 2,203,633 | 1,842,200 | **×0.83** |
| array of 50 | 19,610 | 84,707 | ×4.30 |
| JSON Schema | 146,283 | 306,778 | ×2.10 |
<!-- /generated:perf-legacy -->

1.x carried a directory of specialised fast paths that this implementation has
no equivalent of. The comparison was checked for the ways it could be wrong: 1.x
demonstrably rejects bad values on all five shapes, so it is not winning by
doing less work, and both halves are asserted to accept the accepted pool and
reject the rejected pool before either is timed.

Also worth stating plainly: **neither figure 1.x's README published reproduces
here.** It claimed 1.2M ops/sec simple and 43K complex; on this machine 1.x
itself does <!-- generated:perf-legacy-simple -->3.08M<!-- /generated:perf-legacy-simple -->
on the shape rebuilt from its own "simple" benchmark source, and "complex" has
no reproducible definition to measure.

`build()` costs 14–662 µs depending on shape, against sub-microsecond
`validate()` calls — so one `build()` pays for itself after 35–100 `validate()`
calls on four of the five shapes, and after 2 calls on the 50-element array
(where `validate()` itself costs ~33 µs).

CI does not gate on any absolute number. It gates on the ratio between Luq and a
hand-written validator measured in the same process, so the runner's speed
cancels out. Fifteen pairings are gated: five shapes × `validate` on accepted
input, `parse` on accepted input, and `validate` on rejected input — the
rejected path is a different program under `abortEarly` (early exit, issue
construction, path strings) and was previously not measured at all.

The gate's resolution is recorded rather than assumed. Slowing every shape's
validator by a fixed factor and re-running (`gateSensitivity` in
config/perf-baseline.json, one run per level): **+35% is caught** on 14 of the
15 pairings, +25% on 3, and **+15% is missed** on all 15. So the gate sees
roughly a third-slower regression and does not see a sixth-slower one.

The reference implementations are held to two conditions of their own, both
asserted before any timing. `bench/assert-reference-agreement.ts` requires the
hand-written reference and Luq to agree on every value in both pools, which is
what stops the denominator drifting into a cheaper check than the one Luq
performs — the email, UUID and date-time references were rewritten to the
plugins' own semantics after this was added, and the rejected pool carries one
value per known difference so reverting any of them fails the assertion.
`bench/measure-reference-work.ts` requires each reference to be slower than 0.95
of an empty loop over the same pool, which is how the deleted-subject artefact
is caught: when V8 removes the work the ratio sits at 1.00 or above, and the ten
figures recorded here span 0.01–0.86.

## CSP-safe

No `eval`, no `new Function`. Checked mechanically over all 762 emitted `.js`
and `.mjs` files by `npm run check:no-dynamic-code`, and over `src/` by the
public-API smoke test: **0 occurrences**.

The check is there because the claim is easy to make and easy to stop being true
— 1.x's README made it while `src/types/array-type-analysis.ts` still carried a
live `new Function`. This is the first release where a script enforces it on
every build rather than a sentence asserting it.

## Package

86 keys in `exports`, every one resolving to files that exist: 8 fixed keys
(`.`, `./package.json`, `./result`, `./plugin-kit`, `./field-rule`, `./async`,
`./plugins`, `./standard-schema`) and 78 under `./plugins/` — 77 plugins plus one
deprecated alias.
`npm pack --dry-run`: 1,197 files, 376.9 kB packed, 1.4 MB unpacked —
`LICENSE`, `README.md`, `package.json` and `dist/` (398 `.d.ts` + 398 `.js` +
398 `.mjs`), with nothing from `src/`, `test/`, `scripts/`, `bench/` or `docs/`,
no raw `.ts` and no source maps. A scratch consumer typechecks **every one of
the 86 keys** against the published declarations under **both** `node16` and
`bundler` resolution, and an unpublished subpath is proven to fail.

1.x's `createPluginRegistry` / `useField` / `createFieldRule` are published at
`@maroonedog/luq/field-rule`; `useField` is a free function now. See
[docs/migration/breaking-changes.md](migration/breaking-changes.md#15-createpluginregistry-usefield-and-createfieldrule-moved-to-maroonedogluqfield-rule).

