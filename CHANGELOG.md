# Changelog

Every released version of `@maroonedog/luq`, newest first.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Entries say what a caller sees change. Which file moved is in the commit; it is
not in here.

**This file is not published to npm.** `files` in `package.json` is `["dist"]`,
and npm adds only `README.md`, `LICENSE` and `package.json` to that — a
`CHANGELOG.md` at the root reaches a git checkout and the GitHub page and
nothing else. Adding it to `files` was considered and rejected: it would put a
document that only grows into every install, to answer a question nobody asks
from inside `node_modules`. The npm page renders this file from the repository,
`npm view @maroonedog/luq versions` gives the same list without a download, and
the size budget in `config/size-budget.json` is measured against what ships.

The link in `README.md` is therefore absolute: a relative one would be dead in
`node_modules`, and `npm run check:readme-links` refuses it for that reason.

## A note on version numbers

**There has never been a 1.x.** No `1.0.0`, no `1.x.y`, on npm or in git. The
published history is `0.1.0-alpha` through `0.1.2-alpha`, and then `2.0.0`.

Much of this repository's documentation calls that first line "1.x" — the
migration guide, the guide pages, several pages on luq.dev. It is the wrong
name, and it is wrong in the direction that costs a reader time: someone who
reads "breaking changes from 1.x" and goes looking for `@maroonedog/luq@1` finds
nothing on npm and has no way to tell whether they are looking at the right
package. Where this file needs to name that line it calls it **0.1.x**, which is
what `npm view @maroonedog/luq versions` returns.

The `alpha` dist-tag still points at `0.1.2-alpha`. It is the only tag other
than `latest`.

## [Unreleased]

Nothing yet.

## [2.7.0] — 2026-09-13

### Added

- **`ValidationIssue.causes`** — why a composite failed. `allOf`, `anyOf` and
  `oneOf` report which applicator failed and cannot say why; the branch failures
  behind it now travel with the issue, each a full issue with its own code, so
  `allOf` reads down to the `stringMin` underneath it. They were already being
  collected and then dropped, because `ValidationIssue` carried no such member.

  The key is **absent** on an ordinary issue rather than present and undefined,
  so `"causes" in issue` is a question worth asking. A new exported member is
  why this is a minor rather than a patch.

### Fixed

- **`{"type": "integer"}` reports one failure, not two.** It produced TWO issues
  at the same path, both coded `type`, for one value: the type table's own
  predicate is `Number.isInteger`, and a second rule was built from the
  numberInteger plugin with its code overridden to `type`. `(path, code)` is the
  pair a machine consumer groups and de-duplicates on, so one of the two
  disappeared without trace.

  **If you group issues by `(path, code)`, this changes what you see** — one
  entry where there were two. No verdict changes: the duplicate rule never
  decided anything the type check had not already decided, and the conformance
  corpus is unchanged at 929 / 929.

- Which presence rule a failure is attributed to no longer depends on how the
  codes are spelled. The tie between two rules forbidding the same number of
  things was broken on the lexicographically smaller `code`, so renaming a
  published code moved the attribution.

### Documentation

- **What a throwing transform does.** Only `parse()` runs transforms, so only
  `parse()` can throw one; `validate()` returns `valid: true` with the value
  untouched. Nothing about the behaviour changes — zod, valibot and yup all let
  the exception out of their own parse, and all three offer a separate API for
  rejecting a value. Luq's is `custom`, which catches a throw from its predicate
  and reports it as an issue. The asymmetry is the part that bites and it was
  written down nowhere.

- **The site is 3,800 words shorter, on every page.** The same claim was argued
  on three pages, methodology was defended to readers who had not questioned it,
  and conceded points were conceded twice. Each claim now has one home and the
  other pages link to it. Nothing measured was lost; the figures that went were
  hand-typed duplicates that had already drifted from the generated values they
  copied, and they are replaced by links to the derived figure rather than by a
  retyped number.

### Repository

- **The benchmarks page no longer carries a "many validators at once" section.**
  The first CI recording landed and did not resolve the thing it was built to
  resolve: the one-validator baseline every other point is divided by had a
  33 per cent spread across its seven runs, the same size as the effect. The
  record's own `resolution` field reads 2.4 per cent, but that is the gap
  between two point estimates each carrying that spread, so it understates the
  uncertainty rather than bounding it. Publishing a figure from that run would
  have repeated, with a different number, the mistake that made the quoted
  "11% across 40 validators" worth withdrawing.

  A reader also has no second library to compare against; no comparable project
  publishes this. What the page says instead is the part a reader can act on:
  every figure on it was taken with one validator alive, so it is the
  one-validator case rather than a per-call cost in an application.

  The harness, the recorder and the record stay. `docs/measurements.md` carries
  what the run showed, what it could not support, and what more repeats would
  take.

## [2.6.0] — 2026-09-13

### Fixed

- **Every error `fromJsonSchema` throws is catchable by class again.**
  `@maroonedog/luq/plugins/jsonSchemaFullFeature` — the subpath that offers
  `fromJsonSchema`, and the one the documentation points at — exported no error
  class at all. 2.5.0 made twelve malformed keyword values throw and shipped
  nothing to catch them with, so the only way to tell one failure from another
  was to parse the message. `MalformedSchemaError`, `NotASchemaError`,
  `RefResolutionError`, `UnsupportedKeywordError` and `UnsupportedDialectError`
  are all exported from it now.

  The sibling subpath `@maroonedog/luq/plugins/jsonSchema` had them the whole
  time, which is why reading the source did not reveal it. The test that pins it
  imports through the public subpath for the same reason.

### Changed

- **A document declaring a newer dialect is refused instead of reinterpreted.**
  `fromJsonSchema`, `.jsonSchema()` and `.jsonSchemaFullFeature()` read the root
  `$schema` and throw `UnsupportedDialectError` when it names anything but
  Draft-07. Before, `$schema` was ignored and the document was read under
  Draft-07's rules whatever it declared — which silently dropped any keyword
  written beside a `$ref`, because Draft-07 §8.3 replaces the node and 2019-09
  onward applies the siblings. `{"$ref": "#/$defs/name", "minLength": 5}` under a
  2020-12 `$schema` built a validator that accepted `{"nick": "ab"}`.

  **Unaffected:** a document with no `$schema`, which is most of them, and all
  929 cases of the conformance corpus.

  **If your document declares a newer dialect and was building correctly**, you
  have three options: convert it to Draft-07, delete the `$schema` line, or pass
  `{ assumeDraft07: true }` to take the Draft-07 reading deliberately —
  `JsonSchemaOptions` carries it beside `externalDocuments`, and `fromJsonSchema`
  takes it as a new trailing options argument. Only the **root** `$schema` of the
  document you hand in is read; a document supplied through `externalDocuments`
  and reached by `$ref` is not checked.

  Also newly refused **by name**, having previously been ignored in silence:
  `$vocabulary`, `$dynamicAnchor` and `$recursiveAnchor`.

- **Which presence rule a failure is reported under no longer depends on how the
  codes are spelled.** When two presence rules forbid the same number of things,
  the tie used to be broken on the lexicographically smaller `code`, so renaming
  a published code moved which rule a failure was attributed to. The tie is now
  broken on **what** each rule forbids — undefined, then null, then the empty
  string — and two rules forbidding the identical three things leave the
  first-declared standing. `.optional().nullable()` and `.nullable().optional()`
  still produce the identical policy, which was the property the old tie-break
  existed to protect.

### Added

- **`UnsupportedDialectError`**, a second newly exported class, with `declared`,
  `implemented` and `reason` on it. It is deliberately not a subclass of the
  other two: "Luq cannot honour this keyword", "this document is not valid
  Draft-07" and "this document is not Draft-07 at all" are three different facts,
  and a caller catching one must not silently catch another. Exported from
  `@maroonedog/luq/plugins/jsonSchema` and
  `@maroonedog/luq/plugins/jsonSchemaFullFeature` alongside
  `DRAFT07_DIALECT_URI`, `NON_DRAFT07_DIALECTS` and the `DialectOptions` type.

A newly exported class and a refusal that did not exist before make the next
release a minor.

### Size

Gzipped, against 2.5.0: `jsonschema-plugin` +910&nbsp;B, `jsonschema-full-feature`
+867&nbsp;B, `full-feature` +924&nbsp;B — of which the dialect guard is
+838&nbsp;/&nbsp;+808&nbsp;/&nbsp;+871&nbsp;B and about 245&nbsp;B of that is the
table of written reasons, one sentence per dialect saying what it does
differently. Measured by replacing the sentences with bare names and re-running,
and kept: the sentence is what tells a reader holding a 2020-12 document why a
constraint they wrote was disappearing, and the error is the only place they
will be looking. The six configurations that take no JSON Schema plugin move
+58&nbsp;to&nbsp;+65&nbsp;B, from the two core changes above, and none of their
ceilings moved.

### Repository

- **The issue-code vocabulary is now pinned.** `config/issue-code.lock.json`
  enumerates every code the library can put on a `ValidationIssue`, with who
  reports each one, plus the two codes a gate accepts but no issue can carry. It
  is derived from the source by `npm run generate:issue-codes` and gated by
  `npm run check:issue-code-lock`, which reports an addition and a removal as
  separate events and calls the removal breaking. Before this, a plugin could
  rename its code and every test in the repository still passed. The six slot
  type-guard codes — `stringType`, `numberType`, `booleanType`, `dateType`,
  `arrayType`, `objectType` — are spelled out in the source instead of being
  interpolated from the slot name, so they can be enumerated at all; the strings
  and the behaviour are unchanged.
- **Where `tsc` runs out of stack is written down.** A builder carrying
  several hundred `.v()` calls in one expression does not produce a diagnostic:
  the compiler throws `RangeError: Maximum call stack size exceeded`, prints a
  JavaScript stack from inside `typescript/lib/_tsc.js` and dies, and an
  editor's language server simply stops answering. Measured against the
  published declaration files on TypeScript 5.8.3, 530 chained calls compile and
  531 crash — an order of magnitude rather than a constant. The troubleshooting
  page carries the number and the fix, which is to split the declarations across
  several builders over the same type; 1,200 fields in four builders of 300
  compile with room to spare.
- **How throughput moves with many validators alive is now measurable, and is
  still not measured.** `bench/megamorphism/` compares one validator against 2,
  5, 10, 20 and 40 different ones, each window in its own child process, with a
  second lane that grows one validator's value pool instead so the working-set
  cost can be subtracted. `config/megamorphism-baseline.json` holds no figures
  and the site derives "not measured yet" from its empty `lanes` array. Nothing
  is published from a developer machine: the effect is a property of V8's inline
  caches and moves with the CPU, the core count and the Node version, so the
  recorder is CI's runner.

## [2.5.0] — 2026-09-12

### Changed

- **`fromJsonSchema` refuses a document the Draft-07 meta-schema forbids.** It
  previously accepted twelve malformed keyword _values_ and built a validator
  that enforced **less than the document stated**, with no signal at all. Each
  of these was confirmed by running it:

  | document                                  | what you got before                                                                                    |
  | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
  | `{"type":"strig"}`                        | the unknown name was filtered out, so the type check vanished **and** the field began accepting `null` |
  | `{"pattern":{"source":"^SKU-"}}`          | compiled to `/[object Object]/` — every value passed, including `"junk"`                               |
  | `{"additionalProperties":"false"}`        | the closed-object guarantee gone; `{isAdmin: true}` accepted                                           |
  | `{"required":"email"}` on a nested object | built, then threw a raw `TypeError` **inside `validate()`**                                            |
  | `{"patternProperties":{"^a":"x"}}`        | built; every key accepted                                                                              |
  | `{"propertyNames":5}`                     | built; every name accepted                                                                             |
  | `{"dependencies":{"a":5}}`                | built; the dependency unenforced                                                                       |
  | `{"items":5}`, `{"additionalItems":5}`    | built; every element accepted                                                                          |
  | `{"uniqueItems":"true"}`                  | duplicates accepted                                                                                    |
  | `{"contains":5}`                          | collapsed to "the array is not empty"                                                                  |
  | `{"minContains":2}`                       | enforced as 1, and `minContains: 0` **rejected** a document-valid instance                             |

  A malformed value is now a refusal at conversion time rather than a quiet
  weakening at validation time.

  **Nothing conforming changes.** Every newly refused document is one the
  Draft-07 meta-schema already rejects. The official corpus is unchanged at
  **929 / 929**, skip list empty.

- **A mutated `enum` no longer changes an already-built validator.** The
  `one-of` path closed over the caller's array below eight members and
  snapshotted it above, so `schema.properties.plan.enum.push("enterprise")`
  after `build()` silently changed what an existing validator accepted — at a
  threshold the caller could not see. Both paths copy now.

### Added

- **`MalformedSchemaError`**, a newly exported class. It carries the keyword,
  the requirement stated positively, and a safely rendered excerpt of the value
  that broke it:

  ```
  JSON Schema keyword "dependencies" has a value the Draft-07 meta-schema does not
  allow: the dependency under "a" must be an object or a boolean, or an array of
  property names. Received: 5.
  ```

- `minContains` and `maxContains` join their 2019-09 siblings as **named**
  refusals rather than silent misreadings.

One newly exported class and a set of refusals that did not exist before are why
this is a minor rather than a patch.

### Size

Gzipped, against the branch point: `jsonschema-plugin` +801&nbsp;B (+3.75%),
`jsonschema-full-feature` +909&nbsp;B (+3.83%), `full-feature` +906&nbsp;B
(+3.43%). **Zero** on the six configurations that take no JSON Schema plugin —
core-only, one-plugin, three-plugin, six-plugin, `presence` and `everydayRules`.

### Repository

Not user-visible, and recorded because the published comparison figures moved:

- The competitor benchmark's **"19.28× faster than zod"** was measuring a defect
  zod had already fixed. Accepted and rejected input are now timed as separate
  pools rather than as one mixed pool whose composition decided the headline.
  Measured on the runner against zod 4.6.2, the same comparison is **1.38×**
  mixed and **0.71×** on accepted input alone — so on the half of the pool that
  describes production traffic, zod is the faster of the two.
- CI re-records the competitor baseline and opens a pull request when it moves,
  instead of measuring it and discarding the result. A stale recorded version
  fails the build; a competitor's _verdict_ changing does not get automated away.
- The site answers what it costs to leave Luq before it argues for adopting it.

## [2.4.4] — 2026-09-11

### Added

- **The README carries the API.** It previously had no code at all — no
  `Builder` example, no import line. It now covers `build`, `validate`, `parse`,
  `pick`, `pickAll`, the slots, `[*]` and `withConfig`, and every example in it
  is compiled against the built package in CI.
- **`PLUGIN_MANIFEST` can be traced back to an import.** It shipped before but
  carried no method and no slots, and its `entryFile` named a `src/` path an
  installed package does not have. Entries now carry `surfaces` (read off each
  plugin object) and `entryPoint` (the specifier you type).

### Changed

- **A missing plugin names itself.** `.min(2)` without the import used to be
  `Property 'min' does not exist on type 'FieldChain<...>'` — equally true of a
  typo, of a method meant for another type, and of a forgotten import. It now
  reports `PluginNotImported<"min", "stringMinPlugin", "@maroonedog/luq/plugins/stringMin">`.
- **Four README links were dead once installed.** The logo, `CONTRIBUTING.md`,
  `SECURITY.md` and `docs/RELEASING.md` resolved in a git checkout and nowhere
  else. They are absolute URLs now, and a check refuses any relative target that
  is not published.
- **A helper typed on a builder with fewer plugins no longer accepts one with
  more.** `function f(b: typeof lean)` given a builder carrying extra plugins
  compiled in 2.4.3 and does not now: `.min` is a real method on one side and
  `PluginNotImported` on the other, and those do not compare. `createFieldRule`
  - `useField` is the supported way to share a rule across builders and is
    unaffected.

Released as a patch despite carrying features. Stated in its release notes:
downloads were 1–6 a day with most days at zero, so there was nobody to protect
from a version number.

## [2.4.3] — 2026-09-11

### Fixed

- **An issue's message named a different field from its own path.** Inside a
  recursive descent or a composite's `causes`, `messageFactory: (c) => ...c.path`
  rendered the short path while `issue.path` reported the full one — a message
  reading `at label` beside a path of `next.label`. Both now come from one
  source, so they agree.

  If you match on message text from inside a recursive schema or a composite's
  causes, those strings now carry the full path.

## [2.4.2] — 2026-09-11

### Fixed

- **`validate(null)` reported `REQUIRED`, not `required`.** A missing _field_
  reported `required`; a missing _subject_ reported the SCREAMING_SNAKE spelling
  the 2.x rewrite is documented as having replaced, left behind in the root
  short-circuit. Same condition, two spellings, and which one you met depended
  on how much of the value was absent. Both report `required` now.

### Added

- **`withConfig({ rootMissingMessage })`.** That issue had no call site to carry
  a `messageFactory` — an absent subject fails before the plan runs — so it is
  said in the config instead, resolved once at `build()`.

  `defaultSeverity` deliberately does not reach it: if it did, `validate(null)`
  would report success for a schema that declares nothing required, which is the
  outcome the root rejection exists to prevent.

## [2.4.1] — 2026-09-11

### Fixed

- **`toStandardJsonSchema` silently narrowed a flagged RegExp.**
  `.pattern(/^a.c$/i)` emitted `{"pattern": "^a.c$"}` — Draft-07's `pattern` is
  an ECMA-262 _source_ string with nowhere to spell a flag, so the emitted
  schema rejected `"ABC"` while the validator accepted it. It now refuses with
  `UnrepresentableRuleError`.
- **An argument the keyword table could not express was skipped in silence**,
  even under `policy: "throw"`. `null` meant both "adds no keyword, and that is
  correct" and "cannot be expressed", so `.pattern("^a$")` given a string, or
  `.oneOf()` given something that is not a list, vanished without the error that
  exists to prevent exactly that. The two answers are now distinct.

A caller who was handed one of those schemas was handed a wrong one, which is
why the refusal shipped as a patch rather than a minor.

## [2.4.0] — 2026-09-10

### Added

- **`@maroonedog/luq/schema-tooling`**, a public subpath for a tool that reads a
  Draft-07 document at **build time** rather than validating one at run time.
  Ten names, semver-frozen from this release and listed by hand:
  `flattenSchema`, `readChildSchemas`, `isDraft07Schema`, `isSchemaObject`,
  `listDraft07Keywords`, and the types `Draft07Schema`, `Draft07SchemaObject`,
  `ChildSchema`, `ReadChildSchemas`, `SchemaFieldDeclaration`.

  A generator that reimplemented path flattening would drift from the run-time
  conversion, and a document would then mean two different things depending on
  which door it came through. Sharing them is the point.

- **`@maroonedog/luq-codegen`**, a separate package, turns a Draft-07 object
  into the _source_ of a Luq validator module — readable, diffable, steppable.
  A keyword that cannot become a rule is returned in `skipped` and named in the
  generated file's header; nothing is dropped in silence.

  It was not on npm at this release: its `peerDependencies` names `>=2.4.0`, so
  the library had to go first.

Nothing already published changed shape.

## [2.3.1] — 2026-09-10

### Fixed

- **A field reported nothing for a value of the wrong type.** The 2.x rewrite
  dropped the type check that used to be prepended when a field entered a slot,
  and kept the convention built around it — every value rule answers PASS for a
  value outside its own type. With nothing reporting, `b.number.required().min(18)`
  accepted `"abc"`, `"31"`, `{}`, `true` and `[]`.

  Entering a slot now seeds the chain with that check: `stringType`,
  `numberType`, `booleanType`, `dateType`, `arrayType`, `objectType`.

  - `undefined` and `null` pass it — absence belongs to `required` / `optional`
    / `nullable`, so a missing field still reports `required`.
  - `NaN` is a number. `min`, `integer` and `finite` are where you say what you
    think of it.
  - `tuple`, `union` and `any` seed nothing.
  - The JSON Schema converter suppresses it: there the document owns the type.

  **Expect new issues on upgrade.** A field fed unparsed input — a form value, a
  JSON body — whose type you assumed held will start reporting `<slot>Type`.
  That is the release.

### Deprecated

- **`objectPlugin`** is inert: it answers PASS for everything. Its whole job was
  the check the slot now does, and agreeing produced two issues for one bad
  value. The verdict a caller sees is unchanged; only the code moves, from
  `object` to `objectType`. It is kept rather than removed because removing a
  published export is a major's business.

## [2.3.0] — 2026-09-10

### Added

- **`toStandardJsonSchema`** on `@maroonedog/luq/standard-schema` — a validator,
  emitted as a JSON Schema document. Reading one in was already there.

  - `draft-2020-12` and `draft-07`, and no guessing: anything else throws
    `UnsupportedJsonSchemaTargetError`. `openapi-3.0` descends from draft-04 and
    is not admitted on a resemblance.
  - `input` and `output` return the same schema. A declaration does not carry a
    transform's _result_ type, so a field declaring a transform counts as
    unwritable rather than having a second shape invented for it.
  - An unwritable declaration throws by default. A silently dropped `.custom()`
    produces a schema that admits values it must not. Ask for the lenient
    behaviour with `libraryOptions: { unrepresentable: "omit" }`.
  - Import `@maroonedog/luq/standard-schema` **before** you build; importing is
    what asks for the record of declared calls. `DeclarationsUnavailableError`
    names both causes.

- **`normalize`**, the third argument of `.v()` beside `default` — tidying a
  value before anything judges it. `validate()` and `parse()` judge the same
  normalized value; only `parse()` writes it back.

  It is **never called for `undefined` or `null`**, so `(v) => String(v).trim()`
  cannot turn a missing field into the string `"undefined"` and walk it past
  `.required()`. The ordering is what makes the common case work: `"  "` → trim
  → `""` → presence reads an empty string as missing → `required` fires.

### Size

Keeping the declaration record costs about 250&nbsp;B gzipped on every
configuration, charged to callers who never emit a schema too. Throughput is
unchanged; nothing in this release touches the hot path.

## [2.2.0] — 2026-09-09

### Changed

- **`validate()` is 2–3× faster** on accepted input, same machine and method as
  2.1.0: 1.99× on one field, 2.28× multi-field, 2.44× nested, 3.09× on an array
  of 50, 1.99× through a JSON Schema document.

  Mostly from no longer iterating frozen arrays with `for-of` (half of all
  garbage was iterators), moving build-time decisions out of the run time, and
  building issue paths lazily. Cost: the core bundle went 7,420 → 7,954&nbsp;B
  gzipped, of which up to 170&nbsp;B is the correction of a stale figure.

### Added

- **`@maroonedog/luq/plugins/stitchWith`** — cross-field rules written against
  one typed bundle.
- **`@maroonedog/luq/presets`** — one `.use()` for a bundle of plugins.
- `stitch` bundle entries are typed instead of `unknown`.

No runtime breaking changes.

## [2.1.0] — 2026-09-08

### Added

- **`@maroonedog/luq/standard-schema`** exporting `toStandardSchema()`. A Luq
  validator can be passed to anything that accepts a
  [Standard Schema](https://standardschema.dev) — tRPC, TanStack Form, Hono,
  react-hook-form through `@hookform/resolvers`. Its `validate` calls `parse()`
  and collects every issue. 312&nbsp;B gzipped, only when imported.

### Fixed

- **JSON Schema Draft-07 conformance: 929 / 929**, up from 828 / 929 in 2.0.0
  against the same pinned suite commit, with skipped cases counted as failures.
  `additionalProperties` now respects `patternProperties`.

No breaking changes. Core bundle unchanged at 7,420&nbsp;B gzipped.

## [2.0.0] — 2026-09-07

`src/` was rewritten from nothing. The design and the public naming carried
over; not one line of the implementation did. **Everything below is breaking
against 0.1.x** — the complete list, with what to write instead, is in
[docs/migration/breaking-changes.md](docs/migration/breaking-changes.md).

### Changed

The argument for this release is not speed. It is how much the compiler refuses
to let through, which matters most when the code calling this library is
generated rather than hand-written. Each of these compiled in 0.1.x and is a
compile error now:

- a slot unrelated to the field's type (`b.string` on a `number`)
- a missing `[*]` — `"items.name"` resolved to `never` and silently did nothing
- descending into a built-in, such as `"when.getTime"` on a `Date`
- binding a JSON Schema keyword to a chain method that does not exist — it was
  swallowed by `&&` and surfaced at run time
- calling a method that does not exist inside an element sub-chain

A documented example drifting from the API now fails CI; 0.1.x shipped one
broken in three places.

### Removed

- **The root subpath exports no plugins.** 0.1.x's `dist/index.d.ts` declared 57
  plugin exports that `dist/index.js` did not have at run time, so
  `import { requiredPlugin } from "@maroonedog/luq"` typechecked and gave you
  `undefined`. Each plugin has its own subpath.
- **The `.luq` DSL and the cross-language generation plan.** 0.1.x described it
  against dated milestones; the dates passed and none of it shipped, so the plan
  is withdrawn rather than moved.

### Why the rewrite

The 0.1.x source was 137 files and roughly 28,700 lines, with `any` in 1,365
places. Its own test suite reported 133 of 193 suites failing — and **130 of
those failed because the test files no longer compiled**, importing modules that
had been deleted. There was no safety net to refactor against.

The root cause was in `tsconfig.json`: it declared `"strict": true` and then
switched off `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`,
`noImplicitThis` and `noImplicitReturns` immediately below it.

## [0.1.2-alpha] — 2025-08-16

## [0.1.1-alpha] — 2025-08-16

## [0.1.0] — 2025-08-15

## [0.1.0-alpha] — 2025-08-14

The first published line, and the only one before the rewrite. There are **no
git tags and no GitHub releases** for any of these four versions — the record
that exists is npm's publish times and the commits between them, and the entries
above are dated from `npm view @maroonedog/luq time`. Nothing more specific can
be reconstructed honestly, so nothing more is claimed.

This is the line the rest of this repository's documentation calls "1.x". See
[A note on version numbers](#a-note-on-version-numbers).

[Unreleased]: https://github.com/maroonedog/luq/compare/v2.7.0...develop
[2.7.0]: https://github.com/maroonedog/luq/compare/v2.6.0...v2.7.0
[2.6.0]: https://github.com/maroonedog/luq/compare/v2.5.0...v2.6.0
[2.5.0]: https://github.com/maroonedog/luq/compare/v2.4.4...v2.5.0
[2.4.4]: https://github.com/maroonedog/luq/compare/v2.4.3...v2.4.4
[2.4.3]: https://github.com/maroonedog/luq/compare/v2.4.2...v2.4.3
[2.4.2]: https://github.com/maroonedog/luq/compare/v2.4.1...v2.4.2
[2.4.1]: https://github.com/maroonedog/luq/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/maroonedog/luq/compare/v2.3.1...v2.4.0
[2.3.1]: https://github.com/maroonedog/luq/compare/v2.3.0...v2.3.1
[2.3.0]: https://github.com/maroonedog/luq/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/maroonedog/luq/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/maroonedog/luq/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/maroonedog/luq/releases/tag/v2.0.0
[0.1.2-alpha]: https://www.npmjs.com/package/@maroonedog/luq/v/0.1.2-alpha
[0.1.1-alpha]: https://www.npmjs.com/package/@maroonedog/luq/v/0.1.1-alpha
[0.1.0]: https://www.npmjs.com/package/@maroonedog/luq/v/0.1.0
[0.1.0-alpha]: https://www.npmjs.com/package/@maroonedog/luq/v/0.1.0-alpha
