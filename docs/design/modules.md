# The module list (settled)

Every module stays inside 200 lines. Going over is the sign of a second responsibility.

| Path | Operation | Single responsibility | Estimated lines |
|---|---|---|---|
| `src/` | remove | The entire 1.x implementation is deleted before step 2 of the core stage. Nothing is carried over as code; the public API surface is carried over as a contract (docs/legacy-public-surface.md) and as the 57 legacy subpaths pinned in a compile-checked list. | 0 |
| `src/types/index.ts` | add | Re-exports the five L0 vocabulary modules. No logic. | 12 |
| `src/types/type-name.ts` | add | The nine slot names and nothing else. | 14 |
| `src/types/message-context.ts` | add | MessageContext, MessageContextExtra, MessageFactory, RuleOptions. | 30 |
| `src/types/validation-issue.ts` | add | ValidationIssue, IssueSeverity, ValidationResult and its two branches, GlobalConfig. | 55 |
| `src/types/check-outcome.ts` | add | IssueDetail, CheckOutcome, PASS, fail, RuleContext, ArrayItemContext. | 50 |
| `src/types/presence-state.ts` | add | PresenceState and Present<T,S>. OpenState is NOT here; it moved to L3 when it gained a chain-specific member. | 22 |
| `src/types/type-guard.ts` | add | The four narrowing guards every rule uses to read an unknown value. | 20 |
| `src/result/index.ts` | add | The ./result subpath: ok(), reject(), the frozen EMPTY_ISSUES singleton and ValidationFailure (an Error carrying issues). | 70 |
| `src/path/path-depth.types.ts` | add | The single recursion budget and its countdown table. | 10 |
| `src/path/opaque-object.types.ts` | add | The closed list of built-ins a path must not descend into, read by both path directions. | 28 |
| `src/path/element-of.types.ts` | add | The only array-unwrapping rule, distributing over unions. | 14 |
| `src/path/path-segment.types.ts` | add | Segment vocabulary, ParsePath, IsWellFormedPath, and the runtime PathSegment shape. | 50 |
| `src/path/field-path.types.ts` | add | Generates the union of legal path literals for T. | 45 |
| `src/path/value-at-path.types.ts` | add | Resolves a path literal to its value type; also hosts PickPaths. | 55 |
| `src/path/leaf-path.types.ts` | add | Generates only terminal paths, and MissingLeafPaths for .strict(). | 75 |
| `src/path/parse-field-path.ts` | add | The runtime parser producing PathSegment[], plus parentFieldPath and leafKeyOf. Rejects __proto__/constructor/prototype and dotted keys. | 95 |
| `src/path/create-value-reader.ts` | add | Compiles a segment template into a monomorphic reader closure. | 70 |
| `src/path/create-array-reader.ts` | add | The reader for an array node's own path. | 45 |
| `src/path/create-value-writer.ts` | add | Copy-on-write writer used only when a field has a transform or a default. | 90 |
| `src/path/format-issue-path.ts` | add | Renders a concrete index stack into `items[0].name`. | 35 |
| `src/path/match-path-pattern.ts` | add | Matches a concrete path against an `items[*].n` template. | 45 |
| `src/plugin-kit/marker.types.ts` | add | The closed marker vocabulary: 9 argument markers, 4 output marker types, and the two registries every resolver is proved against. | 110 |
| `src/plugin-kit/marker-registry.types.ts` | add | Split out of marker.types.ts to stay under 200 with JSDoc: the two registries, BrandOf, MarkerRegistryProof, IsMarkerFree. | 75 |
| `src/plugin-kit/compiled-rule.ts` | add | The six-member Rule union. Check/presence/gate/transform/recursive. | 120 |
| `src/plugin-kit/composite-branch.types.ts` | add | Split out of compiled-rule.ts: BranchField, CompositeBranch, BranchRunner, CompositeExecute, CompositeCombine, CompositeRule. Imports Rule as a type, so the mutual reference is fine. | 80 |
| `src/plugin-kit/runtime-args.types.ts` | add | The build-side marker resolver and RuleForOut. Root-agnostic. | 95 |
| `src/plugin-kit/rule-build-context.ts` | add | What a plugin is handed at declaration time, plus renderMessage. | 55 |
| `src/plugin-kit/plugin-definition.ts` | add | PluginSignature, PluginDefinition, AnyPlugin, definePlugin, PluginArgs/PluginOut, PluginArgumentError. | 120 |
| `src/plugin-kit/create-rule.ts` | add | The six rule constructors plus branch()/fieldsBranch(). The only sanctioned way to make a Rule. | 175 |
| `src/plugin-kit/index.ts` | add | The ./plugin-kit public subpath: everything a plugin author may import. | 45 |
| `src/chain/plugin-bag.types.ts` | add | PluginBag, BagEntry, SlotPlugins. Deliberately no AddToBag alias (14x instantiation cost). | 30 |
| `src/chain/chain-state.types.ts` | add | ChainState (presence + guard coverage), OpenState, the five named state operators, UncoveredMembers, UnionGuardCoverageError. | 85 |
| `src/chain/slot-value.types.ts` | add | SlotAccepts, SlotValue, SlotTypeMismatch: whether and how a declared field type flows through a slot. | 40 |
| `src/chain/resolve-args.types.ts` | add | The call-site marker resolver and ResolveOut. | 105 |
| `src/chain/chain-method.types.ts` | add | One plugin definition to one call signature: transform, guard, everything else. | 60 |
| `src/chain/field-chain.types.ts` | add | FieldChain, the required ChainMarks phantom, AnyChain, ChainOutput, ChainStateOf. | 50 |
| `src/chain/field-slots.types.ts` | add | The nine entry points on `b`. | 40 |
| `src/chain/marker-coverage.types.ts` | add | Types only, zero runtime bytes: proves both resolvers exhaustive against the registries. | 95 |
| `src/core/type-erasure.ts` | add | The ONE file permitted a suppression: builds the chain-node object that must satisfy a SlotPlugins-keyed mapped type. Its budget shrank because the build() call site turned out cast-free. | 55 |
| `src/chain/attach-slot-methods.ts` | add | Installs one method per plugin serving a slot; throws PluginMethodCollisionError naming both plugins on a clash. | 95 |
| `src/chain/create-chain-node.ts` | add | Immutable chain node: records one rule and returns a new node. | 85 |
| `src/chain/create-field-slots.ts` | add | Builds the runtime `b` object for a bag and a field. | 60 |
| `src/chain/collect-field-rules.ts` | add | Runs the user's field callback exactly once and returns rules in declaration order. | 70 |
| `src/chain/collect-branch-rules.ts` | add | Runs a sub-chain callback (ElementChain / NarrowedChain) exactly once and hands the plugin a frozen Rule[]. This is where the eager-resolution invariant lives. | 65 |
| `src/compile/validation-plan.types.ts` | add | The plan shape: CompiledField, CompiledCheck, PresencePolicy, PlanRef, RecursionPolicy, ArrayNode, ValidationPlan, FieldDeclaration. | 100 |
| `src/compile/branch-executor.port.ts` | add | The L4->L5 inversion port. 15 lines including JSDoc. | 20 |
| `src/compile/declared-child-keys.ts` | add | Indexes declared child keys per parent path from path STRINGS and freezes each array; fills RuleBuildContext.declaredSiblingKeys. | 80 |
| `src/compile/resolve-presence.ts` | add | Merges every PresenceRule on a field into one order-independent policy. | 60 |
| `src/compile/split-rules-by-kind.ts` | add | Separates a rule list by kind with a never-check over all six kinds. | 65 |
| `src/compile/resolve-recursion.ts` | add | Turns a RecursiveRule plus a PlanRef into a RecursionPolicy. | 30 |
| `src/compile/compile-composite.ts` | add | Compiles each branch to a nested plan, wraps them as BranchRunners, calls combine ONCE, returns a plain CompiledCheck. | 95 |
| `src/compile/compile-field.ts` | add | One declaration to one CompiledField. | 90 |
| `src/compile/group-array-fields.ts` | add | Loop interchange: groups field declarations sharing an array prefix. | 110 |
| `src/compile/compile-array-node.ts` | add | Builds one ArrayNode and its nested nodes. | 85 |
| `src/compile/compile-schema.ts` | add | Assembles the plan, back-patching the PlanRef so a self-referential plan needs no cast. | 90 |
| `src/runtime/issue-sink.ts` | add | Accumulates issues with the abortEarly decision in one place. | 60 |
| `src/runtime/index-stack.ts` | add | The array index stack used to render a concrete issue path. | 45 |
| `src/runtime/create-issue.ts` | add | Builds one ValidationIssue from a code, a detail and a path. | 55 |
| `src/runtime/run-field.ts` | add | Presence, gates, checks, transforms, then recursion, for one field. | 120 |
| `src/runtime/run-array-node.ts` | add | Reads the array once and runs every element field per element. | 95 |
| `src/runtime/run-branch.ts` | add | The BranchExecutor implementation: one nested runPlan call, issues returned as causes. | 45 |
| `src/runtime/run-recursion.ts` | add | Re-enters runPlan with a depth counter and a WeakSet cycle guard. | 85 |
| `src/runtime/output-writer.ts` | add | Copy-on-write output construction, skipped entirely when hasTransforms is false. | 90 |
| `src/runtime/run-plan.ts` | add | The one and only engine loop. | 110 |
| `src/runtime/create-validator.ts` | add | Turns a plan into the validate/parse pair. | 95 |
| `src/builder/create-field-builder.ts` | add | Accumulates declarations, calls compileSchema with the branch executor, returns the validator. | 130 |
| `src/builder/field-builder.types.ts` | add | Builder, FieldBuilder, .v()'s coverage-conditional return, .strict()'s MissingFieldsError, Validator. | 80 |
| `src/index.ts` | add | The single public entry point. Authored by the builder step and by no other step. | 40 |
| `src/field-rule/index.ts` | add | createPluginRegistry / createFieldRule / useField on the same engine. | 150 |
| `src/async/index.ts` | add | Pre-resolves an external context map, then calls the ordinary validate(). No rule executes here. | 110 |
| `src/plugins/<69 directories>/` | add | One plugin each, tier `isolated`. A directory holds index.ts (one re-export), <kebab>.ts (the only file allowed to call definePlugin), <kebab>.types.ts, and any number of additional kebab-named private modules named for their responsibility. | 95 |
| `src/plugins/conditional-schema/` | add | if/then/else as a three-branch composite. Had no destination in the previous build order; its legacy private schema evaluator is deleted. | 130 |
| `src/plugins/stitch/` | add | The single stitch. Merges three legacy implementations (stitch, stitch-typed, stitchSimple) into one plugin whose typed-path form is the primary shape. | 190 |
| `src/plugins/read-only/` | add | readOnly. Split out of the legacy readOnlyWriteOnly file; symbol renamed readOnlyPlugin. | 70 |
| `src/plugins/write-only/` | add | writeOnly. Its own directory and its own subpath. | 70 |
| `src/plugins/uuid/` | add | uuid. The proposed rename to string-uuid is reverted: directory, subpath, symbol and method all stay `uuid`. | 80 |
| `src/plugins/tuple-builder/` | add | Positional composite: branch i applies to element i, with an optional rest branch. 236 legacy lines become ~115 because branch execution moved into the engine. | 115 |
| `src/plugins/string-content-media-type/` | add | Two files: the definition plus media-type-signature.ts (the recognizer table). Base64 decoding is deleted here; stringContentEncoding owns it. | 120 |
| `src/json-schema/extensions/json-schema/` | rename | The jsonSchema bundle plugin, tier `extension`, physically at L8. Public subpath ./plugins/jsonSchema is unchanged. | 120 |
| `src/json-schema/extensions/json-schema-full-feature/` | rename | The full-feature bundle plus its GENERATED use() list, which imports plugin entry files - legal only at tier extension. | 140 |
| `src/json-schema/keyword-binding.types.ts` | add | BoundMethod/BoundPlugin/BindableMethod/KeywordBinding/bindKeyword: a keyword can only be bound to a method that exists on a marker-free plugin. | 150 |
| `src/json-schema/apply-keyword-binding.ts` | add | ConverterChain plus the cast-free application of one binding. | 55 |
| `src/json-schema/keyword-map-{core,string,number,array,object}.ts` | add | One exhaustive per-category table; a missing or out-of-vocabulary keyword is a compile error. | 120 |
| `src/json-schema/compose-keyword.ts` | add | allOf / anyOf / oneOf / not as composites, built from create-rule only. | 150 |
| `src/json-schema/compose-conditional.ts` | add | if/then/else, split out of compose-keyword to stay under 200. Same rule the conditionalSchema plugin builds: one implementation, two front doors. | 95 |
| `src/json-schema/schema-to-declarations.ts` | add | Orchestrates conversion; delegates to declare-scalar-keywords.ts and declare-object-keywords.ts. | 140 |
| `src/json-schema/resolve-ref.ts` | add | #/definitions and #/$defs, cycle detection, external refs rejected. | 130 |
| `src/subpath-aliases/read-only-write-only.ts` | add | Generated compat re-export for the legacy ./plugins/readOnlyWriteOnly subpath. Deprecated at 2.0. Must be excluded from the plugin-directory scan. | 15 |
| `scripts/generate-plugin-manifest.ts` | add | Reads the plugin directories and emits src/plugins/manifest.generated.ts (git-ignored). | 120 |
| `scripts/generate-package-exports.ts` | add | Rewrites the single JSON pointer package.json#/exports, preserving every other field byte for byte. | 130 |
| `scripts/check-plugin-isolation.ts` | add | Classifies every import from a plugin file into a closed area set and fails on anything the tier does not allow. Must not treat src/json-schema/** outside extensions/ as a plugin directory. | 180 |
| `scripts/check-catalog-lock.ts` | add | Compares the live directory count and subpath list against config/plugin-catalog.lock.json. Replaces every hard-coded plugin count in CI. | 90 |
| `scripts/check-module-has-test.ts` | add | Fails when any src module (excluding index.ts and *.types.ts) has no sibling unit test. The structural replacement for a coverage gate. | 80 |
| `scripts/check-suite-pin.ts` | add | Fails when the JSON-Schema-Test-Suite pin moved without a matching skip-list change. | 70 |
| `bench/measure-throughput-ratio.ts` | add | Measures luq against an in-process hand-written reference and gates on the RATIO, so a shared CI runner's speed cancels out. | 140 |

No module is over the line limit.
