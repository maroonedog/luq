# テスト戦略（確定版）

PLACEMENT AND NAMING (nothing test-shaped lives in src/, so the `files` rule stays clean)
- test/unit/<mirrors the src path>/<same-kebab-name>.test.ts — one runtime test file per src module, same name, same relative path. `scripts/check-module-has-test.ts` fails CI when any src/**/*.ts other than index.ts and *.types.ts has no sibling here.
- test/integration/<scenario>.test.ts — cross-layer behaviour (the plugin catalog, the JSON Schema suite, engine-identity proofs).
- test/contract/<public-subpath>.contract.test.ts — one per published subpath, importing it the way a consumer does.
- test/type/<mirrors the src path>/<same-kebab-name>.type-test.ts — type tests only. Jest never sees them (`testPathIgnorePatterns` gains `\.type-test\.ts$`).
- test/type/assert-type.ts — the in-repo assertion kit: Equals, Extends, IsNever, IsAny, assertTrue, expectTypeEquals, expectAssignable. 33 lines, no dependency.
- test/type/probes/** — files that must FAIL a gate (a 201-line file, `: any`, `Function`, a stray suppression); the gate scripts are tested against them.
- test/type/contract/** — the frozen plugin-author samples produced at the contract gate.
- test/support/** — fixtures and factories. bench/ for benchmarks.
- The 200-line rule does NOT extend to test/ and bench/; the cap there is 300, via an eslint override. A test file inherits its subject's responsibility, so splitting it by line count invents boundaries that mean nothing. When a subject genuinely needs more, split by BEHAVIOUR with an infix (`run-field.presence.test.ts`, `run-field.transforms.test.ts`), never by a counter suffix.
- `scripts/check-test-names.ts` hard-bans the legacy coverage-farming vocabulary as filename fragments: final-assault, coverage, extra, more, additional, part2, misc.

TYPE TESTS — THE DECISIVE POINT
The repo currently ships BOTH `test: jest` (ts-jest, type-checking) and `test:swc` (types stripped), so a type test placed under jest passes or fails depending on which script CI happens to run. Type tests therefore run under `tsc --noEmit -p tsconfig.type-test.json` as the npm script `test:types`, inside `verify`, and never under jest.
- Negative assertions are `@ts-expect-error`. TypeScript reports TS2578 when one is unused, so a type test that stops failing FAILS THE BUILD. This is the mechanism that keeps every repair from rotting; it is why the whole confirmed type set carries 10 of them and why each was mutation-verified (revert the repair, watch that exact line report TS2578).
- Property-style assertions are stated as "the counterexample set is empty" (UnresolvedPaths<T>, MalformedPaths<T>, CallSiteGap, RuntimeGap, OutputGap, RuleShapeGap), so a regression names the offending path or marker kind in the compiler error rather than silently yielding never.
- `any` is never written literally, even here: `ReturnType<typeof JSON.parse>` supplies one where IsAny needs it, so test/ needs no eslint exemption.

DEV DEPENDENCIES
Exactly one addition: `expect-type@^1.4.0` (verified `added 1 package`, zero transitive deps, types-only, nothing imported at runtime), used for value-shape assertions where its error messages beat a hand-rolled Equals. Everything structural uses test/type/assert-type.ts. No tsd, no vitest — the repo already has jest, ts-jest, @swc/jest and typescript.

JSON-SCHEMA-TEST-SUITE
Acquired as a pinned git submodule at test/fixtures/json-schema-suite; CI checks out with `submodules: true`. The npm route was disproved with registry data: `@json-schema-org/tests` latest is 2.0.0 published 2020-04-27 and its sole dependency is a github: git URL, so it is not a self-contained tarball. Vendoring was rejected as 3 MB of third-party JSON in the diff.
- The skip list is TYPED DATA at test/json-schema/suite-skip-list.ts, not JSON. Every entry requires `cause` (a closed union), `reason` (prose a reviewer reads) and `expiresWith` (what must exist before it can be deleted); all three are compile-enforced.
- `findStaleSkips()` runs after the corpus and FAILS the build when a skipped case actually passes. That is what stops the list rotting into a place to hide regressions.
- `scripts/check-suite-pin.ts` fails when the recorded SHA moved without a matching skip-list change, so a suite bump is always a reviewed commit.
- The published pass rate is the acceptance number and must exceed the legacy baseline (legacy fails 32 of 42 fromJsonSchema integration tests).

COVERAGE
Measured and reported, never a gate. The legacy `jsonschema-final-assault.test.ts` genre exists precisely because coverage was the target. The gate that replaces it cannot be farmed: `check-module-has-test.ts` requires a real sibling test per module, and `check-test-names.ts` bans the farming vocabulary. The percentage stays a report on the PR.

PERFORMANCE
CI gates on a RATIO measured in the same process, never on absolute ops/sec: `bench/measure-throughput-ratio.ts` measures luq and a hand-written reference validator for the same shape back to back and asserts luq_ops / reference_ops >= floor. The runner's speed cancels out, so it does not flake. The floors must be CALIBRATED from the first real run before the gate is switched on — turning it on with guessed floors is worse than no gate.
Absolute figures come from `npm run bench:record` on a named machine, land in config/perf-baseline.json, and are quoted in the README from that file. They are never a pass/fail condition. validate and parse are measured separately, on both the simple and the complex shape, with abortEarly documented.

THE TESTS THAT PROVE THE ARCHITECTURE (each names a defect that would otherwise be invisible)
1. marker-coverage: adding a marker handled in only one resolver must fail to compile, naming the kind.
2. optional marker argument: `then?: ElementChain` must arrive in build() as `readonly Rule[] | undefined`, never as the marker.
3. guard-then-required: coverage recorded by `.guard()` must survive a later `.required()`.
4. presence observability, both directions, on a primitive slot.
5. one engine: a FieldRule and the same rule via .v() produce byte-identical issue arrays; grep proves runtime imports no plugin code and no plugin calls rule.run.
6. one callback execution: a spy proves a field callback and a sub-chain callback each run exactly once, at build() time.
7. build-time cost: validate() run twice allocates the same number of closures as run once.
8. isolation: an isolated-tier plugin importing a sibling or the json-schema layer fails; the same imports from an extension-tier plugin pass.
9. path round-trip: every literal FieldPath<T> generates must resolve and must parse; the runtime parser and ParsePath are driven by one shared table.
10. no method collisions across all 69 isolated plugins on any slot — provable only at the plugins gate, which is why it lives there.
