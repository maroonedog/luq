# anti-patterns

The collapse has a single identifiable origin.
`TypedPlugin<TName, TMethodName, TMethod extends Function, ...>`
(`src/core/builder/plugins/plugin-types.ts:63-76`) took a plugin's method
implementation as `Function`, a type carrying no information. Neither the
argument tuple nor the return type was kept, so building the builder chain's
types meant **reconstructing what had been thrown away**. That reconstruction is
`MapPluginMethodsToChainable` / `InferChainableReturnType` /
`GetPluginCategoryByMethod` / `ApplyTypesToMethod` (lines 288-640 of the same
file) — a vast chain of conditional types branching on a `category` string, and
roughly 900 of that file's 1482 lines go to it. `InferMethodParameters` then
does `GetPluginMethodByName<TPlugins, TMethodName> extends (...args: infer P) => any ? P : never`,
which is inferring from `Function` all over again: the loss of `TMethod` is
never recovered.

Because of that, the run-time side could not connect to the types at all.
`createChainableBuilder` assembles `const builder: any = {}` and lies at the end
with `as IChainableBuilder<...>` (`builder.ts:25,101`).
`createOptimizedTypeBuilder` assigns plugin methods dynamically onto a
`Record<string, unknown>` and casts to `ChainableFieldBuilder<...>`
(`field-context.ts:180,303`). Types and runtime became two separate ledgers, no
layer could check its neighbour, and `any` propagated. Of the 1365 occurrences
of `any`, the distribution — 116 in validator-factory.ts, 90 in
unified-validator.ts, 77 in plugin-interfaces.ts, 66 in types/types.ts — sits
exactly on that boundary.

The 2882-line validator-factory.ts has the same root. With the types not
helping, whether a field is optional is discovered at run time by string
comparison, `built._validators.some(v => v.name === "optional")`
(`validator-factory.ts:106,109,1852,1856`), and on failure swallowed by a
`catch (e)` that assumes false (`112-115`). And because every "fast path" was
added as a whole new execution engine, validate splits into three top-level
routes — `createRawValidator`, `createUltraFastExecutorValidator`,
`createValidatorExecutor` (`471,578,595`) — with four more beneath them for a
single field: `createUltraFastValidator`, `createOptimizedTransformValidator`,
`executeFastSeparated`, `executeDefinitionOrder`
(`unified-validator.ts:661,912,514,218`). Seven implementations.

And the `selectOptimalStrategies` that decides between them hands every field
the same analysis (`execution-strategy-selector.ts:33-37`, whose own comment
reads "TODO: Support per-field strategy analysis"), so the fast/slow split does
essentially nothing. The 583 lines of strategy-factory.ts and the 763 of
validation-engine.ts exist for that spinning wheel, and validation-engine.ts's
only referrer, array-batch-validator.ts, is itself unreferenced — so
substantially all of it is dead.

"The same responsibility implemented two or three times", measured: field
accessor generation has three implementations
(`src/core/plugin/utils/field-accessor.ts`, `field-accessor-optimized.ts` and
`src/core/optimization/core/field-utils.ts`, each duplicating
`createFieldAccessor`, `createFieldSetter`, `createNestedValueAccessor` and
`createBatchAccessors`) plus a local fourth inside validator-factory.ts
(`1791,1871,1897`). Path parsing has seven: `parseFieldPath` twice,
`parseArrayElementPath`, `validateArrayElementPath`, `analyzeArrayField`,
`getPathSegments` and `normalizeFieldPath`. `ValidationError` has four mutually
incompatible definitions (`src/types/index.ts:25`,
`src/core/builder/types/types.ts:201`,
`src/core/optimization/core/validation-engine.ts:7`,
`src/core/plugin/jsonSchema/types.ts:71`). `ValidationFunction` has two, a typed
one in `src/core/plugin/types.ts:88` and `(value: any, ctx) => {valid}` in
`src/core/builder/types/types.ts:208`. `ValidationResult` has three.
`createValidationError` has three. There are three barrels — `src/index.ts`,
`src/core/index.ts`, `src/core/plugin/index.ts` — exporting three different
sets.

The heaviest contradiction is that the stated principles are betrayed in the
shipped code. "CSP-safe: never eval, never new Function" stands alongside code
generation with `new Function` at `src/types/array-type-analysis.ts:196`,
actually called from line 309 of the same file. "Per-plugin tree-shaking"
stands alongside a core `createValidationError` that hard-codes
`validator.pluginName === "stringStartsWith" | "stringEndsWith" | "stringMin" | "stringMax" | "arrayMaxLength" | "arrayMinLength"`
(`src/core/optimization/unified-validator.ts:1298-1330`); the moment the core
knows individual plugins by name, plugins are not independent modules.
`extractPluginCalls` (`strategy-factory.ts:530-541`) scans
`builderFunction.toString()` with a regular expression to guess which plugins a
user's builder function uses, which breaks under minification. And
`validator-factory.ts:462-464` switches behaviour on
`process.env.LUQ_ULTRA_FAST` and `(global as any).__LUQ_ULTRA_FAST__`, throwing
in a plain browser bundle where `process` is undefined.

Several things break correctness outright.
`src/core/builder/ultra-fast-validator.ts:12-13` shares module-level mutable
objects `SUCCESS_RESULT` / `ERROR_RESULT` across every call, so a second
`validate` overwrites the first one's return value. `src/types/result.ts` builds
`Result.ok` from a `successProto` where `errors` is a **method** (line 208) and
`Result.error` from a `createResult` object literal where `errors` is a
**getter** (line 335), so the success branch does not satisfy the
`readonly errors: ValidationError[]` its own interface declares (line 148).
`src/core/builder/plugins/composable-plugin.ts:108-113` writes
`for (let i = 0; i < transforms.length; i++) { if (!validators[i].check(...)) }`,
iterating `validators` by the length of `transforms`. And `paths(): string[]`,
required by the published `ValidationError`, is hand-generated in around twenty
places (array-batch-optimizer.ts, nested-array-processor.ts, raw-validator.ts,
validator-factory.ts and others) with **not one call site** anywhere in src or
test — pure dead weight that returns `[""]`, `[path]` or `path.split('.')`
depending on the implementation.

`tsconfig.json` sets `"strict": true` and then, immediately below it, sets
noImplicitAny, strictNullChecks, strictFunctionTypes,
strictPropertyInitialization, noImplicitThis and noImplicitReturns all to false
— and `exclude`s `src/core/async.experimental/**/*`, taking four files and
roughly 800 lines out of type checking entirely. 33 files are over 200 lines,
the largest 2882. Thirteen modules are entirely unreferenced: three under
async.experimental, plus field-type-detector, array-batch-validator,
conditionalSchema, message-factories, shared, stitch-typed, stitchSimple,
`__tests__/test-utils`, `src/core/registry.ts` and `types/indexed-result.ts`.

The behavioural rules below are the substance of this document: prohibitions in
the form "when X, do not do Y; do Z instead".

## Contracts to preserve (13)

### must-preserve (7)

#### Builder().use(plugin).for<T>().v(path, fn).build()
- Source: `src/core/builder/core/builder.ts, src/core/builder/core/field-builder.ts, src/core/builder/plugins/plugin-types.ts:1240-1358`
- Shape: Builder<TInput=any>(): IChainableBuilder<TInput,{},{}>; `.use(...plugins)` accumulates plugin types into TPlugins; `.for<TObject extends object>(): FieldBuilder<TObject, {}, TPlugins, never>`; `.v<Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(path: Key, def: (ctx: FieldBuilderContext<TObject,TPlugins,TypeOfPath<TObject,Key>>) => TFieldBuilder, options?: FieldConfig): FieldBuilder<TObject, AddFieldTransform<TMap,Key,TypeOfPath<TObject,Key>,ExtractFieldType<TFieldBuilder>>, TPlugins, TDeclaredFields|Key>`; `.build(): TransformAwareValidator<TObject, ApplyFieldTransforms<TObject,TMap>>`
- Meaning: `use` looks immutable and is in fact a destructive append to the same builder object (`builder.ts:41-99`). `for` returns a new FieldBuilder each time. `v` returns a new FieldBuilder instance each time (`field-builder.ts:100-115`, correctly immutable here). TMap accumulates only the fields whose type changed, as a delta map applied to the original TObject at build time.

#### TransformAwareValidator.validate / parse
- Source: `src/core/builder/plugins/plugin-types.ts:1133-1148, src/core/builder/validator-factory.ts:490-556`
- Shape: validate(value: Partial<T>|unknown, options?: ValidationOptions): Result<T>; parse(value: Partial<T>|unknown, options?: ParseOptions): Result<TTransformed>
- Meaning: validate runs no transform and only validates (VALIDATE_MODE); parse applies transforms and returns the converted data (PARSE_MODE). This two-phase separation is consistent across every execution engine and is worth keeping. For a null or undefined value it returns one error with code "REQUIRED" and path "".

#### The plugin descriptor `{ name, methodName, allowedTypes, category, impl }`
- Source: `src/core/builder/plugins/plugin-creator.ts:79-105`
- Shape: plugin({ name: TPluginName, methodName: TMethodName, allowedTypes: readonly TypeName[], category: PluginCategory, impl: (...args) => ValidatorFormat })
- Meaning: `name` is both the default error code and the deduplication key; `methodName` is the method that appears on the chain and may differ from the name (stringMin → min); `allowedTypes` filters which type builders it appears on, decided by an `includes` test at `field-context.ts:331`. Separating these four is correct design and is carried forward.

#### ValidatorFormat, the hoisted validator's return value
- Source: `src/core/builder/plugins/plugin-interfaces.ts:26-68, src/core/plugin/required.ts:66-84`
- Shape: { check: (value, allValues?, arrayContext?) => boolean; code: string; getErrorMessage: (value, path, allValues?, arrayContext?) => string; params: unknown[] }
- Meaning: `impl` is two-stage — take the arguments, do the precomputation, return a pure `check`. `check` has no side effects and answers only a boolean, and the message is built lazily, only on failure. The two stages plus the lazy message are a real design decision and should be kept. The `__isXxx` markers described below ride on the same object, and those are not carried forward.

#### A plugin passes through a value outside its own type (type-tolerant check)
- Source: `src/core/plugin/stringMin.ts:63-68, src/core/builder/context/field-context.ts:39-155`
- Shape: `check: (value) => { if (typeof value !== "string") return true; return value.length >= minLength; }`
- Meaning: stringMin answers true for a non-string. Reporting a type mismatch is the job of the `stringType` validator that `b.string` stacks automatically (`field-context.ts:39-52`), and an individual plugin does not duplicate that error. This is what keeps "one invalid value, one error" true, and it is must-preserve. null and undefined are likewise centralised in required / optional / nullable.

#### The type-builder vocabulary `b.string` / `b.number` / `b.boolean` / `b.date` / `b.array` / `b.tuple` / `b.union` / `b.object` / `b.any`
- Source: `src/core/builder/plugins/plugin-types.ts:1090-1128, src/core/builder/context/field-context.ts:410-524`
- Shape: the nine properties of `FieldBuilderContext<TObject,TPlugins,TFieldType>`
- Meaning: the `TypeName` union has ten members — "string", "number", "date", "array", "union", "tuple", "object", "boolean", "null", "any" — while the context grows nine; "null" has no entry point. Only union stacks no type check by default, and with no guard declared it injects a validator that always fails at build (`field-context.ts:204-213`).

#### The field path grammar, NestedKeyOf / TypeOfPath
- Source: `src/types/util.ts:44-131`
- Shape: `"a.b.c"` dotted, `"items[*]"` for an array element, `"items[*].name"` for an element's property, `"matrix[*][*]"` for two dimensions
- Meaning: at the type level, only paths reachable from TObject are permitted. `NestedKeyOf` is fixed at depth 5 (the decrement table at `util.ts:44`) and hand-expands one and two dimensions only. `TypeOfPath` hand-expands three, and additionally accepts the `".*"` notation and a fallback that descends implicitly into elements when a dotted path meets an array (`util.ts:118-125`). The grammar itself is must-preserve; that asymmetry and that implicit descent are not.

### should-preserve (4)

#### `Result<T>`'s published surface
- Source: `src/types/result.ts:86-158`
- Shape: isValid(): boolean; isError(): boolean; unwrap(): T; unwrapOr(d): T; unwrapOrElse(fn): T; map(fn); flatMap(fn); tap(fn); tapError(fn); data(): T|undefined; readonly errors: ValidationError[]; readonly valid: boolean; toPlainObject()
- Meaning: a validation result comes back as a Result rather than an exception, and only `unwrap` throws `LuqValidationException`. That policy is worth keeping. As it stands, though, the `valid` getter duplicates `isValid()`, `data()` duplicates the `value` getter and the `errors` property duplicates an `errors()` method, all inconsistently. One of each.

#### ValidationOptions / ParseOptions
- Source: `src/types/index.ts:41-53`
- Shape: { abortEarly?: boolean; abortEarlyOnEachField?: boolean; messageFactory?: MessageFactory; translate?: (key, params?) => string; context?: Record<string, unknown> }
- Meaning: `abortEarly` stops between fields, `abortEarlyOnEachField` stops within one field's validator list. Both default to true (`unified-validator.ts:115`, `options?.abortEarlyOnEachField !== false`). The two axes are meaningfully separate and are kept.

#### Replacing an error message through MessageContext / MessageFactory
- Source: `src/core/plugin/types.ts:27-46, src/core/plugin/stringMin.ts:6-9`
- Shape: `ValidationOptions<TContext>.messageFactory?: (ctx: MessageContext & TContext) => string`; `MessageContext = { path: string; value: unknown; code: string }`
- Meaning: each plugin declares its own extra context type, for instance `StringMinContext = MessageContext & { min: number; actual: number }`. Giving each plugin a typed context is a good idea. The implementation branches between three calling conventions based on the factory's arity (`stringMin.ts:73-95`), and that is not carried forward.

#### ValidationError's published shape
- Source: `src/types/index.ts:25-30`
- Shape: { path: string; message: string; code: string; paths(): string[] }
- Meaning: `path` is a string in the dotted `[*]` notation; `code` is the plugin's name or the code the plugin specified. `paths()` is part of the published type with zero call sites and a different return value per implementation — see below. Three fields, `{ path, code, message }`, is the right shape.

### optional (2)

#### validator.pick(key)
- Source: `src/core/builder/plugins/plugin-types.ts:1141, src/core/builder/validator-factory.ts:2641`
- Shape: pick<K extends NestedKeyOf<T>>(key: K): FieldValidator<T, TypeOfPath<T, K>>
- Meaning: carves a single-field validator out of a built one. `FieldValidator.validate(value, allValues?, options?)` takes `allValues` second, for the plugins that reference other fields. The feature is worth carrying forward; as it stands `createPickValidatorFactory` is produced separately along four routes (`validator-factory.ts:471,578,626,2641`), one of which fills it in afterwards with `pick: null as any` (`615,632`).

#### Default values through FieldConfig / FieldOptions
- Source: `src/core/builder/types/field-options.ts, src/core/builder/validator-factory.ts:490-556`
- Shape: `.v(path, fn, { default: value | (ctx) => value })` → `applyDefault(currentValue, fieldOpts, { allValues })`
- Meaning: a field default is applied ahead of validation and parsing. On the validate route the input object is shallow-copied first (`validator-factory.ts:506-518`). The feature is worth keeping; the application is duplicated once per execution route.

## Behavioural rules

- **The origin of the collapse, and the first rule.** When a plugin descriptor's type holds the method implementation, do not take it as an information-free type parameter such as `TMethod extends Function` (`plugin-types.ts:63-76` is where everything fell over). Keep the argument tuple and the output type as independent type parameters instead — for instance `Plugin<TName extends string, TMethod extends string, TArgs extends readonly unknown[], TIn, TOut>` — and assemble the chain method directly as `(...args: TArgs) => FieldChain<..., TOut>`. Never try to reconstruct it afterwards with conditional types.
- **Chain types.** When deciding a chain method's return type, do not write conditional types branching on a `category` string (`MapPluginMethodsToChainable` / `InferChainableReturnType`, `plugin-types.ts:354-640`, about 290 lines). Have the plugin descriptor itself carry "the value type after this call" as a type, and let the chain pass `TOut` straight to the next step. Needing to rewrite the return type per category means the design is wrong.
- **Connecting types to runtime.** When writing the builder implementation, do not assemble `const builder: any = {...}` and return it `as IChainableBuilder<...>` (`builder.ts:25,101`, `field-context.ts:180,303`). Let the compiler verify that the implementation object structurally conforms to the declared type. Where methods really must be attached dynamically, confine that to an untyped internal record, put exactly one explicit type guard at its boundary, and let `as` appear only inside that guard.
- **Identity along the chain.** When implementing a plugin method, do not push onto a shared validators array and `return builder` — the same object (`field-context.ts:340-359`). Two chains branched from one context then contaminate each other. Each method should be a pure function returning a new immutable chain value, such as `{ rules: readonly Rule[] }`.
- **Building the context.** When making a field context, do not pre-build all nine type builders and assign every plugin's methods onto each (`field-context.ts:410-524` plus attachPluginMethods). That allocates fields × plugins × 9 closures on every build. Build only the one that is asked for, through a getter or a call, or build a per-type method table once per plugin set and share it.
- **Swallowed errors.** Where calling a plugin or building a field can fail, do not swallow it with `try { ... } catch (e) { /* ignore */ }` (`field-context.ts:364-366`, "Plugin error - ignore silently"; `validator-factory.ts:112-115`). A broken plugin becomes a validator that always passes, and the bug ships in silence. Let a construction-time exception propagate to the caller. Failing at build time is the correct behaviour.
- **Fallbacks.** When a plugin's return value is not the expected shape, do not fall back implicitly to `return () => false` or `return () => true` (`extractCheckFunction` at `field-context.ts:381-390`, `extractTransformFunction` at `392-419`). The first silently fails everything and the second silently passes everything. Fix the return shape with a discriminated union and throw at construction time when it does not match.
- **The core-to-plugin boundary.** When assembling an error context or message, do not branch on an individual plugin's name in the core, as in `validator.pluginName === "stringMin"` (`unified-validator.ts:1298-1330` hard-codes six of them). That destroys plugin independence and tree-shaking as ideas. Have the plugin put structured context on its own ValidatorFormat and let the core carry it through untouched. If the core needs to know a particular plugin's name, the design is wrong.
- **Metadata.** When representing something special about a validator, do not mix marker booleans onto one object — `__isTransform`, `__isRecursive`, `__isNullable`, `__isStitch`, `__isPreprocess`, `__isOrFail`, `__isFromContext`, `__isDefault`, `__isCoerce`, `__isArrayElementField` (ten of them at `plugin-interfaces.ts:44-68`, referenced by five core files). Every new marker adds a branch in the core and another need for `any`. Use a discriminated union — `type Rule = { kind: "check"; ... } | { kind: "transform"; ... } | { kind: "recurse"; ... }` — and force exhaustiveness on `kind` with a switch.
- **Deciding a field's attributes.** To learn whether a field is optional or required, do not walk the built validator array comparing `v.name === "optional"` (`validator-factory.ts:106,109,1852,1856`). Carry it on the chain's result as a structured attribute such as `isOptional: boolean`, and express it in the types too.
- **Analysing user code.** To learn which plugins a user's builder function uses, do not scan `builderFunction.toString()` with a regular expression (`strategy-factory.ts:530-541`). Minification, transpilation and property mangling break it silently. Run the builder function once and inspect the structured chain value it returns.
- **Code generation.** When a fast loop over a variable structure such as a multi-dimensional array is wanted, do not generate code with `new Function` (`array-type-analysis.ts:196`, actually reached from line 309). It directly violates being CSP-safe. Use a recursive function, or pick between fixed functions written per depth. Ban `new Function` and `eval` mechanically with a lint rule.
- **Branching on the environment.** To switch execution strategy, do not read `process.env.LUQ_ULTRA_FAST` or `(global as any).__LUQ_ULTRA_FAST__` (`validator-factory.ts:462-464`). A plain browser bundle throws on an undefined `process`, and a bundler cannot prune the branch. If the switch is genuinely needed, take it explicitly as an option to `build()`. If it is not, have one route.
- **Result objects.** To reduce allocation on a hot path, do not reuse and return a module-level mutable object (`ultra-fast-validator.ts:12-13` shares SUCCESS_RESULT / ERROR_RESULT across every call, so a second `validate` destroys the first one's return value). Return a new object each time. To avoid an object on success, provide a separate function returning a `boolean` — do not share a value, return no value.
- **Execution routes.** When tempted to add an execution route for performance, do not add a new implementation behind a branch while keeping the old one (validate had three top-level routes and four beneath them, seven implementations in total). Fix on one route and optimise within it. If a benchmark cannot measure a significant difference, do not add it.
- **Magic thresholds.** When writing the condition that selects a route, do not put in unexplained thresholds such as `fastValidators.size <= 10`, `totalValidators <= 50`, `validators.length <= 10`, `transforms.length <= 5` (`validator-factory.ts:459-469`, `unified-validator.ts:85-99`). Adding one field switches to a different implementation, and the difference in behaviour surfaces as a bug. Have no branch.
- **Strategy analysis.** If the design selects a strategy per field, do not implement it by handing every field the same analysis (`execution-strategy-selector.ts:33-37`, whose comment says "TODO: Support per-field strategy analysis"). That spinning wheel is why 583 lines of strategy-factory.ts and 763 of validation-engine.ts existed. Do not introduce the concept of a strategy at all until a per-field difference is genuinely needed.
- **Duplicated utilities.** When a path accessor or path parser is needed, do not write one per module (three implementations of the accessor family across field-accessor.ts, field-accessor-optimized.ts and field-utils.ts, plus a local fourth in validator-factory.ts; seven for path parsing). Put parsing, reading and writing in one module with one implementation, and have every consumer import it. Creating a second implementation with an "optimized" suffix is already the defeat.
- **One definition per type.** When defining a domain type — ValidationError, ValidationResult, ValidationFunction, ValidationContext — do not put a local definition in each module (ValidationError has four mutually incompatible ones: `src/types/index.ts:25` requires `paths(): string[]` while `builder/types/types.ts:201`, `validation-engine.ts:7` and `jsonSchema/types.ts:71` do not). One definition in one file, referenced elsewhere with a type import. The moment two types share a name and differ in shape, an `any` bridge becomes inevitable.
- **Implementing Result.** When implementing a Result type, do not build the success and failure branches by different means (`Object.create` from a successProto against a `createResult` object literal, `result.ts:163-247` and `258-338`). Success's `errors` is a method and failure's is a getter, so success does not satisfy the declared `readonly errors: ValidationError[]` (line 148). Return one discriminated union, `{ ok: true; value: T } | { ok: false; errors: readonly ValidationError[] }`, with pure functions as helpers.
- **Duplicated API surface.** Do not provide several ways to reach the same information (Result carries `isValid()` beside a `valid` getter, `data()` beside a `value` getter, and an `errors` property beside an `errors()` method). One piece of information, one way to reach it.
- **Unused API.** When designing a published type's members, do not include one that costs on every construction and nobody calls (`ValidationError.paths()` is hand-generated in about twenty places, returns `[""]`, `[path]` or `path.split('.')` depending on the implementation, and has zero call sites in src or test). Fix ValidationError at `{ path, code, message }`.
- **Namespaces.** When grouping utility functions, do not use `export namespace ResultUtils { ... }` (`result.ts:344-399`). A namespace compiles to an object and defeats tree-shaking. Use individual named exports.
- **Global mutable state.** For configuration, do not publish a module-level mutable singleton (`let currentConfig` and `setGlobalConfig` at `global-config.ts:28`). It interferes under SSR, under concurrent tests, and between coexisting validators — and as it stands nothing inside src reads it, so it is a dead API that is merely published. Pass configuration as an argument to Builder or to `build()`.
- **Aliases.** Do not give one feature two names (`field` and `v` are identical implementations with one marked deprecated, `field-builder.ts:121`; `strict` and `strictOnEditor` are identical, line 175; `objectRecursivelyPlugin as recursivelyPlugin` is an aliased re-export, `core/plugin/index.ts:70-71`). Pick one name. With no users yet, this is the only moment the decision is free.
- **Barrels.** When making entry points, do not export different subsets from several barrels (`src/index.ts`, `src/core/index.ts` and `src/core/plugin/index.ts` are three different sets, and core/index.ts was assembled on the criterion "whatever the benchmarks use"). An index re-exports and nothing more, and the exported set is decided in one place. That structurally prevents omissions like the twenty plugin files that exist and are not exported from `src/index.ts`.
- **Replacing messages.** When calling a user's message factory, do not switch calling convention on `factory.length` (`stringMin.ts:73-95` distinguishes zero-, two- and one-argument conventions by arity). A default or rest parameter in an arrow function changes `length` easily. Fix the signature at `(ctx: MessageContext & TExtra) => string`.
- **Declaration matching implementation.** When writing a factory, do not let the declared return type disagree with what is actually returned (`plugin()` at `plugin-creator.ts:79-105` declares `TypedPlugin<..., TImpl, ...>`, meaning `create(): TImpl`, while the real `create` returns `WithPluginName<TImpl>` with the plugin name injected). Declare the post-injection type. Five `as unknown as` casts lined up inside `createImpl` is the type lying.
- **Iterating the wrong array.** When handling arrays in parallel, do not loop by another array's length (`composable-plugin.ts:108-113` iterates `validators` by `transforms.length`, so an empty `transforms` skips every check). Loop over the array being walked. Copy-paste bugs of this kind do not get caught in review, so do not put parallel array traversal into the design at all.
- **How many times a builder function runs.** When implementing `build()`, do not run the user's builder function more than once (as it stands, at least five times per field: once in field-builder.build's processedDefinitions, once for the optional/required decision in validator-factory, once each in the three buildUnifiedValidators calls for slow/fast/all, and once more inside createUnifiedValidator). A user's builder function is not guaranteed to be pure. Run it once and carry the structured result.
- **Array path syntax.** When settling the syntax for an array element in a field path, do not accept several notations at once (as it stands both `items[*].name` and `items.*.name` are accepted, and `items.name` is interpreted as descending implicitly into elements: `util.ts:112-125` and `nested-array-processor.ts:15-19`). That ambiguity is part of why there are seven path parsers. Fix on `[*]`, and let a dot always mean an object property.
- **Array dimensions at the type level.** When writing NestedKeyOf and TypeOfPath, do not hand-expand the dimensions (`NestedKeyOf` covers one and two, `TypeOfPath` three — asymmetrically: `util.ts:44-131`). Handle any dimension with one recursion and express the depth limit through one decrement mechanism. Hand-expansion is what makes the paths the types permit differ from the paths the runtime understands.
- **Experimental code.** When putting unfinished work in the tree, do not exclude it from type checking in tsconfig (`"exclude": [..., "src/core/async.experimental/**/*"]` takes four files and about 800 lines out, three of them entirely unreferenced). If it is unfinished, keep it out of src. If it goes in src, it type-checks.
- **Escape hatches.** Do not put a performance alternative on the published interface (`validateRaw?` and `parseRaw?` on TransformAwareValidator are optional and present or absent depending on the route: `plugin-types.ts:1143-1148`, `validator-factory.ts:566-576`). Users are forced to test for existence and the implementation is forced to maintain two families. Publish one pair, validate and parse.
- **Parallel APIs.** Do not provide two entry points for one purpose (the Builder chain coexists with `createPluginRegistry` / `createFieldRule` / `useField`, and the registry rebuilds a Builder internally across 687 lines: `plugin-registry.ts:24,119`). One entry point. If per-field reuse is needed, express it as part of what Builder returns.
- **Documentation.** When writing an example in documentation, do not use an API that does not exist (the `useField` examples at `field-builder.ts:124-129` and `plugin-types.ts:1310-1313` call `registry.createFieldRules()`, plural, and `rules.string.required()`, while the real API is `createFieldRule`, singular, returning nothing of that shape). Put examples where they compile — a type test, or an examples directory.
- **Optimisation comments.** Do not write "V8 optimization", "unified hidden class" or "1M+ ops/sec" without a measurement (they are scattered through src, and the places carrying them are exactly where the shared-mutable-object incident and the sevenfold implementation happened). Commit an optimisation together with a link to its measurement. With no measurement, choose the simplest implementation.
- **Dead modules.** Having written a new implementation, delete the old one (thirteen modules are unreferenced: async-plugin-extensions.ts, async-validator-integration.ts, from-context-plugin.ts, field-type-detector.ts, array-batch-validator.ts, conditionalSchema.ts, message-factories.ts, shared.ts, stitch-typed.ts, stitchSimple.ts, `__tests__/test-utils.ts`, `src/core/registry.ts`, indexed-result.ts — and validation-engine.ts's 763 lines are substantially dead, its only referrer being unreferenced itself). Detect unreferenced modules and unused exports in CI and fail on them.
- **Unused imports.** When creating a plugin, do not copy a template and leave imports unused (`import { VALID_RESULT, INVALID_RESULT } from "./shared-constants"` appears in 31 files and is unused in at least required.ts, stringMin.ts and stringPattern.ts — the main source of 229 unused-variable warnings). Enable `noUnusedLocals` and fail in CI.
- **tsconfig.** When claiming strict, do not set individual flags to false immediately below `"strict": true` (tsconfig.json sets all six of noImplicitAny, strictNullChecks, strictFunctionTypes, strictPropertyInitialization, noImplicitThis and noImplicitReturns to false). That is the ground on which 1365 occurrences of `any` kept compiling. Write no per-flag override, and start genuinely strict from the first commit.

## Not carried forward

- **The six-parameter structure of `TypedPlugin<TName, TMethodName, TMethod extends Function, TAllowedTypes, TPluginType, TCategory>`** (`plugin-types.ts:63-76`) — flattening TMethod to Function is where everything fell over. On top of that, TPluginType ("validator" | "transform") and TCategory (eleven values) overlap semantically, with transform appearing in both. Of the six parameters only TName, TMethodName and TCategory carry any information. A different structure, keeping the argument tuple and the output type, replaces it.
- **PluginCategory's eleven values** (standard, conditional, transform, fieldReference, multiFieldReference, arrayElement, composable, composable-conditional, composable-directly, context, builder-extension) — every added category adds a branch to five separate conditional types (MapPluginMethodsToChainable, ApplyTypesToMethod, GetMethodCategory, PluginImplementation, CategoryMethodSignature), which is the main reason plugin-types.ts is 1482 lines. composable, composable-conditional and composable-directly all exist for the same purpose, accumulating across several calls, and have no need to be separate categories. arrayElement and preprocessor are defined as categories while `createImpl` in plugin-creator has no preprocessor branch at all and falls through to standard.
- **MapPluginMethodsToChainable / InferChainableReturnType / ApplyTypesToMethod / GetPluginCategoryByMethod / GetPluginMethodByName / InferMethodParameters / ExtractPluginMethodsByCategory / ExtractConditionalPluginMethods / ExtractTransformPluginMethods / ExtractFieldReferencePluginMethods / ExtractMultiFieldReferencePluginMethods / ExtractComposablePluginMethods / GetMethodCategory / IsConditionalMethod / FlattenPluginMethods / ExtractPluginMethods / FilterPluginsByType** (about 900 lines of plugin-types.ts) — all of it machinery for recovering the information lost by flattening TMethod to Function. Not one line is needed if the loss does not happen. It also makes editor completion slower.
- **ChainableFieldBuilderTransformAware / CanRefineToType and the nine refine methods** (refineString, refineNumber, refineArray, refineTuple, refineUnion, refineBoolean, refineDate, refineObject, refineAny) — typed at `plugin-types.ts:192-259` and implemented at `field-context.ts:232-303`, but ChainableFieldBuilderTransformAware is referenced from nowhere outside plugin-types.ts. The implementation is an internal type-change hatch whose only justification is a comment saying "needed by jsonSchema.ts"; it has no coherence as a published API.
- **TypeStateFlags / ApplyTypeState** (the excludeUndefined and excludeNull flags) — defined at `plugin-types.ts:906-926` and threaded through the chain types with zero external references. It exists only to produce nullable's return type, and handling `TCurrentType | null` directly makes it unnecessary.
- **ValidateUnionType / UnionArrayObjectError / HasArrayWithObjectElement / UnionHasArrayWithObject / ExtractArrayFromUnion / IsArrayElementObject** (`plugin-types.ts:1447-1490`) — machinery returning an error-message type with an emoji in it, `_error: "❌ Union types with Array<object> are not supported..."`, with zero external references. Expressing an error message as a type worsens the editor experience and freezes an implementation limit into the type system. Either support union with `Array<object>` from the start, or say it is unsupported with a run-time error.
- **strict() / strictOnEditor() and MissingFields / DeclaredFields** — two identical implementations aliased to each other (`field-builder.ts:160-181`). Both carry deprecated and WIP markers at once, and the return type is FieldBuilder on success and `{ _error: string; _missingFields: ... }` on failure, so `.build()` does not appear and the resulting error is unreadable. DeclaredFields has zero external references.
- **ValidationError.paths(): string[]** — required by the published type at `src/types/index.ts:25-30` and therefore hand-generated in about twenty places (seven in array-batch-optimizer.ts, four in nested-array-processor.ts, four in raw-validator.ts, two in validator-factory.ts, plus async-context.ts and async-validator-integration.ts), with not one call site in src or test. The return value differs by implementation between `[""]`, `[path]` and `path.split('.')`. It allocates one extra closure per error.
- **validateRaw / parseRaw and RawValidator / UltraFastValidator** (476 lines of raw-validator.ts, 258 of ultra-fast-validator.ts) — published as optional members of TransformAwareValidator and present or absent depending on the route. ultra-fast-validator contains the outright bug of returning a shared module-level mutable result object. Bringing a second return convention, one that does not return a Result, onto the published surface was the mistake.
- **execution-strategy-selector.ts / core/strategy-factory.ts / core/validation-engine.ts / optimization/array-batch-validator.ts** (1642 lines together) — the strategy selector hands every field the same strategy and its own comment admits the TODO; strategy-factory guesses plugin usage from `builderFunction.toString()` with a regular expression; validation-engine's only referrer, array-batch-validator, is entirely unreferenced. Substantially all of it is dead.
- **BuildTimeArrayAnalyzer.generateOptimizedValidator / createNestedLoopValidator / generateNestedLoopCode** in `src/types/array-type-analysis.ts` — code generation with `new Function` (line 196), a direct violation of being CSP-safe, and actually called from line 309, so not merely dead. Multi-dimensional arrays are handled recursively.
- **src/core/global-config.ts** (globalConfig, setGlobalConfig, getGlobalConfig, resetGlobalConfig, GlobalConfig) — a module-level mutable singleton with zero uses inside src, merely published. Its settings — messageKeyPrefix, toBooleanTruthyValues, numberFormat, dateFormat, trimStrings, caseSensitive, customTransforms — have no plugin reading them either.
- **src/core/registry/plugin-registry.ts** (createPluginRegistry, PluginRegistry, FieldRule, createFieldRule, toBuilder, useField, ExtractFieldRuleType, FieldRuleDefinition) — a second entry point for declaring validation alongside Builder, rebuilding a Builder internally across 687 lines, with three `any` escape hatches inside FieldRule: `_phantomType: T` and `_getInternalValidators?(): { validators: any[]; transforms: any[]; executionPlan: any }`, where executionPlan is a concept already abandoned elsewhere. One entry point is the decision to take now.
- **Switching behaviour on `process.env.LUQ_ULTRA_FAST` / `(global as any).__LUQ_ULTRA_FAST__`** (`validator-factory.ts:462-464`) — throws in a plain browser bundle where `process` is undefined, and makes a bug impossible to reproduce because the difference is hidden.
- **All four files of src/core/async.experimental/** (async-context.ts, async-plugin-extensions.ts, async-validator-integration.ts, from-context-plugin.ts, about 800 lines) — excluded from type checking by tsconfig, and three of them entirely unreferenced. Whether async validation is offered at all is an open question, and this implementation is not the starting point for it.
- **src/core/registry.ts, src/types/indexed-result.ts, src/core/builder/context/field-type-detector.ts, src/core/plugin/{conditionalSchema,message-factories,shared,stitch-typed,stitchSimple}.ts, src/core/plugin/__tests__/test-utils.ts** — all entirely unreferenced. stitch has three coexisting implementations, two of which are dead.
- **src/types/valitator.ts** — the filename is a typo, and it survives as a published type, being what `InferType` depends on. Its `FieldValidator` collides with a differently defined `FieldValidator` in plugin-types.ts. `ValidatorStrategy` has zero references.
- **The `field` method** (a deprecated alias identical to `v`) **and `recursivelyPlugin`** (an aliased re-export of objectRecursivelyPlugin) — with no users yet, one name each. There is no reason to start a first release already carrying deprecations.
- **The double Result implementation** (successProto against createResult) **and LuqValidationException's fake constructor** `createLuqValidationException as any as { new (...) }` (`result.ts:36-41`) — success and failure differ in what `errors` actually is, a method against a getter, and success does not satisfy the declared interface. The fake constructor permits `new` through a double `any` cast while leaving `instanceof` broken.
- **The 33 files over 200 lines**, above all validator-factory.ts at 2882, plugin-types.ts at 1482, unified-validator.ts at 1366, types/types.ts at 797, error-generation.ts at 789, validation-engine.ts at 763, nested-array-processor.ts at 711, plugin-registry.ts at 687, dsl-converter.ts at 602, plugin-interfaces.ts at 597 and strategy-factory.ts at 583. The new rule is 200 lines per file. These are not to be split but discarded: splitting them carries the category branching and the multiple execution routes across intact.

## Published symbols (67)

`Builder`, `IChainableBuilder`, `ChainableBuilder`, `FieldBuilder`, `FieldBuilderContext`, `ChainableFieldBuilder`, `TransformAwareValidator`, `ApplyFieldTransforms`, `ExtractFieldType`, `FieldValidator`, `ValidationResult`, `ValidationError`, `ValidationOptions`, `ParseOptions`, `MessageContext`, `MessageFactory`, `SEVERITY`, `Result`, `LuqValidationException`, `ResultUtils`, `TypedPlugin`, `PluginType`, `PluginCategory`, `TypeName`, `TypeMapping`, `ValidatorFormat`, `PluginImplementation`, `StandardPluginImplementation`, `ConditionalPluginImplementation`, `TransformPluginImplementation`, `FieldReferencePluginImplementation`, `ArrayElementPluginImplementation`, `MultiFieldReferencePluginImplementation`, `ContextPluginImplementation`, `PreprocessorPluginImplementation`, `StandardValidationMethod`, `ConditionalValidationMethod`, `FieldReferenceValidationMethod`, `MultiFieldReferenceValidationMethod`, `TransformValidationMethod`, `ArrayElementValidationMethod`, `ContextValidationMethod`, `PluginValidationResult`, `plugin`, `pluginPredefinedTransform`, `pluginConfigurableTransform`, `pluginBuilderExtension`, `BuilderExtensionPlugin`, `BuilderExtensionMethod`, `ComposablePlugin`, `createValidatorResult`, `createPluginRegistry`, `PluginRegistry`, `FieldRule`, `ExtractFieldRuleType`, `FieldRuleDefinition`, `GlobalConfig`, `globalConfig`, `setGlobalConfig`, `getGlobalConfig`, `resetGlobalConfig`, `NestedKeyOf`, `TypeOfPath`, `ElementType`, `InferType`, `PluginMapFromArray`, `BuilderExtensions`
