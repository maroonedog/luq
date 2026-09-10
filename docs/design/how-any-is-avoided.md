# How the types are made to work without `any`

Where the previous implementation reached for `any`, and how this design
resolves each of those points. The diagnosis of the previous implementation is
in [../legacy-spec/anti-patterns.md](../legacy-spec/anti-patterns.md).

Verified by compiling, not asserted. `grep -nE "as any|: any|any\[\]|@ts-ignore|\bFunction\b"` over the whole confirmed type set returns nothing, and the set compiles under `--strict --noUncheckedIndexedAccess --noImplicitOverride --noFallthroughCasesInSwitch --noUnusedLocals` with exit 0.

The five places a validation library normally reaches for `any`, and what replaces each:

1. THE ARGUMENT BOUNDARY (chain call site vs plugin build body). This is where the old implementation used `as any` on every marker plugin. Replaced by TWO resolvers over ONE registry: `ResolveArgs` (L3, knows TRoot/TValue/TState/bag) and `RuntimeArgs` (L2, root-agnostic). `plugin.build(ctx, ...resolvedArgs)` in the chain node needs no cast because `RuntimeArgs<readonly unknown[]>` collapses to exactly `readonly unknown[]`. The two resolvers cannot drift: `src/chain/marker-coverage.types.ts` probes every entry of `ArgumentMarkerRegistry`/`OutputMarkerRegistry` through both and feeds the unresolved kinds into `AssertNever<T extends never>`. Proved by experiment: adding a marker handled in neither resolver gives two errors naming it; handling it in one leaves exactly one.

2. THE PLUGIN COLLECTION (`AnyPlugin`, `PluginBag`). `AnyPlugin` is `PluginDefinition<string, string, readonly TypeName[], PluginSignature>` with `TOut = unknown`, so presence, transform and guard plugins are members without a cast. `build` is declared as a METHOD, keeping its parameters bivariant, which is what lets a plugin whose `RuleBuildContext<{min;actual}>` is narrower than `RuleBuildContext<object>` still be an `AnyPlugin`. Nothing anywhere is typed `Record<string, any>`.

3. THE MESSAGE PATH. A plugin declares `context: { min: number; actual: number }` and supplies `buildMessageContext(detail): C`, so `MessageFactory<C>` is applied to a value the plugin itself constructed. Without this the user's typed factory could only be reached by a cast (contravariance: `object` is not assignable to `{min;actual}`).

4. UNKNOWN INPUT. Every runtime entry point takes `unknown`, never `any`. The four narrowing guards (`isString`, `isNumber`, `isArray`, `isPlainObject`) live in L0 and are the only way a rule reads a value. `CheckOutcome` is a discriminated union on `ok`; `Rule` is a six-member union discriminated on `kind` with a `never`-check in `splitRulesByKind`; `ValidationResult` is discriminated on `valid`, so `data` is unreachable on the failure branch.

5. ERROR-SHAPED RESULTS. Where a type-level failure must be reported, the answer is a named error OBJECT, never `never` and never `any`: `SlotTypeMismatch<S, TField>`, `UnionGuardCoverageError<TPath, TUncovered>`, `MissingFieldsError<TMissing>`. The IDE shows the reason.

Callable types use `(...args: never[]) => unknown` and `abstract new (...args: never[]) => unknown` (inside `OpaqueObject`), never the banned `Function`.

`src/core/type-erasure.ts` remains the ONE file permitted a suppression, and its budget shrank: the design assumed the `plugin.build(...)` call site needed it and that turned out to be false. Its remaining job is producing the chain node object (an object literal that must satisfy a mapped type keyed by `SlotPlugins`) and the copy-on-write output writer. Everything else in `src/` is cast-free, and CI greps for exactly one suppression file.

Test code is held to the same bar: `any` is never written literally even in type tests — `ReturnType<typeof JSON.parse>` supplies one where an `IsAny` assertion needs it, so `test/` needs no eslint exemption.
