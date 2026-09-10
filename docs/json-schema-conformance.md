# JSON Schema Draft-07 conformance (measured)

Every number in this file was produced by running something and counting. None
of it was written to reach a target. All of it is asserted **in both
directions** by `test/integration/json-schema-suite.test.ts` against
`config/json-schema-suite.json`: a regression and an unrecorded improvement
fail the build alike.

Counting is done by running `test/json-schema/report-skip-causes.ts`, never by
hand.

---

## 1. The headline number

The official
[JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite),
draft7, required tests only (`tests/draft7/optional/` is excluded).

**A skipped case counts as a FAILURE, not a pass.** The skip list is **empty**,
and that is structural rather than incidental: `SuiteSkipCause` is `never`, so
writing one skip means adding a name to a type first.

| | Cases |
|---|---|
| Total | 929 |
| Passing | **929** |
| Failing | **0** |
| Of those, on the skip list | 0 |
| Failing and not on the skip list | **0** |

### Against the trivial floor

The corpus expects 551 valid and 378 invalid, so **a validator that answers
true to everything scores 551 / 929 = 59.31%.** A conformance figure only means
something beside that floor.

| | Of the 551 that must be valid | Of the 378 that must be invalid | Total |
|---|---|---|---|
| A validator that only ever returns true | 551 (100%) | 0 (0%) | 551 (59.31%) |
| **This implementation** | **551 (100%)** | **378 (100%)** | **929 (100.00%)** |

## 2. The pinned corpus

| Item | Value |
|---|---|
| Directory | `tests/draft7` (`optional/` excluded) |
| Files | 37 |
| Groups | 258 |
| Cases | 929 |
| Corpus sha256 | `9b13470f746d823ec1644d4ece291973d27f52a09bc4c06580a1037bb2d82d47` |

Move the submodule and the sha256 changes, and the build fails until
`config/json-schema-suite.json` is measured again. That is what makes a change
in conformance a reviewed commit.

## 3. Which entry point was measured

There are **two** ways into JSON Schema, and the corpus is measured through the
chain method.

- `b.any.jsonSchemaFullFeature(document)` — the route measured. Nearly every
  schema in the corpus puts its constraints at the document **root**, and this
  is the only route that treats the root as the field itself, so it is the only
  one that can judge every case. It also judges cases whose instance is a
  scalar.
- `fromJsonSchema(document)` — the function entry point, which users write as
  `fromJsonSchema<T>(schema, config?)`. It returns
  `Validator<T extends object>`, so it is **for validating objects**.

Measured on the same subset — the 289 cases whose instance is a plain object:

| Entry point | Passing / 289 | Rate |
|---|---|---|
| `b.any.jsonSchemaFullFeature(document)` | 238 | 82.35% |
| `fromJsonSchema(document)` | 229 | 79.24% |

The 9-case difference is made up of cases the method route can judge and the
function route rejects at build time. The function route is nowhere near zero:
root keywords became declarable once `ROOT_PATH` was supported.

### The glue used to measure, stated rather than hidden

The harness `test/json-schema/build-suite-validator.ts` adds `.optional()` to
the target field when the document does not permit null. Null is decided before
any rule runs, so whether null is permitted can only be expressed as a presence
policy. The harness decides that with the same `permitsNull` the converter
uses, so it cannot drift from the converter.

Those are three lines a real caller has to write too, and they follow from a
plugin's `build()` returning one rule. See §7.

## 4. Failing cases: **none**

| How it failed | Cases |
|---|---|
| Building the validator threw, so no verdict was reached | **0** |
| Built, but judged wrongly | **0** |
| `validate()` threw at run time | **0** |

### The causes that have gone, recorded

No skip cause has ever been removed to move the rate. Each went when the thing
it was waiting for arrived. A cause's name is removed from `SuiteSkipCause` as
well, so bringing one back means adding a name to a type.

| Cause | Cases | What removed it |
|---|---|---|
| `external-ref` | 57 | `externalDocuments`: only documents the caller passed in. Nothing is fetched |
| `reserved-path-segment` | 14 | `__proto__` became declarable, written with `Object.defineProperty` |
| `ref-pointer-escaping` | 9 | RFC 6901's order: decode the whole fragment first |
| `tuple-items` | 6 | The single line below |
| `null-not-observable` | 5 | `nullIsValue`: inside a subschema, null is a value and not absence |
| `ref-identifier-scope` | 3 | A scope expressing that `$id` moves the base URI (`ref-scope.ts`) |
| `sibling-keyword-interaction` | 3 | `additionalProperties` looks at `patternProperties` |
| `code-point-string-length` | 2 | Lengths counted in code points |
| `ref-chain` | 2 | The single line below |
| `boolean-sub-schema` | 1 | The single line below |

Nine of those went with one line. `toSchemaBranch` called
`context.collectSubSchemaRules`, and that context had **already descended
through this `$ref`** — so the recursion guard against following one `$ref`
twice was stopping itself. The tell was that
`{"items":[{"$ref":"#/definitions/x"}]}` constrained nothing while
`{"items":[{"type":"integer"}]}` worked.

### How external `$ref` passes without touching the network

Those 57 cases serve their schemas over `http://localhost:1234/...` and expect
them to be fetched. This library takes a **map**, not a loader function:

```ts
b.any.jsonSchemaFullFeature(document, { externalDocuments })
```

Only documents the caller already holds are used in resolution, which makes
three things true at once: a URI written in a schema can never make the process
open a socket, conversion stays synchronous so `build()` returns no Promise,
and no `eval` or `new Function` appears, so the CSP guarantee is unchanged.
Fetching is the caller's job; in the suite harness the caller's fetching is a
file system (`test/json-schema/read-remote-documents.ts`).

### Recursive expansion has a limit (from measurement)

Mutually recursive `$ref`s describe infinitely many declared paths, so
expansion stops somewhere. Stopping after one round left tree → node → tree
checkable to only two levels. Raising the limit costs exponentially in the
number of mutually recursive definitions. With three of them:

| Expansions | Build time |
|---|---|
| 1 | 17 ms |
| 2 | 55 ms |
| 3 | 538 ms |
| 4 | 9257 ms |

The corpus needs three — `ref.json`'s tree puts an invalid value at the third
level — so three is the limit. It is paid once, at build time. An expansion
budget also caps the total number of `$ref` expansions per conversion, a depth
limit bounding only depth and leaving breadth to the document. The whole
official corpus fits inside that budget, so an ordinary document notices
nothing.

### The skip list

`test/json-schema/suite-skip-list.ts` is **empty**, and `SuiteSkipCause` is
`never`, so a `SuiteSkip` cannot be constructed at all. Restoring one skip
means adding a name to a type, which is a diff a reviewer reads.

The rule that **a skipped case is still executed** stays in place
(`findStaleSkips`). A skip asserts "this still fails"; it is not a place to
hide a regression.

## 5. Against the previous major, re-measured on the same corpus

The previous major, checked out into a `git worktree` and run against the
**same 929 cases**.

```
Builder().use(jsonSchemaFullFeaturePlugin).fromJsonSchema(schema).build()
```

| | Previous major | This implementation | Difference |
|---|---|---|---|
| Passing / 929 | **536 (57.70%)** | **929 (100.00%)** | +393 (+42.30pt) |
| Of the 551 that must be valid | 512 (92.92%) | **551 (100%)** | +39 |
| **Of the 378 that must be invalid** | **24 (6.35%)** | **378 (100%)** | **+354 (+93.65pt)** |
| Cases where building failed | 41 | 79 | |
| Cases judged wrongly | 352 | 22 | |

**The previous major's 57.70% is below the 59.31% of a validator that only ever
returns true.** It rejected 24 of 378 invalid documents, which is what "JSON
Schema support" amounted to. This implementation losing a little on the valid
side is because an external `$ref` is refused at build time rather than passed
through in silence.

Restricted to validating objects — the 289 cases whose instance is a plain
object — function entry point against function entry point:

| | Previous `fromJsonSchema` | This `fromJsonSchema` |
|---|---|---|
| Passing / 289 | 155 (53.63%) | **229 (79.24%)** |
| Build failures | 31 | 49 |

## 6. Vocabulary coverage (measured)

| | Total | bind | structural | Out of scope |
|---|---|---|---|---|
| Draft-07 keywords | 46 | 18 | 19 | 9, all annotation-only |
| format names | 20 | 20 | 0 | **0** |

- A test cross-checks that the 46 exactly match the `properties` keys of the
  draft-07 meta-schema.
- The 20 formats are Draft-07 §7.3's 17 plus `url`, `uuid` and `duration`,
  which the previous major published.
- **No format is out of scope any more.** Four of them — `idn-email`,
  `idn-hostname`, `uri-reference` and `regex` — once had no plugin and **threw
  at build time**, so 24 cases in the corpus could not even produce a
  validator. Adding and binding those four plugins moved the figure from 804 to
  828 (86.54% to 89.13%) on its own. Each plugin's header states **what it
  checks and what it does not** — `string-idn-hostname`, for instance, states
  that it checks neither the IDNA2008 derived property table nor the Bidi rule.
- Plugins named by a keyword binding: 35. Plugins bundled by
  `jsonSchemaFullFeature`: 49.

### Two ways to count plugins

Both are correct and they differ by one:

- **76 directories / subpaths**, which is what the bundle budget's "all 76
  plugins" means.
- **77 exported plugin objects**, `objectAdditionalProperties` exporting two.

`package.json#/exports` therefore has 84 keys: 7 fixed plus 77 under
`./plugins/` (the 76 subpaths and one deprecated alias). None of the 58
subpaths the previous major published has been lost, asserted in the types by
`test/type/public-surface/json-schema.type-test.ts` and at run time by
`test/integration/public-subpath-resolution.test.ts`.

## 7. Known limits

Nothing in this section costs a case in the corpus; the failing count is zero.
These are limits a real document can still meet.

- **A document's own presence policy has nowhere to be expressed.** A plugin's
  `build()` returns one root, so `.jsonSchemaFullFeature(doc)` cannot say
  whether the document permits null. The caller writes `.optional()`, as the
  harness does in §3.
- **Recursive `$ref` expands to a fixed depth.** Three levels, for the reason
  measured above. A document nesting deeper than that is not checked all the
  way down.
- **An external `$ref` resolves only against `externalDocuments`.** Nothing is
  fetched, deliberately; a caller who wants a remote schema fetches it and
  passes it in.

## 8. Reproducing this

```bash
git submodule update --init --recursive
npm ci
npx jest test/integration/json-schema-suite.test.ts
```

CI has to fetch the submodule (`submodules: true`). Without the corpus this
suite does **not** go green: one test fails explicitly saying the corpus is not
checked out. That is deliberate, so a number can never appear without something
having been measured.
