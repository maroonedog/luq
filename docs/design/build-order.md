# The order of implementation (settled)

Each step can be completed independently by one person, and no two steps write
to the same file. A review happens at each tier boundary: core, plugins,
json-schema, release.

| # | Tier | Contents | Depends on | Produces |
|---|---|---|---|---|
| 1 | core | Repo scaffolding: true-strict tsconfig, lint gates, test tooling, build script, CI | - | tsconfig.json<br>tsconfig.build.json<br>tsconfig.type-test.json<br>…and 14 more |
| 2 | core | L0 vocabulary and the ./result subpath | 1 | src/types/**<br>src/result/**<br>test/type/types/**<br>…and 2 more |
| 3 | core | L1 path TYPES: segment vocabulary, FieldPath, ValueAtPath, LeafPath, PickPaths | 1 | src/path/path-depth.types.ts<br>src/path/opaque-object.types.ts<br>src/path/element-of.types.ts<br>…and 5 more |
| 4 | core | L1 path RUNTIME: parser, reserved segments, readers, copy-on-write writer, formatter, matcher | 2, 3 | src/path/index.ts<br>src/path/reserved-segment.ts<br>src/path/parse-field-path.ts<br>…and 6 more |
| 5 | core | L2 plugin-kit: markers and registries, PluginSignature, RuntimeArgs, the six-member Rule union, rule constructors, definePlugin | 4 | src/plugin-kit/**<br>test/type/plugin-kit/**<br>test/unit/plugin-kit/** |
| 6 | core | L3 chain TYPES at final type-parameter arity: bag, ChainState, ResolveArgs, ChainMethod, FieldChain, FieldSlots, marker coverage | 5 | src/chain/plugin-bag.types.ts<br>src/chain/chain-state.types.ts<br>src/chain/slot-value.types.ts<br>…and 6 more |
| 7 | core | CONTRACT GATE: freeze the plugin-author surface (L2 + L3) before any consumer of it exists | 5, 6 | test/type/contract/**<br>config/contract-arity.lock.json<br>docs/plugin-author-contract.md |
| 8 | core | Type-erasure boundary and chain runtime: slot methods, collision detection, `b`, the two collectors | 7 | src/core/type-erasure.ts<br>src/chain/index.ts<br>src/chain/attach-slot-methods.ts<br>…and 5 more |
| 9 | core | L4 compile part 1: plan types, the BranchExecutor port, declared child keys, presence merge, kind split, field compilation | 8 | src/compile/validation-plan.types.ts<br>src/compile/branch-executor.port.ts<br>src/compile/declared-child-keys.ts<br>…and 5 more |
| 10 | core | L4 compile part 2: array grouping (loop interchange), composite erasure, schema assembly with PlanRef back-patching | 9 | src/compile/index.ts<br>src/compile/group-array-fields.ts<br>src/compile/compile-array-node.ts<br>…and 3 more |
| 11 | core | L5 runtime part 1: issue sink, index stack, issue creation, field runner | 9 | src/runtime/issue-sink.ts<br>src/runtime/index-stack.ts<br>src/runtime/create-issue.ts<br>…and 2 more |
| 12 | core | L5 runtime part 2: array runner, branch executor, recursion, output writer, plan runner, validators | 10, 11 | src/runtime/index.ts<br>src/runtime/run-array-node.ts<br>src/runtime/run-branch.ts<br>…and 6 more |
| 13 | core | L6 builder and the single public entry point | 12 | src/builder/**<br>src/index.ts<br>test/unit/builder/**<br>…and 1 more |
| 14 | core | field-rule: createPluginRegistry, createFieldRule, useField on the shared engine | 13 | src/field-rule/**<br>test/unit/field-rule/** |
| 15 | core | The ./async subpath: pre-resolve external context, no second execution path | 13 | src/async/**<br>test/unit/async/** |
| 16 | core | Catalog machinery: manifest / barrel / exports / catalog generators plus the isolation and lock checks | 1, 7 | scripts/generate-plugin-manifest.ts<br>scripts/generate-plugin-barrel.ts<br>scripts/generate-package-exports.ts<br>…and 8 more |
| 17 | core | CORE STAGE VERIFY GATE: npm run verify green, core subpaths resolve, contract frozen | 14, 15, 16 | test/type/public-surface/core.type-test.ts<br>docs/migration/core.md<br>config/plugin-catalog.lock.json |
| 18 | plugins | Presence and value-matching plugins (11 directories) | 17 | src/plugins/required/**<br>src/plugins/optional/**<br>src/plugins/nullable/**<br>…and 9 more |
| 19 | plugins | String plugins including every Draft-07 format (25 directories) | 17 | src/plugins/string-min/**<br>src/plugins/string-max/**<br>src/plugins/string-exact-length/**<br>…and 23 more |
| 20 | plugins | Number and boolean plugins (10 directories) | 17 | src/plugins/number-min/**<br>src/plugins/number-max/**<br>src/plugins/number-integer/**<br>…and 8 more |
| 21 | plugins | Array, object, tuple, union and conditional plugins, including every composite (17 directories) | 17 | src/plugins/array-min-length/**<br>src/plugins/array-max-length/**<br>src/plugins/array-unique/**<br>…and 15 more |
| 22 | plugins | Relational, contextual, transform and access plugins, with exactly one stitch (6 directories) | 17 | src/plugins/compare-field/**<br>src/plugins/stitch/**<br>src/plugins/transform/**<br>…and 4 more |
| 23 | plugins | PLUGINS STAGE VERIFY GATE: integrate the catalog, regenerate every derived artifact once, npm run verify green | 18, 19, 20, 21, 22 | scripts/check-plugin-uniqueness.ts<br>test/integration/plugin-catalog.test.ts<br>docs/migration/plugins.md |
| 24 | json-schema | JSON Schema foundations: Draft-07 types, keyword value types, the binding types, split keyword tables, format map, $ref resolver | 23 | src/json-schema/draft07.types.ts<br>src/json-schema/draft07-keyword-value.types.ts<br>src/json-schema/keyword-binding.types.ts<br>…and 12 more |
| 25 | json-schema | JSON Schema conversion: flatten, compose keywords, compose conditional, declare keywords, build from schema | 24 | src/json-schema/index.ts<br>src/json-schema/flatten-schema.ts<br>src/json-schema/flatten-array-schema.ts<br>…and 8 more |
| 26 | json-schema | The two extension-tier bundle plugins and the conformance corpus | 25 | src/json-schema/extensions/json-schema/**<br>src/json-schema/extensions/json-schema-full-feature/**<br>.gitmodules<br>…and 3 more |
| 27 | json-schema | JSON SCHEMA STAGE VERIFY GATE: npm run verify green with 71 plugins and the conformance number published | 26 | docs/json-schema-conformance.md<br>test/type/public-surface/json-schema.type-test.ts |
| 28 | release | Distribution gates over the build authored in step 1 | 27 | scripts/check-no-dynamic-code.ts<br>scripts/check-dist-layout.ts<br>test/dist/** |
| 29 | release | Bundle size budgets and barrel equivalence | 28 | scripts/measure-bundle-size.ts<br>scripts/check-barrel-equivalence.ts<br>config/size-budget.json |
| 30 | release | Benchmark harness: absolute figures recorded, CI gated on an in-process ratio | 27 | bench/**<br>scripts/run-bench.ts<br>config/perf-baseline.json |
| 31 | release | Documentation, migration guide and example typechecking | 29, 30 | README.md<br>docs/guide/**<br>docs/migration/breaking-changes.md<br>…and 2 more |
| 32 | release | RELEASE STAGE VERIFY GATE: every gate green, catalog reviewed, publish dry-run | 28, 29, 30, 31 | docs/release-checklist.md<br>test/type/public-surface/release.type-test.ts |

## How each step is verified

### 1. Repo scaffolding: true-strict tsconfig, lint gates, test tooling, build script, CI (core)

- Depends on: nothing
- Produces:
  - `tsconfig.json`
  - `tsconfig.build.json`
  - `tsconfig.type-test.json`
  - `eslint.config.js`
  - `.dependency-cruiser.cjs`
  - `jest.config.js`
  - `.gitignore`
  - `package.json#!/exports`
  - `scripts/build.ts`
  - `scripts/run-verify.ts`
  - `scripts/generate-all.ts`
  - `scripts/check-filenames.ts`
  - `scripts/check-consumer-resolution.ts`
  - `.github/workflows/verify.yml`
  - `test/type/probes/**`
  - `test/type/assert-type.ts`
  - `test/support/**`
- Verified by: `npm run verify` is green with NO src/ at all: it runs `tsc --noEmit -p tsconfig.type-test.json` over test/type/**, jest over test/unit/**, eslint, and the filename gate. Every strict flag plus noUncheckedIndexedAccess is on with no per-flag override. Probes under test/type/probes must each FAIL the gate they target: a 201-line src file, `: any`, `Function`, `@ts-ignore`, a suppression outside src/core/type-erasure.ts, `new Function`, a module-scope `let`, a banned filename word. `expect-type@^1.4.0` is the only new devDependency. `npm run generate` exists as a no-op prestep of typecheck/test/build/docs. This step never creates src/index.ts.

### 2. L0 vocabulary and the ./result subpath (core)

- Depends on: 1
- Produces:
  - `src/types/**`
  - `src/result/**`
  - `test/type/types/**`
  - `test/unit/types/**`
  - `test/unit/result/**`
- Verified by: Type tests prove ValidationResult narrows on `valid` with no cast and that `data` exists only on the success branch. Runtime tests: a result round-trips through JSON, ok() reuses the frozen EMPTY_ISSUES singleton, ValidationFailure is an Error carrying issues, GlobalConfig and ValidationIssue.severity survive from 1.x. Runs in parallel with step 3.

### 3. L1 path TYPES: segment vocabulary, FieldPath, ValueAtPath, LeafPath, PickPaths (core)

- Depends on: 1
- Produces:
  - `src/path/path-depth.types.ts`
  - `src/path/opaque-object.types.ts`
  - `src/path/element-of.types.ts`
  - `src/path/path-segment.types.ts`
  - `src/path/field-path.types.ts`
  - `src/path/value-at-path.types.ts`
  - `src/path/leaf-path.types.ts`
  - `test/type/path/**`
- Verified by: The round-trip property is the acceptance condition, stated as 'the counterexample set is empty' so a regression NAMES the offending path: UnresolvedPaths<T> and MalformedPaths<T> are both asserted never over a fixture with Date/RegExp/Map/Set/function/2-D arrays/optional arrays/unions/self-reference/Record<string,unknown>. Exclude<LeafPath<T>, FieldPath<T>> is asserted never. @ts-expect-error on `items.name`, `items[0].name`, `tags.length`, `when.getTime`, `a.*.b`. PathDepthBudget is asserted to be exactly 6 and both sides of the boundary are pinned. Runs in parallel with step 2.

### 4. L1 path RUNTIME: parser, reserved segments, readers, copy-on-write writer, formatter, matcher (core)

- Depends on: 2, 3
- Produces:
  - `src/path/index.ts`
  - `src/path/reserved-segment.ts`
  - `src/path/parse-field-path.ts`
  - `src/path/create-value-reader.ts`
  - `src/path/create-array-reader.ts`
  - `src/path/create-value-writer.ts`
  - `src/path/format-issue-path.ts`
  - `src/path/match-path-pattern.ts`
  - `test/unit/path/**`
- Verified by: ONE shared table fixture drives both the runtime parser and the step-3 type tests, so the two grammars cannot drift: in particular `items[*][*]` must yield [key, each, each] in that order on both sides. Boundaries: missing key, own key set to undefined, null intermediate, primitive intermediate does not descend, array never implicitly mapped, array hole, non-array at [*], empty path rejected, dotted key rejected at parse, __proto__/constructor/prototype throw PathSyntaxError. The writer is copy-on-write, asserted by identity. parentFieldPath and leafKeyOf are covered because step 9 depends on them.

### 5. L2 plugin-kit: markers and registries, PluginSignature, RuntimeArgs, the six-member Rule union, rule constructors, definePlugin (core)

- Depends on: 4
- Produces:
  - `src/plugin-kit/**`
  - `test/type/plugin-kit/**`
  - `test/unit/plugin-kit/**`
- Verified by: PluginSignature's TOut defaults to `unknown`; a readonly AnyPlugin[] holding one plugin of each of the eight kinds compiles with no cast. build() receives RuntimeArgs, and an OPTIONAL marker argument (`then?: ElementChain`) arrives as the RESOLVED value | undefined, never as the marker - this is a required assertion, without it the leak recurs. RuleForOut pins TransformOut to TransformRule and any PresenceShift to PresenceRule, proved by two @ts-expect-error cases. A never-check asserts exhaustiveness over all six Rule kinds. grep proves zero casts across all sample plugins. dependency-cruiser proves plugin-kit imports nothing from chain/compile/runtime/builder.

### 6. L3 chain TYPES at final type-parameter arity: bag, ChainState, ResolveArgs, ChainMethod, FieldChain, FieldSlots, marker coverage (core)

- Depends on: 5
- Produces:
  - `src/chain/plugin-bag.types.ts`
  - `src/chain/chain-state.types.ts`
  - `src/chain/slot-value.types.ts`
  - `src/chain/resolve-args.types.ts`
  - `src/chain/chain-method.types.ts`
  - `src/chain/field-chain.types.ts`
  - `src/chain/field-slots.types.ts`
  - `src/chain/marker-coverage.types.ts`
  - `test/type/chain/**`
- Verified by: The arity is settled HERE and nowhere later. marker-coverage.types.ts must fail to compile when a registry entry is handled in only one resolver (verified by adding a throwaway marker). @ts-expect-error proves: an invented method inside a nested element chain, wrong arity there, an unregistered plugin there, a slot unrelated to the field type, and a union whose guards are not exhaustive. Presence is observable at a primitive slot in BOTH directions. Guard coverage SURVIVES a later presence shift (`.guard(...).required()` still reports the uncovered member) - this assertion is mutation-verified and must not be dropped. `tsc --extendedDiagnostics` is recorded as the instantiation baseline AFTER the arity is final.

### 7. CONTRACT GATE: freeze the plugin-author surface (L2 + L3) before any consumer of it exists (core)

- Depends on: 5, 6
- Produces:
  - `test/type/contract/**`
  - `config/contract-arity.lock.json`
  - `docs/plugin-author-contract.md`
- Verified by: test/type/contract holds one compiling sample plugin per rule kind and per marker family, written the way a plugin author writes them, with zero casts. config/contract-arity.lock.json records: marker vocabulary = 9 argument + 4 output types (7 output registry entries); ResolveArg arity = 5; ChainState has exactly three members; PluginDefinition.build is a METHOD declaration (arrow-property form silently breaks AnyPlugin); RuleBuildContext has exactly five members. scripts/check-contract-arity.ts compares the live types against the lock and fails on drift. Everything downstream consumes this contract and may not change it.

### 8. Type-erasure boundary and chain runtime: slot methods, collision detection, `b`, the two collectors (core)

- Depends on: 7
- Produces:
  - `src/core/type-erasure.ts`
  - `src/chain/index.ts`
  - `src/chain/attach-slot-methods.ts`
  - `src/chain/create-chain-node.ts`
  - `src/chain/create-field-slots.ts`
  - `src/chain/collect-field-rules.ts`
  - `src/chain/collect-branch-rules.ts`
  - `test/unit/chain/**`
- Verified by: collectFieldRules invokes the user callback EXACTLY once and returns rules in declaration order. collectBranchRules does the same for a sub-chain and hands the plugin a frozen Rule[] (eager, never a thunk) - a spy proves the callback ran once. The guard method's two-argument form is handled like transform's: argument 2 is a sub-builder callback run once against slots built for the narrowed type and the same bag. A plugin whose slots exclude the entry point has no runtime method, matching the type. Colliding method names throw PluginMethodCollisionError naming both plugins. Chain nodes are immutable, so two chains branched from one `b` cannot cross-contaminate. grep proves exactly ONE file in src/ carries a suppression and it is src/core/type-erasure.ts.

### 9. L4 compile part 1: plan types, the BranchExecutor port, declared child keys, presence merge, kind split, field compilation (core)

- Depends on: 8
- Produces:
  - `src/compile/validation-plan.types.ts`
  - `src/compile/branch-executor.port.ts`
  - `src/compile/declared-child-keys.ts`
  - `src/compile/resolve-presence.ts`
  - `src/compile/split-rules-by-kind.ts`
  - `src/compile/resolve-recursion.ts`
  - `src/compile/compile-field.ts`
  - `test/unit/compile/field/**`
- Verified by: Tests assert on the PLAN, not on validation results: kind-separated arrays, declaration order preserved, presence rules merged into one order-independent policy, write === null when a field has neither transform nor default, recursion === null on ordinary fields, a malformed path throwing at build time and naming the path. declaredSiblingKeys is derived from path strings only and each array is FROZEN - a test proves a plugin's build() cannot push into it. dependency-cruiser proves compile imports chain and chain never imports compile.

### 10. L4 compile part 2: array grouping (loop interchange), composite erasure, schema assembly with PlanRef back-patching (core)

- Depends on: 9
- Produces:
  - `src/compile/index.ts`
  - `src/compile/group-array-fields.ts`
  - `src/compile/compile-array-node.ts`
  - `src/compile/compile-composite.ts`
  - `src/compile/compile-schema.ts`
  - `test/unit/compile/schema/**`
- Verified by: Snapshot tests on the ArrayNode tree: three fields under one prefix become one node with three element fields; items[*].sub[*].x nests two nodes; matrix[*][*] compiles to two levels. compileComposite calls combine exactly ONCE and returns a plain CompiledCheck, so no new rule kind ever reaches L5; all five reductions are covered (all-apply, positional, existential, scatter, routing). A branch whose fields contain [*] compiles. compileSchema without a BranchExecutor is a compile error, so no second traversal can be smuggled into compile/. A self-referential plan compiles with no forward declaration and no cast. A cost test asserts validate() run twice allocates the same number of closures as run once.

### 11. L5 runtime part 1: issue sink, index stack, issue creation, field runner (core)

- Depends on: 9
- Produces:
  - `src/runtime/issue-sink.ts`
  - `src/runtime/index-stack.ts`
  - `src/runtime/create-issue.ts`
  - `src/runtime/run-field.ts`
  - `test/unit/runtime/field/**`
- Verified by: Behaviour over hand-built plans: the abortEarly x abortEarlyOnEachField matrix, presence short-circuit skipping checks and transforms, gates aborting remaining checks, expected/actual/branch/index/causes reaching the issue, the message rendered exactly once and the user's check invoked exactly once, a throwing check not swallowed. Needs only the plan types from step 9, so it runs in parallel with step 10.

### 12. L5 runtime part 2: array runner, branch executor, recursion, output writer, plan runner, validators (core)

- Depends on: 10, 11
- Produces:
  - `src/runtime/index.ts`
  - `src/runtime/run-array-node.ts`
  - `src/runtime/run-branch.ts`
  - `src/runtime/run-recursion.ts`
  - `src/runtime/output-writer.ts`
  - `src/runtime/run-plan.ts`
  - `src/runtime/create-validator.ts`
  - `src/runtime/create-field-validator.ts`
  - `test/unit/runtime/plan/**`
- Verified by: Issue paths read items[0].name and grid[0][2]. An array is read exactly once per node however many element fields exist. run-branch is the ONLY BranchExecutor and it calls runPlan; grep proves runtime imports nothing from plugin-kit or plugins. Recursion terminates on cycles (WeakSet) and reports at maxDepth. validate() never transforms and never mutates; parse() transforms in declaration order and returns a copy-on-write structure; hasTransforms === false skips the writer entirely. Robustness suite: cycles, 1000-deep nesting, null-prototype objects, sparse arrays, 10k elements.

### 13. L6 builder and the single public entry point (core)

- Depends on: 12
- Produces:
  - `src/builder/**`
  - `src/index.ts`
  - `test/unit/builder/**`
  - `test/type/builder/**`
- Verified by: End-to-end with the contract sample plugins. use() dedupes by name first-wins and throws a named error on a nameless value; its return type writes the bag intersection INLINE (no AddToBag alias - that alias costs a measured 14x in instantiations). .v() is immutable and its callback runs only at build(). Field defaults behave identically in validate and parse. .strict() uses MissingLeafPaths and its rejection is a named error object listing the undeclared LEAF paths, never demanding a container path and never demanding anything inside a Record<string, unknown>. src/index.ts is created here and by no other step.

### 14. field-rule: createPluginRegistry, createFieldRule, useField on the shared engine (core)

- Depends on: 13
- Produces:
  - `src/field-rule/**`
  - `test/unit/field-rule/**`
- Verified by: A rule expressed as a FieldRule and the same rule expressed inline through .v() produce byte-identical issue arrays, proving there is one engine. registry.use() is immutable while builder.use() is not, and both are asserted. Runs in parallel with steps 15 and 16.

### 15. The ./async subpath: pre-resolve external context, no second execution path (core)

- Depends on: 13
- Produces:
  - `src/async/**`
  - `test/unit/async/**`
- Verified by: createAsyncContext resolves a promise map once and hands the result to validate(value, { context }); a test proves no rule executes inside ./async. The documented validator.withAsyncContext(ctx).validate(data) shape is provided as a thin wrapper over the same call. It depends on the builder only and on no plugin, which is why it is not scheduled behind the plugin stage.

### 16. Catalog machinery: manifest / barrel / exports / catalog generators plus the isolation and lock checks (core)

- Depends on: 1, 7
- Produces:
  - `scripts/generate-plugin-manifest.ts`
  - `scripts/generate-plugin-barrel.ts`
  - `scripts/generate-package-exports.ts`
  - `scripts/generate-plugin-catalog.ts`
  - `scripts/check-exports.ts`
  - `scripts/check-plugin-isolation.ts`
  - `scripts/check-catalog-lock.ts`
  - `scripts/check-module-has-test.ts`
  - `scripts/check-doc-imports.ts`
  - `test/type/fixtures/seed-plugins/**`
  - `test/unit/scripts/**`
- Verified by: Driven entirely by seed plugin fixtures, never by src/plugins, so this step writes nothing a plugin step will later touch. check-exports has two tested modes: --mode=superset on a branch, --mode=exact at a gate. The kebab<->camel round trip fails on an irregular directory name unless it is in the override table; the override table has exactly three entries (jsonSchema, jsonSchemaFullFeature, readOnlyWriteOnly) and `uuid` is deliberately NOT one. check-plugin-isolation classifies imports into a closed area set per tier and must NOT treat src/json-schema/** outside extensions/ as a plugin directory - a fixture proves that. check-module-has-test fails when a src module has no sibling unit test. Runs in parallel with steps 8-15.

### 17. CORE STAGE VERIFY GATE: npm run verify green, core subpaths resolve, contract frozen (core)

- Depends on: 14, 15, 16
- Produces:
  - `test/type/public-surface/core.type-test.ts`
  - `docs/migration/core.md`
  - `config/plugin-catalog.lock.json`
- Verified by: `npm run verify` (generate, tsc -p tsconfig.build.json, tsc -p tsconfig.type-test.json, jest, eslint, dependency-cruiser, check-filenames, check-module-has-test, check-contract-arity) exits 0. Zero `any`, exactly one suppression file, no upward import. The six core export keys (`.`, `./package.json`, `./result`, `./plugin-kit`, `./async`, `./plugins`) are generated here and a scratch consumer resolves every one under node16 and bundler. config/plugin-catalog.lock.json is created with an empty plugin list, so the count gate is live from now on. No plugin-stage step may depend on any core step other than this one.

### 18. Presence and value-matching plugins (11 directories) (plugins)

- Depends on: 17
- Produces:
  - `src/plugins/required/**`
  - `src/plugins/optional/**`
  - `src/plugins/nullable/**`
  - `src/plugins/required-if/**`
  - `src/plugins/optional-if/**`
  - `src/plugins/validate-if/**`
  - `src/plugins/skip/**`
  - `src/plugins/or-fail/**`
  - `src/plugins/literal/**`
  - `src/plugins/one-of/**`
  - `src/plugins/custom/**`
  - `test/unit/plugins/presence/**`
- Verified by: One table-driven test per plugin, driven through the public Builder. required rejects undefined/null/'' and accepts 0/false/[]/{}, and its `out: PresenceShift<"excludeMissing">` makes the TYPE agree with that runtime behaviour; optional accepts undefined and rejects null. The presence policy is order-independent. Gates behave identically wherever they sit in the chain. Every plugin honours options.code and options.messageFactory and its default code equals its name. Writes nothing outside its own directories.

### 19. String plugins including every Draft-07 format (25 directories) (plugins)

- Depends on: 17
- Produces:
  - `src/plugins/string-min/**`
  - `src/plugins/string-max/**`
  - `src/plugins/string-exact-length/**`
  - `src/plugins/string-pattern/**`
  - `src/plugins/string-email/**`
  - `src/plugins/string-url/**`
  - `src/plugins/uuid/**`
  - `src/plugins/string-date/**`
  - `src/plugins/string-datetime/**`
  - `src/plugins/string-time/**`
  - `src/plugins/string-duration/**`
  - `src/plugins/string-ipv4/**`
  - `src/plugins/string-ipv6/**`
  - `src/plugins/string-hostname/**`
  - `src/plugins/string-base64/**`
  - `src/plugins/string-json-pointer/**`
  - `src/plugins/string-relative-json-pointer/**`
  - `src/plugins/string-iri/**`
  - `src/plugins/string-iri-reference/**`
  - `src/plugins/string-uri-template/**`
  - `src/plugins/string-content-encoding/**`
  - `src/plugins/string-content-media-type/**`
  - `src/plugins/string-alphanumeric/**`
  - `src/plugins/string-starts-with/**`
  - `src/plugins/string-ends-with/**`
  - `test/unit/plugins/string/**`
- Verified by: Per-plugin boundary tables plus three global unifications: wrong-typed values pass through, options.code and options.messageFactory are accepted everywhere, one message path-prefixing convention. String length is UTF-16 .length. stringPattern accepts only a RegExp and is stateless across calls. Base64 decoding exists in exactly ONE plugin (string-content-encoding); string-content-media-type only recognises signatures. The directory is `uuid`, not `string-uuid`, and ./plugins/uuid needs no subpath override. Any plugin over 200 lines splits into named private modules INSIDE its own directory; the file-count is unconstrained, the directory count is not.

### 20. Number and boolean plugins (10 directories) (plugins)

- Depends on: 17
- Produces:
  - `src/plugins/number-min/**`
  - `src/plugins/number-max/**`
  - `src/plugins/number-integer/**`
  - `src/plugins/number-positive/**`
  - `src/plugins/number-negative/**`
  - `src/plugins/number-finite/**`
  - `src/plugins/number-multiple-of/**`
  - `src/plugins/number-range/**`
  - `src/plugins/boolean-truthy/**`
  - `src/plugins/boolean-falsy/**`
  - `test/unit/plugins/number-boolean/**`
- Verified by: Boundaries inclusive; numberMin/Max carry the `exclusive` option that expresses exclusiveMinimum/Maximum; positive rejects 0 and -0; multipleOf uses scaled-integer comparison so multipleOf(0.1) accepts 0.3; numberRange throws PluginArgumentError at build time on min>max or NaN.

### 21. Array, object, tuple, union and conditional plugins, including every composite (17 directories) (plugins)

- Depends on: 17
- Produces:
  - `src/plugins/array-min-length/**`
  - `src/plugins/array-max-length/**`
  - `src/plugins/array-unique/**`
  - `src/plugins/array-includes/**`
  - `src/plugins/array-contains/**`
  - `src/plugins/object/**`
  - `src/plugins/object-min-properties/**`
  - `src/plugins/object-max-properties/**`
  - `src/plugins/object-additional-properties/**`
  - `src/plugins/object-property-names/**`
  - `src/plugins/object-pattern-properties/**`
  - `src/plugins/object-dependent-required/**`
  - `src/plugins/object-dependent-schemas/**`
  - `src/plugins/object-recursively/**`
  - `src/plugins/conditional-schema/**`
  - `src/plugins/tuple-builder/**`
  - `src/plugins/union-guard/**`
  - `test/unit/plugins/collection/**`
- Verified by: Every composite plugin declares branches and a combine and contains NO traversal loop; grep proves no plugin calls rule.run directly. tupleBuilder is positional with an optional rest branch and fits one file. arrayContains counts matches against min/max. objectPatternProperties applies EVERY matching pattern (the legacy break-after-first was non-conformant). objectAdditionalProperties defaults to ctx.declaredSiblingKeys and an explicit allowedProperties wins. objectRecursively terminates on cycles and at maxDepth and contains zero execution logic. conditionalSchema is a three-branch composite and carries NO private schema evaluator - its optional then/otherwise arguments arrive resolved, never as markers. unionGuard builds and runs. arrayUnique uses one equality definition at every length. grid[*][*] yields issues at grid[0][2].

### 22. Relational, contextual, transform and access plugins, with exactly one stitch (6 directories) (plugins)

- Depends on: 17
- Produces:
  - `src/plugins/compare-field/**`
  - `src/plugins/stitch/**`
  - `src/plugins/transform/**`
  - `src/plugins/from-context/**`
  - `src/plugins/read-only/**`
  - `src/plugins/write-only/**`
  - `test/unit/plugins/relational/**`
- Verified by: compareField accepts a FieldPath plus a following plain argument through a mixed marker tuple. stitch is ONE plugin merging three legacy implementations (stitch, stitch-typed, stitchSimple); it types fieldValues per declared path via PickPaths, and a test covers the untyped call shape the merged plugin must still accept. transform output propagates to parse() and not to validate(). readOnly and writeOnly are two directories, two symbols and two subpaths. fromContext reads RuleContext.external. Uses no plugin from steps 18-21, so it is a peer of them.

### 23. PLUGINS STAGE VERIFY GATE: integrate the catalog, regenerate every derived artifact once, npm run verify green (plugins)

- Depends on: 18, 19, 20, 21, 22
- Produces:
  - `scripts/check-plugin-uniqueness.ts`
  - `test/integration/plugin-catalog.test.ts`
  - `docs/migration/plugins.md`
- Verified by: `npm run generate` runs once here and the two TRACKED derived artifacts (package.json#/exports, config/plugin-catalog.lock.json) are committed in this step alone; the four untracked ones stay git-ignored. check-plugin-uniqueness greps src/plugins for a repeated plugin name and for a repeated chain method within one slot - this is where 'exactly one stitch' and 'no method collision across 69 plugins' are proved, because no single plugin branch can see its siblings. check-catalog-lock records 69 isolated directories; no acceptance condition anywhere contains a hard-coded count. check-plugin-isolation is green over all 69. A scratch consumer resolves every generated subpath under node16 and bundler. Full `npm run verify` exits 0.

### 24. JSON Schema foundations: Draft-07 types, keyword value types, the binding types, split keyword tables, format map, $ref resolver (json-schema)

- Depends on: 23
- Produces:
  - `src/json-schema/draft07.types.ts`
  - `src/json-schema/draft07-keyword-value.types.ts`
  - `src/json-schema/keyword-binding.types.ts`
  - `src/json-schema/apply-keyword-binding.ts`
  - `src/json-schema/unsupported-keyword-error.ts`
  - `src/json-schema/format-map.ts`
  - `src/json-schema/keyword-map-core.ts`
  - `src/json-schema/keyword-map-string.ts`
  - `src/json-schema/keyword-map-number.ts`
  - `src/json-schema/keyword-map-array.ts`
  - `src/json-schema/keyword-map-object.ts`
  - `src/json-schema/keyword-map.ts`
  - `src/json-schema/resolve-ref.ts`
  - `test/unit/json-schema/core/**`
  - `test/type/json-schema/**`
- Verified by: A binding can only be produced by bindKeyword(slot, pluginObject, toArguments), so `KeywordBinding<"array", "minItems", number>` is a compile error and the Draft-07 spelling can never be mistaken for a chain method name - @ts-expect-error proves it. A plugin that does not serve the slot, a toArguments of wrong arity or wrong element type, and a marker-carrying plugin are each rejected. `keyof Draft07KeywordValues === Draft07Keyword` is asserted, so a keyword cannot lose its value type. Each map is annotated `Record<CategoryKeyword, KeywordHandlingFor<value>>`, making a missing keyword and an out-of-vocabulary keyword both compile errors. applyKeywordBinding compiles with NO cast, and one type test asserts ConverterChain<S> is a faithful slice of the real FieldChain for marker-free methods. Each format maps to exactly one plugin and no format has a second regex anywhere in src. $ref resolves #/definitions and #/$defs, detects cycles, rejects external refs.

### 25. JSON Schema conversion: flatten, compose keywords, compose conditional, declare keywords, build from schema (json-schema)

- Depends on: 24
- Produces:
  - `src/json-schema/index.ts`
  - `src/json-schema/flatten-schema.ts`
  - `src/json-schema/flatten-array-schema.ts`
  - `src/json-schema/collect-definitions.ts`
  - `src/json-schema/compose-keyword.ts`
  - `src/json-schema/compose-conditional.ts`
  - `src/json-schema/declare-scalar-keywords.ts`
  - `src/json-schema/declare-object-keywords.ts`
  - `src/json-schema/schema-to-declarations.ts`
  - `src/json-schema/build-from-schema.ts`
  - `test/unit/json-schema/convert/**`
- Verified by: allOf / anyOf / oneOf / not / if-then-else are all ONE composite kind built from create-rule alone; compose-conditional builds the SAME rule the conditionalSchema plugin builds, so there is one implementation with two front doors and the legacy private evaluator is gone (grep proves no second schema interpreter exists in src). fromJsonSchema<T>() lets the caller supply a type; the default is Record<string, unknown>, never any, and the docs state plainly that the default gives no path checking. An unsupported keyword throws UnsupportedKeywordError naming the keyword and the missing plugin. Every module is under 200 lines.

### 26. The two extension-tier bundle plugins and the conformance corpus (json-schema)

- Depends on: 25
- Produces:
  - `src/json-schema/extensions/json-schema/**`
  - `src/json-schema/extensions/json-schema-full-feature/**`
  - `.gitmodules`
  - `config/json-schema-suite.json`
  - `test/json-schema/suite-skip-list.ts`
  - `test/integration/json-schema-suite.test.ts`
- Verified by: The full-feature plugin's use() list is a GENERATED file inside its own directory, derived from the keyword map by listBoundPluginNames(), so it cannot name a plugin that is not bound. Both plugins are tier `extension`; check-plugin-isolation allows json-schema and plugin-ENTRY imports there and forbids chain/compile/runtime/builder, and the two `isolated`-tier assertions (a sibling plugin import, a json-schema import) still fail for the other 69. Public subpaths ./plugins/jsonSchema and ./plugins/jsonSchemaFullFeature resolve unchanged. The suite is a pinned git submodule at test/fixtures/json-schema-suite; the published pass rate is the acceptance number, the typed skip list is the only permitted exclusion, findStaleSkips fails the build when a skipped case starts passing, and check-suite-pin fails when the SHA moves without a skip-list change.

### 27. JSON SCHEMA STAGE VERIFY GATE: npm run verify green with 71 plugins and the conformance number published (json-schema)

- Depends on: 26
- Produces:
  - `docs/json-schema-conformance.md`
  - `test/type/public-surface/json-schema.type-test.ts`
- Verified by: `npm run generate` runs the second and last time before release: the two extension plugins enter package.json#/exports, config/plugin-catalog.lock.json is updated to 71 plugins / 72 plugin subpaths / 78 total export keys and reviewed in this commit. Exclude<LegacyPublicSubpath, PluginSubpath | AliasSubpath> is asserted never, so none of the 57 published 1.x subpaths is lost. The measured suite pass rate is written to docs/json-schema-conformance.md and must exceed the legacy baseline (legacy fails 32 of 42 fromJsonSchema integration tests). Full `npm run verify` exits 0.

### 28. Distribution gates over the build authored in step 1 (release)

- Depends on: 27
- Produces:
  - `scripts/check-no-dynamic-code.ts`
  - `scripts/check-dist-layout.ts`
  - `test/dist/**`
- Verified by: grep of dist for eval and new Function is zero. Every dist/plugins/*/index.mjs imports ../../plugin-kit, so a plugin bundle that inlined the core fails. Declaration emit preserves the @luq-plugin comments and a declaration error fails the build instead of being swallowed. `files` publishes only public artifacts - no test/, no bench/, no type-tests. Adds only new gate files; scripts/build.ts is not re-authored.

### 29. Bundle size budgets and barrel equivalence (release)

- Depends on: 28
- Produces:
  - `scripts/measure-bundle-size.ts`
  - `scripts/check-barrel-equivalence.ts`
  - `config/size-budget.json`
- Verified by: Core-only, six-plugin and full-feature gzip figures live in config/size-budget.json and the core-only figure is published next to the composed one. Three plugins imported from ./plugins gzip within five percent of three deep subpaths. These two scripts have exactly one author.

### 30. Benchmark harness: absolute figures recorded, CI gated on an in-process ratio (release)

- Depends on: 27
- Produces:
  - `bench/**`
  - `scripts/run-bench.ts`
  - `config/perf-baseline.json`
- Verified by: Fixed schema definitions; abortEarly documented; validate and parse measured separately on both the simple and the complex shape. CI gates on luq_ops / reference_ops measured back to back in the SAME process (floors calibrated from the first real run, not from a guess), because an absolute ops/sec gate on a shared runner flakes unconditionally. Absolute figures go to config/perf-baseline.json on a named machine and every published number is read from that file, never typed into prose. Runs in parallel with steps 28-29.

### 31. Documentation, migration guide and example typechecking (release)

- Depends on: 29, 30
- Produces:
  - `README.md`
  - `docs/guide/**`
  - `docs/migration/breaking-changes.md`
  - `scripts/generate-docs.ts`
  - `scripts/check-doc-examples.ts`
- Verified by: Every code example in README and docs/ is extracted and typechecked against the BUILT package, so a doc example that no longer compiles fails CI. The migration guide lists every breaking change with its fix: `items.name` -> `items[*].name`; `a.*.b` removed; `tags.length` removed (use arrayMinLength/arrayMaxLength); no paths into Date/RegExp/Map/Set/Promise/function internals; a slot unrelated to the field type is now an error; .required() now narrows out null as well as undefined; stitchSimple/stitchTyped merged into stitch; readOnlyWriteOnlyPlugin renamed readOnlyPlugin (subpath kept as a deprecated alias); tupleBuilder's argument shape changed. The plugin-author guide documents 9 argument markers and 4 output marker types, and states that `out` constrains build's return type.

### 32. RELEASE STAGE VERIFY GATE: every gate green, catalog reviewed, publish dry-run (release)

- Depends on: 28, 29, 30, 31
- Produces:
  - `docs/release-checklist.md`
  - `test/type/public-surface/release.type-test.ts`
- Verified by: Full `npm run verify` plus every gate (check-exports --mode=exact, check-catalog-lock, check-plugin-isolation, check-plugin-uniqueness, check-no-dynamic-code, check-dist-layout, check-barrel-equivalence, check-doc-examples, check-doc-imports, check-suite-pin, check-contract-arity, check-module-has-test) exits 0. `npm pack` produces a tarball whose 78 export keys all resolve from a scratch consumer under node16 and bundler, including all 57 legacy subpaths. Published performance and size numbers are read from config/perf-baseline.json and config/size-budget.json.

