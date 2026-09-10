# Pre-release checklist

This file lists only what a machine cannot answer. What a machine can answer,
`npm run verify` answers, and §1 is the list of that. Never write "the tests
pass" on a checklist: that is CI's job, and mixing it in buries the items only a
person can decide.

**Do not copy a number into this file.** Read every one of them from the file
that records it. A published README once advertised one throughput figure while
a benchmark page in the same repository showed another, because both were typed
into prose by hand.

| Number | Its one source |
|---|---|
| Bundle size | `recordedGzipBytes` in `config/size-budget.json` |
| Performance: ops/sec, build cost, the comparison against the previous major | `config/perf-baseline.json` |
| Draft-07 conformance | `config/json-schema-suite.json` and `docs/json-schema-conformance.md` |
| Plugin and published-key counts | `config/plugin-catalog.lock.json` |
| The shape of the plugin author contract | `config/contract-arity.lock.json` |

Commands that measure them again:

```bash
npm run check:size     # bundle sizes; runs every build and fails CI over a ceiling
npm run bench:record   # performance, on a quiet named machine; rewrites config/perf-baseline.json
npx jest test/integration/json-schema-suite.test.ts   # Draft-07 conformance
npm pack --dry-run     # what actually goes into the package
```

---

## 0. What changed in the published surface this release

The starting point for review. Fill this in per release; it is the section that
tells a reviewer where to look.

---

## 1. What the machine answers (a person confirms only that it was green)

```bash
npm run verify      # everything below; do not release unless it exits 0
npm run bench:gate  # not part of verify; the bench workflow runs it
```

What `npm run verify` runs, in this order:

| Stage | Command | What a failure means is broken |
|---|---|---|
| Generated sources | `generate:sources` | The manifest or the barrel disagrees with src |
| Formatting | `format:check` | A formatting difference under src, test, scripts or bench |
| Static checks | `lint`, `lint:filenames` | `any`, a banned word, or a kebab-case violation |
| Types | `typecheck` (src, scripts, bench), `test:types` | A type regression, or a misplaced `@ts-expect-error` |
| Source contracts | `check:contract-arity` | The plugin author surface moved: the marker vocabulary, ResolveArg's arity, or build's method declaration |
| | `check:module-has-test` | A src module no run-time test touches |
| | `check:suite-pin` | The JSON Schema suite's SHA, digest or skip count disagrees with the record |
| Catalog | `check:plugin-uniqueness`, `check:plugin-isolation`, `check:exports --mode=exact`, `check:catalog-lock` | A duplicated plugin, an isolation violation, or a hand-edited exports map |
| Build | `build` | dist cannot be produced |
| Shipped artefact | `check:no-dynamic-code` | `eval` or `new Function` reached the shipped artefact, which is the evidence for the CSP-safe claim |
| | `check:dist-layout` | A private artefact got in, a relative specifier does not resolve, or an entry absorbed the core |
| Documentation | `check:generated-docs`, `check:doc-examples`, `check:doc-imports` | A stale generated reference, an example that does not compile, or an unpublished import |
| Distribution | `check:size`, `check:barrel-equivalence` | A size budget exceeded, or the barrel keeping code the subpath drops |
| Tests | `npm test` | Everything else: unit, integration and dist |

`prepublishOnly` runs `npm run verify`, so `npm publish` cannot run without it.

---

## 2. What a person decides (only these can stop a release)

### 2.1 Performance against the previous major

Read `legacyComparison` in `config/perf-baseline.json`, which is the previous
major's sources and this implementation's measured alternately, in one process,
on one machine. The README renders the same figures and puts the shapes that
lose in bold.

- A shape that loses is not a measurement artefact. The previous major rejects
  invalid values on all five shapes, so it is not faster by doing less.
- **Decide: accept the difference, optimise before publishing, or publish with
  the difference stated.** The README states it either way.
- Record the decision below, with the date and who made it.

### 2.2 Whether the size ceilings are still right

Read `gzipCeilingBytes` in `config/size-budget.json`. A ceiling confirms a
measurement and leaves a margin smaller than one plugin costs, so it sits where
adding one more plugin breaks it.

- Raising a ceiling is reviewable. **Never raise one to make a measurement
  pass.**
- `full-feature` is the core plus every plugin, which nobody actually imports.
  Do not quote it on its own as "the bundle size".

### 2.3 Whether to publish the conformance figure

Read the headline number in `docs/json-schema-conformance.md`, remembering that
a skipped case counts as a failure there. What means something is the distance
from the trivial floor.

Raising the rate by skipping more is structurally impossible, since a skip
counts as a failure — but **review any change in the skip count**:
`check:suite-pin` compares counts and nothing else.

### 2.4 What goes into the package

```bash
npm publish --dry-run
```

Read the file list.

- Belongs: `dist/`, `README.md`, `LICENSE`, `package.json`
- Must not: raw `.ts` from `src/`, `test/`, `scripts/`, `bench/`, `docs/`,
  `__tests__`, anything `*.experimental*`, `.map`
- `files: ["dist"]` and `check:dist-layout` cover this between them. **Read the
  list anyway**: the previous major published its own test directory.

### 2.5 Version and distribution metadata

- Was `package.json#version` raised? A change incompatible with the previous
  published surface — see `docs/migration/breaking-changes.md` — needs a major.
- Publishing a pre-release goes out under its own tag, never on `latest`.
- Are `repository`, `homepage`, `bugs`, `license` and `sideEffects: false`
  still correct?
- `dependencies` is empty, and
  `test/integration/published-package-shape.test.ts` asserts it. A dependency
  appearing there is a change to the published surface.

### 2.6 The documentation's promises

- Are the numbers in the README and the guides read from the sources in the
  table at the top, with none typed in by hand?
- Does `docs/migration/breaking-changes.md` list everything that breaks?
- Is everything the previous major advertised and this one does not carry
  forward written down as not carried forward?

---

## 3. Outstanding, and whether it stops a release is a person's call

- **Leftovers from the previous major at the repository root**:
  `core-entry.ts`, `exports-config.json`, `rollup.dts.config.js`, `build.sh`,
  `run-all-tests.sh`, `lib/`, `test-build/`, `jest.swc.config.js`,
  `scripts/benchmark-optimized.js`, `scripts/performance-profiler.js`. All of
  them fall outside `files: ["dist"]` and so **are not published**, but anyone
  reading the repository takes them for live configuration. Remove them in
  their own commit.

  `bundle-size-comparison/` has already gone: it held calling code that throws
  when run, and a build script that produced a false size by bundling this
  dist together with the previous major's calling code without executing
  either. The eighteen lines of otherwise unrecorded figures it carried are
  preserved verbatim in
  `docs/legacy-spec/bundle-size-comparison-results.json`. Those are other
  libraries' versions as of August 2025 and must not be quoted as a current
  comparison.
- **`test/type/contract/**` and `docs/plugin-author-contract.md` do not
  exist.** They were listed as products of build-order step 7 and never made.
  `config/contract-arity.lock.json` freezes the contract in their place.
- **There is no `scripts/check-test-names.ts`** — the check the test strategy
  asks for, banning names like final-assault, coverage and extra. No test
  currently carries such a name, but nothing mechanical stops one.

---

## 4. Record of decisions

| Date | Decided by | Decision |
|---|---|---|
| | | |
