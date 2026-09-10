# build-and-distribution

## What the current pipeline actually does

`npm run build` = `node build.js` (C:\projects\luq\build.js, 269 lines). Nothing else. `build.sh` is unrelated (it builds the Rust LSP under compiler/).

Sequence in build.js:
1. `rm -rf dist`, `mkdir dist`, `mkdir dist/plugins`.
2. `npx tsc --emitDeclarationOnly` using **tsconfig.json** (not tsconfig.build.json). tsconfig.json has `outDir: dist`, `declaration: true`, `include: ["src/**/*"]`. So this emits a **complete mirror of the src tree as .d.ts under dist/** — dist/core/, dist/types/, dist/constants.d.ts, including dist/core/plugin/__tests__/ and dist/core/async.experimental/. Errors are swallowed (`catch { console.log("...had warnings, continuing") }`).
3. esbuild bundles **core-entry.ts** (repo root, 50 lines) twice → `dist/index.js` (cjs) and `dist/index.mjs` (esm). `bundle:true, minify:true, sourcemap:true, format cjs|esm, platform:"node", target:"es2020", external:[]`.
4. For each of 57 names in a hardcoded array, esbuild bundles `src/core/plugin/<name>.ts` (or `src/core/plugin/jsonSchema/index.ts` for `jsonSchema`) → `dist/plugins/<name>.js` + `.mjs`. Same options, `sourcemap:false`, `external:["../index"]`.
5. For each plugin it copies `dist/core/plugin/<name>.d.ts` → `dist/plugins/<name>.d.ts` while **string-rewriting the import specifiers with regexes** (7 replace() pairs) to re-point `./types` → `../core/plugin/types`, `../..` → `../index`, etc.
6. It writes `exports-config.json` and prints "Update package.json with the contents of exports-config.json". **The exports map is not applied automatically** — a human copy-pastes it. I diffed them: `exports-config.json` and `package.json#exports` are currently byte-for-byte deep-equal, 58 keys each.

## Measured facts

- `dist/index.js` 63,009 B raw / **17,734 B gzipped**; `dist/index.mjs` 62,324 / **17,423 gzipped**.
- `dist/plugins/required.mjs` 994 / 534 gz. `stringMin.mjs` 1,142 / 564 gz. `jsonSchema.mjs` 25,955 / 6,939 gz. `jsonSchemaFullFeature.mjs` 55,724 / 14,826 gz.
- Plugin bundles contain **zero import/require statements**. `external:["../index"]` never matched anything (plugin sources import via `../builder/...`, not `../index`), so every plugin inlines its own private copy of the plugin-creator helpers. Verified by reading dist/plugins/required.mjs and stringMin.mjs in full — both begin with an identical inlined `var u=(t,r,o,i)=>{...}` / `function l(t){...}` pair.

## Provenance of "19-23KB gzipped"

It is literally two rows of bundle-size-comparison/benchmark-results.json:
- `{library:"luq", structure:"simple", bundleSize:{raw:73585, gzipped:19562, brotli:16796}}`
- `{library:"luq", structure:"complex", bundleSize:{raw:95691, gzipped:23015, brotli:19326}}`

Method: bundle-size-comparison/build-all.js runs esbuild `bundle:true, minify:true, format:"esm", target:"es2020", platform:"neutral", treeShaking:true` over `implementations/luq/simple.ts` and `complex.ts`; compare-sizes.js / run-unified-benchmark.ts then `zlib.gzipSync()` the output. `implementations/luq/simple.ts` imports `Builder` from `../../../dist/index.js` plus 6 plugin files (required, stringMin, stringMax, stringEmail, numberMin, numberMax) from `../../../dist/plugins/*.js` — i.e. it measures the **already-built dist**, not src.

The decisive consequence: 17.4 KB of the 19.1 KB "simple" figure is the monolithic core bundle. Only ~2.1 KB is plugins. The number is a **core-bundle floor**, and per-plugin tree-shaking moves it by single-digit percent. (Reference points from the same run: valibot-simple 4,068 B raw, ajv-standalone-simple 3,416 B raw.) README's "Tree-shakeable plugins - Only pay for what you use (19-23KB gzipped)" is therefore misleading: you pay 17.4 KB before you use anything. **The new implementation's headline requirement is to make the core floor real, not to preserve the 19-23KB number.**

## Broken things I verified (not inferred)

1. **Types and runtime disagree at the root entry.** `dist/index.d.ts` is compiled from `src/index.ts` and declares 57 plugin exports (`requiredPlugin`, `stringMinPlugin`, ... `jsonSchemaFullFeaturePlugin`). `dist/index.js` is bundled from `core-entry.ts` and at runtime exports only 11 names: Builder, Result, createPluginRegistry, getGlobalConfig, globalConfig, plugin, pluginBuilderExtension, pluginConfigurableTransform, pluginPredefinedTransform, resetGlobalConfig, setGlobalConfig (verified with `node -e "Object.keys(require('./dist/index.js'))"`). `import { requiredPlugin } from "@maroonedog/luq"` type-checks and returns `undefined` at runtime.
2. **README documents two subpaths that are not in the exports map.** README line 22: `from "@maroonedog/luq/plugins"`. README line 112: `from "@maroonedog/luq/core/builder/plugins/plugin-creator"`. The map has only `"."` and `"./plugins/<name>"` ×57. Both throw ERR_PACKAGE_PATH_NOT_EXPORTED.
3. **The regex d.ts rewriting produces a broken path.** `dist/plugins/jsonSchemaFullFeature.d.ts` line 3: `import type { JsonSchemaOptions } from "../core/plugin/jsonSchema/jsonSchema/types";` — doubled segment. `dist/core/plugin/jsonSchema/jsonSchema/` does not exist. The flagship plugin ships broken types.
4. **`json-schema` types are referenced by published d.ts but undeclared.** `JSONSchema7` is imported from `"json-schema"` in dist/plugins/jsonSchemaFullFeature.d.ts and 10+ files under dist/core/. package.json has **no `dependencies` and no `peerDependencies`** — only devDependencies. `@types/json-schema` resolves locally only transitively.
5. **`files: ["dist"]` publishes the whole internal d.ts mirror**, including `dist/core/plugin/__tests__/`, `dist/core/async.experimental/`, and 15 plugin modules that have no export path at all.
6. **`new Function` exists in src** at `src/types/array-type-analysis.ts:196` (`createNestedLoopValidator` builds a nested-loop validator from a code string), contradicting the CSP-safe claim. It is *not* reachable from the shipped bundles (`grep -c "new Function" dist/index.js dist/index.mjs` → 0/0), so the shipped artifact is CSP-safe today, but the source contains a live landmine.
7. **`npm run lint:filenames` fails: 65 violations.** scripts/check-filenames.js enforces kebab-case + bans abstract words under src/, but every plugin file is camelCase (`stringMin.ts`). Meanwhile the public subpath names are camelCase (`./plugins/stringMin`). The new design must decouple these two: kebab-case files, camelCase public specifiers.
8. **Dead build config.** `tsconfig.build.json` (`outFile: dist/index.d.ts`, `module: "amd"`) and `rollup.dts.config.js` (rollup-plugin-dts bundling dist/index.d.ts → dist/index.bundled.d.ts) are referenced by no npm script. `dts-bundle-generator`, `rollup`, `rollup-plugin-dts` are unused devDependencies. `.swcrc` is only consumed by `npm run test:swc`, never by the build. `.npmignore` is inert because `files:["dist"]` takes precedence.
9. **No CI for build/test/publish.** `.github/workflows/` contains only `deploy-docs.yml`.

## Requirements the new implementation must satisfy

**Output formats.** Three per entry point: ESM (`.mjs`), CJS (`.js`), and per-entry `.d.ts`. `main`/`module`/`types` retained as fallbacks for old resolvers; `exports` is authoritative. Node conditions in order: `types`, `import`, `require`. Target ES2020 minimum (both esbuild builds and .swcrc pin es2020).

**Entry-point contract.** One root entry plus one subpath per plugin. Every subpath is independently loadable with no barrel in its dependency chain. The root entry must export exactly what its .d.ts declares — the new build must derive both from the *same* source file, and CI must assert `Object.keys(require(dist/index.js))` ⊇ the value exports named in dist/index.d.ts.

**Tree-shaking constraints.**
- `"sideEffects": false` in package.json (present today, correct, must be preserved). Every module must genuinely be side-effect-free: no top-level registry mutation, no `globalThis`/`window` writes at module scope. (Only `process.env.LUQ_ULTRA_FAST` at src/core/builder/validator-factory.ts:463 is read at module evaluation today; the new code should not read env at module scope.)
- Plugin definitions are top-level calls (`export const requiredPlugin = plugin({...})`). Emit `/*#__PURE__*/` on those calls so bundlers that ignore `sideEffects` can still drop them.
- No side-effect imports (`import "./x"`) anywhere in shipped code.
- No barrel file may sit on the path from a plugin subpath to its implementation. `index.ts` re-export-only is compatible with this **only if** the bundler can prune it; the safe rule is that each plugin subpath entry re-exports exactly one implementation module and nothing else.
- The shared core must be a **real shared module**, imported by plugin bundles rather than inlined into each. Either ship unbundled ESM (preferred: one output file per source file, so the consumer's bundler does the work) or mark the core as `external` with a correct specifier and verify by grepping the output for the import.
- No `eval` / `new Function` in any shipped module (CSP-safe is a load-bearing public claim, README lines 66 and 183).

**Type declarations.** Generated by `tsc` under the real-strict tsconfig, one `.d.ts` per emitted module, with **comments preserved** — the `@luq-plugin` JSDoc block (tags: `@luq-plugin`, `@name`, `@category`, `@description`, `@allowedTypes`, `@example`, `@params`, `@returns`, `@customError`, `@since`, `@deprecated`, parsed by scripts/docs-generator/parse-annotations.ts) is both the IDE hover documentation and the input to `npm run generate-docs`. No post-hoc regex rewriting of `.d.ts` import specifiers — the emitted output directory layout must mirror the source layout so relative specifiers are correct by construction.

**Package metadata.** `@types/json-schema` must move to `dependencies` (a types-only package referenced from published `.d.ts` must be a runtime `dependencies` entry, not devDependencies). Add `"./package.json": "./package.json"` to the exports map (many tools require it). Keep `sideEffects: false`, `license: MIT`, `repository`, `homepage: https://luq.dev`, `bugs`. Restrict `files` to the emitted artifacts only — no internal `.d.ts` mirror, no `__tests__`, no experimental directories.

## Policy for generating `exports` under the new directory layout

The current mechanism — a hardcoded 57-name array in build.js, an emitted exports-config.json, and a *manual* copy-paste into package.json — has already drifted once by construction (build.js's array had `jsonSchema` with no matching `src/core/plugin/jsonSchema.ts`, silently handled by a special case). Replace it with:

1. **Source of truth = the filesystem, one directory per plugin.** `src/plugins/<kebab-name>/index.ts` (re-export only) + implementation files. Discovery = `readdir(src/plugins)`. No hand-maintained list anywhere.
2. **One name map, one place.** Public subpath names are camelCase, directory names are kebab-case (required by the standards skill and by check-filenames.js). Derive the subpath deterministically: `kebabToCamel(dirName)`. Assert the round-trip (`camelToKebab(kebabToCamel(d)) === d`) at build time so `jsonSchemaFullFeature`↔`json-schema-full-feature` cannot drift.
3. **The build writes package.json#exports directly** (or the check runs in CI and fails on any diff). Never emit an advisory file and ask a human to paste it. Delete exports-config.json as a concept.
4. **Verify every generated subpath before publishing.** For each key: the three target files exist; `import()` of the `.mjs` and `require()` of the `.js` both succeed and export the expected symbol name; `tsc` resolves the `.d.ts` under `moduleResolution: "bundler"` *and* `"node16"` from a scratch consumer package. This is the gate that would have caught findings 1, 2, 3 and 4 above.
5. **Decide the `./plugins` barrel explicitly** (see openQuestions) — README already documents it, so either add it as a real subpath or fix the README. Do not ship a documented-but-missing specifier again.
6. **Size budget as a build assertion, not a README sentence.** Gzip the two benchmark bundles and fail the build above a declared ceiling. Publish the *core-only* gzip figure alongside the composed figure so the "only pay for what you use" claim is checkable.

## Contracts to preserve (70)

### must-preserve (64)

#### package name @maroonedog/luq
- Source: `C:\projects\luq\package.json:2`
- Shape: "name": "@maroonedog/luq"
- Meaning: npm scope and package identity. All documented imports are relative to it.

#### root export condition map
- Source: `C:\projects\luq\package.json:9-13`
- Shape: ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs", "require": "./dist/index.js" }
- Meaning: Dual ESM/CJS with types condition first. Consumers do `import { Builder } from "@maroonedog/luq"`.

#### sideEffects: false
- Source: `C:\projects\luq\package.json:362`
- Shape: "sideEffects": false
- Meaning: Declares every module free of import-time side effects, which is what actually enables webpack/rollup to drop unused plugin modules. The single most load-bearing distribution field for the tree-shaking claim.

#### per-plugin subpath export shape
- Source: `C:\projects\luq\package.json:14-298`
- Shape: "./plugins/<camelCaseName>": { "types": "./dist/plugins/<n>.d.ts", "import": "./dist/plugins/<n>.mjs", "require": "./dist/plugins/<n>.js" }
- Meaning: One deep-import specifier per plugin so a consumer can import exactly one plugin without pulling the barrel. The `./plugins/` prefix and the camelCase leaf name are the public contract.

#### ./plugins/required
- Source: `C:\projects\luq\package.json:14`
- Shape: exports requiredPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/required

#### ./plugins/optional
- Source: `C:\projects\luq\package.json:19`
- Shape: exports optionalPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/optional

#### ./plugins/nullable
- Source: `C:\projects\luq\package.json:24`
- Shape: exports nullablePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/nullable

#### ./plugins/stringMin
- Source: `C:\projects\luq\package.json:29`
- Shape: exports stringMinPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringMin

#### ./plugins/stringMax
- Source: `C:\projects\luq\package.json:34`
- Shape: exports stringMaxPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringMax

#### ./plugins/stringEmail
- Source: `C:\projects\luq\package.json:39`
- Shape: exports stringEmailPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringEmail

#### ./plugins/stringPattern
- Source: `C:\projects\luq\package.json:44`
- Shape: exports stringPatternPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringPattern

#### ./plugins/stringUrl
- Source: `C:\projects\luq\package.json:49`
- Shape: exports stringUrlPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringUrl

#### ./plugins/stringDate
- Source: `C:\projects\luq\package.json:54`
- Shape: exports stringDatePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringDate

#### ./plugins/stringDatetime
- Source: `C:\projects\luq\package.json:59`
- Shape: exports stringDatetimePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringDatetime

#### ./plugins/stringTime
- Source: `C:\projects\luq\package.json:64`
- Shape: exports stringTimePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringTime

#### ./plugins/stringIpv4
- Source: `C:\projects\luq\package.json:69`
- Shape: exports stringIpv4Plugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringIpv4

#### ./plugins/stringIpv6
- Source: `C:\projects\luq\package.json:74`
- Shape: exports stringIpv6Plugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringIpv6

#### ./plugins/stringHostname
- Source: `C:\projects\luq\package.json:79`
- Shape: exports stringHostnamePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringHostname

#### ./plugins/stringDuration
- Source: `C:\projects\luq\package.json:84`
- Shape: exports stringDurationPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringDuration

#### ./plugins/stringBase64
- Source: `C:\projects\luq\package.json:89`
- Shape: exports stringBase64Plugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringBase64

#### ./plugins/stringJsonPointer
- Source: `C:\projects\luq\package.json:94`
- Shape: exports stringJsonPointerPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringJsonPointer

#### ./plugins/stringRelativeJsonPointer
- Source: `C:\projects\luq\package.json:99`
- Shape: exports stringRelativeJsonPointerPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringRelativeJsonPointer

#### ./plugins/stringIri
- Source: `C:\projects\luq\package.json:104`
- Shape: exports stringIriPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringIri

#### ./plugins/stringIriReference
- Source: `C:\projects\luq\package.json:109`
- Shape: exports stringIriReferencePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringIriReference

#### ./plugins/stringUriTemplate
- Source: `C:\projects\luq\package.json:114`
- Shape: exports stringUriTemplatePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringUriTemplate

#### ./plugins/stringContentEncoding
- Source: `C:\projects\luq\package.json:119`
- Shape: exports stringContentEncodingPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringContentEncoding

#### ./plugins/stringContentMediaType
- Source: `C:\projects\luq\package.json:124`
- Shape: exports stringContentMediaTypePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/stringContentMediaType

#### ./plugins/uuid
- Source: `C:\projects\luq\package.json:129`
- Shape: exports uuidPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/uuid

#### ./plugins/numberMin
- Source: `C:\projects\luq\package.json:134`
- Shape: exports numberMinPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/numberMin

#### ./plugins/numberMax
- Source: `C:\projects\luq\package.json:139`
- Shape: exports numberMaxPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/numberMax

#### ./plugins/numberPositive
- Source: `C:\projects\luq\package.json:144`
- Shape: exports numberPositivePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/numberPositive

#### ./plugins/numberNegative
- Source: `C:\projects\luq\package.json:149`
- Shape: exports numberNegativePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/numberNegative

#### ./plugins/numberInteger
- Source: `C:\projects\luq\package.json:154`
- Shape: exports numberIntegerPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/numberInteger

#### ./plugins/numberMultipleOf
- Source: `C:\projects\luq\package.json:159`
- Shape: exports numberMultipleOfPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/numberMultipleOf

#### ./plugins/booleanTruthy
- Source: `C:\projects\luq\package.json:164`
- Shape: exports booleanTruthyPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/booleanTruthy

#### ./plugins/booleanFalsy
- Source: `C:\projects\luq\package.json:169`
- Shape: exports booleanFalsyPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/booleanFalsy

#### ./plugins/arrayMinLength
- Source: `C:\projects\luq\package.json:174`
- Shape: exports arrayMinLengthPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/arrayMinLength

#### ./plugins/arrayMaxLength
- Source: `C:\projects\luq\package.json:179`
- Shape: exports arrayMaxLengthPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/arrayMaxLength

#### ./plugins/arrayUnique
- Source: `C:\projects\luq\package.json:184`
- Shape: exports arrayUniquePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/arrayUnique

#### ./plugins/arrayIncludes
- Source: `C:\projects\luq\package.json:189`
- Shape: exports arrayIncludesPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/arrayIncludes

#### ./plugins/arrayContains
- Source: `C:\projects\luq\package.json:194`
- Shape: exports arrayContainsPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/arrayContains

#### ./plugins/object
- Source: `C:\projects\luq\package.json:199`
- Shape: exports objectPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/object

#### ./plugins/objectMinProperties
- Source: `C:\projects\luq\package.json:204`
- Shape: exports objectMinPropertiesPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/objectMinProperties

#### ./plugins/objectMaxProperties
- Source: `C:\projects\luq\package.json:209`
- Shape: exports objectMaxPropertiesPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/objectMaxProperties

#### ./plugins/objectAdditionalProperties
- Source: `C:\projects\luq\package.json:214`
- Shape: exports objectAdditionalPropertiesPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/objectAdditionalProperties

#### ./plugins/objectPropertyNames
- Source: `C:\projects\luq\package.json:219`
- Shape: exports objectPropertyNamesPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/objectPropertyNames

#### ./plugins/objectPatternProperties
- Source: `C:\projects\luq\package.json:224`
- Shape: exports objectPatternPropertiesPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/objectPatternProperties

#### ./plugins/objectDependentRequired
- Source: `C:\projects\luq\package.json:229`
- Shape: exports objectDependentRequiredPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/objectDependentRequired

#### ./plugins/objectDependentSchemas
- Source: `C:\projects\luq\package.json:234`
- Shape: exports objectDependentSchemasPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/objectDependentSchemas

#### ./plugins/oneOf
- Source: `C:\projects\luq\package.json:239`
- Shape: exports oneOfPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/oneOf

#### ./plugins/literal
- Source: `C:\projects\luq\package.json:244`
- Shape: exports literalPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/literal

#### ./plugins/compareField
- Source: `C:\projects\luq\package.json:249`
- Shape: exports compareFieldPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/compareField

#### ./plugins/requiredIf
- Source: `C:\projects\luq\package.json:254`
- Shape: exports requiredIfPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/requiredIf

#### ./plugins/validateIf
- Source: `C:\projects\luq\package.json:259`
- Shape: exports validateIfPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/validateIf

#### ./plugins/skip
- Source: `C:\projects\luq\package.json:264`
- Shape: exports skipPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/skip

#### ./plugins/transform
- Source: `C:\projects\luq\package.json:269`
- Shape: exports transformPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/transform

#### ./plugins/tupleBuilder
- Source: `C:\projects\luq\package.json:274`
- Shape: exports tupleBuilderPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/tupleBuilder

#### ./plugins/readOnlyWriteOnly
- Source: `C:\projects\luq\package.json:279`
- Shape: exports readOnlyWriteOnlyPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/readOnlyWriteOnly

#### ./plugins/custom
- Source: `C:\projects\luq\package.json:284`
- Shape: exports customPlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/custom

#### ./plugins/jsonSchema
- Source: `C:\projects\luq\package.json:289`
- Shape: exports jsonSchemaPlugin plus the jsonSchema module's named helpers
- Meaning: Subpath specifier @maroonedog/luq/plugins/jsonSchema. Built from a directory (src/core/plugin/jsonSchema/index.ts), not a single file — the only plugin whose entry is a directory.

#### ./plugins/jsonSchemaFullFeature
- Source: `C:\projects\luq\package.json:294`
- Shape: exports jsonSchemaFullFeaturePlugin
- Meaning: Subpath specifier @maroonedog/luq/plugins/jsonSchemaFullFeature. The flagship one-import JSON Schema path documented in README line 75.

#### CSP-safe artifact (no eval / no new Function in shipped code)
- Source: `C:\projects\luq\README.md:66`
- Shape: grep -c "new Function" dist/index.js dist/index.mjs === 0
- Meaning: Advertised differentiator vs AJV (README lines 66, 183). Holds for today's bundles despite src/types/array-type-analysis.ts:196 containing new Function, because that module is unreachable from the entry. Must become a source-level rule, not an accident.

#### kebab-case source filename rule
- Source: `C:\projects\luq\scripts\check-filenames.js:10`
- Shape: /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*\.ts$/ plus a ban on utils/helper/manager/handler/processor/service/common/misc/stuff/data/info/temp/tmp
- Meaning: Enforced by npm run lint:filenames over src/. Currently fails with 65 violations because every plugin file is camelCase. The new layout must satisfy it while keeping camelCase public subpath names.

#### root runtime export set
- Source: `C:\projects\luq\core-entry.ts:1-50`
- Shape: Builder, Result, createPluginRegistry, plugin, pluginPredefinedTransform, pluginConfigurableTransform, pluginBuilderExtension, globalConfig, setGlobalConfig, getGlobalConfig, resetGlobalConfig
- Meaning: What dist/index.js actually exports at runtime, verified via require(). The core entry is deliberately plugin-free — plugins arrive only through subpaths. That separation is the right idea and should be kept; what must change is that the .d.ts must agree with it.

### should-preserve (6)

#### main / module / types fallback fields
- Source: `C:\projects\luq\package.json:5-7`
- Shape: "main": "dist/index.js", "module": "dist/index.mjs", "types": "dist/index.d.ts"
- Meaning: Legacy resolver fallback alongside the exports map. Bundlers without exports support still resolve.

#### @luq-plugin JSDoc annotation block
- Source: `C:\projects\luq\scripts\docs-generator\parse-annotations.ts:37`
- Shape: /** @luq-plugin @name @category @description @allowedTypes @example @params @returns @customError @since @deprecated */
- Meaning: Machine-readable plugin metadata parsed by scripts/docs-generator/parse-annotations.ts to generate docs/generated/plugins.md and plugin-summary.md; also survives into the shipped .d.ts as IDE hover text. Build must preserve comments in declaration output.

#### ES2020 compile target
- Source: `C:\projects\luq\build.js:123`
- Shape: target: "es2020"
- Meaning: Consistent across build.js esbuild calls, .swcrc jsc.target and the benchmark harness. The minimum runtime baseline the package promises.

#### files allowlist
- Source: `C:\projects\luq\package.json:337-339`
- Shape: "files": ["dist"]
- Meaning: Only the build output is published; .npmignore is inert alongside it. Keep the allowlist approach but narrow it to the actual artifacts.

#### npm lifecycle gates
- Source: `C:\projects\luq\package.json:306-318`
- Shape: "prepare": "npm run build", "prepublishOnly": "npm test && npm run lint", "verify": format:check && lint && lint:filenames && typecheck && test
- Meaning: Build runs on install-from-git; tests and lint gate publish; `verify` is the composite local gate. The intent is right even though today's lint and lint:filenames both fail.

#### gzip-based size measurement harness
- Source: `C:\projects\luq\bundle-size-comparison\build-all.js:128-141`
- Shape: esbuild bundle+minify+treeShaking, format esm, target es2020, platform neutral -> zlib.gzipSync(bytes)
- Meaning: How every published size number is produced. Reproducible and worth keeping as a build-time budget assertion.

## Behavioural rules

- Every published module must be free of import-time side effects. `"sideEffects": false` stays in package.json, and it must be true: no top-level registry mutation, no globalThis/window assignment, no env read at module scope (today src/core/builder/validator-factory.ts:463 reads process.env.LUQ_ULTRA_FAST).
- No side-effect imports (`import "./x"`) anywhere in shipped code. Every import must bind names the module actually uses.
- Every plugin-definition call site emits /*#__PURE__*/ so bundlers that ignore the sideEffects field can still drop unreferenced plugins.
- No eval and no `new Function` in any shipped module. This is a public differentiator (README lines 66, 183) and must be enforced by a grep gate over dist/ in CI, not left to reachability accident as it is today.
- Each plugin subpath must be independently loadable without dragging a barrel: the entry re-exports exactly one implementation module. No index.ts sits on the path from a plugin subpath to its implementation.
- The shared core must be a genuine shared module that plugin outputs import, not code inlined into each plugin output. Verify by asserting each dist/plugins/*.mjs contains at least one import of the core; today all of them contain zero imports and each inlines its own copy of the plugin-creator helpers.
- The root entry's runtime exports and its .d.ts must be generated from the same source module. CI asserts that every value export declared in dist/index.d.ts is present in Object.keys(require('dist/index.js')). Today the .d.ts declares 57 plugins the runtime does not have.
- The exports map is generated from the filesystem and written into package.json by the build (or verified by CI to be identical). No hand-maintained plugin-name array, and no advisory file a human must copy-paste.
- Directory names are kebab-case (to satisfy scripts/check-filenames.js), public subpath leaf names are camelCase. The build derives one from the other with an asserted round-trip so the two can never drift.
- The .d.ts output directory layout mirrors the source layout, so every relative specifier in a declaration file is correct by construction. Regex rewriting of import paths inside emitted .d.ts is forbidden — it is what produced the broken `jsonSchema/jsonSchema/types` specifier.
- Declaration emit preserves comments so the @luq-plugin JSDoc block survives into dist/plugins/*.d.ts as IDE hover documentation and as input to the docs generator.
- Any type-only package referenced from a published .d.ts (currently @types/json-schema, via `import { JSONSchema7 } from "json-schema"`) is declared in `dependencies`, never devDependencies.
- The exports map includes "./package.json": "./package.json".
- Declaration emit must fail the build on error. build.js currently wraps `tsc --emitDeclarationOnly` in try/catch and prints "had warnings, continuing".
- `files` publishes only the emitted public artifacts. No mirrored internal .d.ts tree, no __tests__ declarations, no experimental directories, no modules that have no export path.
- Every specifier documented in README must exist in the exports map. Today `@maroonedog/luq/plugins` (README:22) and `@maroonedog/luq/core/builder/plugins/plugin-creator` (README:112) both throw ERR_PACKAGE_PATH_NOT_EXPORTED.
- Publish gate resolves every generated subpath from a scratch consumer package: require() the .js, import() the .mjs, and typecheck the .d.ts under both moduleResolution "bundler" and "node16".
- Bundle size is a build assertion with a declared ceiling, measured the same way as today (esbuild bundle+minify+treeShaking, esm, es2020, then zlib.gzipSync). Publish the core-only gzip figure next to the composed figure so the tree-shaking claim is checkable rather than rhetorical.
- Compile target stays at ES2020 or newer, consistently across the JS emit, the declaration emit and the test transform.

## Not carried forward

- **build.js's hardcoded 57-element `plugins` array as the source of truth for what gets built and exported (build.js:9-92).** — It must be edited by hand in lockstep with src/, and it already carries a special case for `jsonSchema` (a directory, not a file) plus a silent `continue` when a source file is missing. Discovery must come from the filesystem.
- **Emitting exports-config.json and printing "Update package.json with the contents of exports-config.json" (build.js:255-261).** — A manual copy-paste step between the build and the published metadata. The two happen to match today, but nothing enforces it. The build must write package.json#exports itself, or CI must fail on any diff.
- **Regex rewriting of import specifiers inside emitted .d.ts files (build.js:193-225, seven replace() pairs).** — It is textual patching of compiler output. It has already produced a broken specifier: dist/plugins/jsonSchemaFullFeature.d.ts imports "../core/plugin/jsonSchema/jsonSchema/types", a doubled segment pointing at a directory that does not exist. Correct output layout removes the need entirely.
- **Two divergent root entry points — core-entry.ts (runtime, 11 exports) and src/index.ts (types, 68 exports).** — They disagree, so `import { requiredPlugin } from "@maroonedog/luq"` type-checks and returns undefined. One source module must produce both the JS and the .d.ts. Keep core-entry.ts's *policy* (core entry carries no plugins); discard the two-file arrangement.
- **esbuild `external: ["../index"]` for plugin bundles (build.js:174, 187).** — The specifier never matches anything the plugin sources import, so it is a no-op. Every plugin output therefore inlines a private copy of the plugin-creator helpers — verified: dist/plugins/*.mjs contain zero import statements. Externalization must be verified by inspecting the output, not declared and trusted.
- **Swallowing tsc failures (build.js:106-110: `catch (e) { console.log("TypeScript declaration compilation had warnings, continuing...") }`).** — A broken type surface ships silently. This is why the .d.ts/runtime divergence went unnoticed.
- **tsconfig.json's fake strict — `"strict": true` with noImplicitAny, strictNullChecks, strictFunctionTypes, strictPropertyInitialization, noImplicitThis and noImplicitReturns all explicitly false (tsconfig.json:7, 15-20).** — The declaration emit that produces the entire public type surface runs under this config, so the published types were never checked under real strictness. The new tsconfig turns all of them on.
- **tsconfig.json doubling as both the typecheck config and the declaration-emit config, with outDir: dist and include: src/**/*.** — It mirrors the whole internal src tree into dist as .d.ts — dist/core/, dist/types/, dist/core/plugin/__tests__/, dist/core/async.experimental/ — and `files: ["dist"]` publishes all of it. 81 files under dist/core/plugin alone. A dedicated build config emits only public entries.
- **tsconfig.build.json (outFile: ./dist/index.d.ts, module: "amd").** — Referenced by no npm script; the actual build uses tsconfig.json. Dead config, and the AMD/outFile declaration-bundling approach is the wrong shape for a package with 58 entry points.
- **rollup.dts.config.js plus the rollup, rollup-plugin-dts and dts-bundle-generator devDependencies.** — Grepped package.json and build.js: nothing invokes them. Three unused toolchains left over from abandoned attempts at .d.ts bundling.
- **.npmignore.** — Inert. `files: ["dist"]` takes precedence over it entirely. Two overlapping mechanisms invite the belief that one of them is doing something.
- **.swcrc as a build input.** — It is only consumed by `npm run test:swc`. It is listed among the build files but participates in no build. Its jsc.target: es2020 is worth keeping as the target baseline; the file itself is a test-transform config and belongs with the test setup.
- **jest.swc.config.js as a second, divergent test config alongside jest.config.js.** — Two configs with different roots, testMatch, coverage settings and transforms. One test runner configuration.
- **15 plugin modules in src/core/plugin that have no export path at all: conditionalSchema, fromContext, numberFinite, numberRange, objectRecursively, optionalIf, orFail, stitch, stitch-typed, stitchSimple, stringAlphanumeric, stringEndsWith, stringExactLength, stringStartsWith, unionGuard.** — They are re-exported by src/core/plugin/index.ts but that barrel is not an entry point, and none of them appear in the exports map or in src/index.ts. Their .d.ts files still ship. Each is either promoted to a real subpath or deleted — no half-published modules.
- **The alias export `objectRecursivelyPlugin as recursivelyPlugin` alongside `objectRecursivelyPlugin` (src/core/plugin/index.ts:70-71).** — Two public names for one plugin, in a barrel that is not even an entry point. One symbol, one name.
- **`new Function` code generation in src/types/array-type-analysis.ts:196 (createNestedLoopValidator).** — Directly contradicts the CSP-safe claim. It survives today only because it is unreachable from the shipped entries. It must not exist in the new source at all.
- **Publishing sourcemaps for the core bundle but not for plugins (build.js: sourcemap true at :120/:133, false at :169/:182).** — Inconsistent, and dist/index.js.map is 483 KB — larger than everything else in the package combined. Decide one policy for the whole package.
- **Claiming "19-23KB gzipped" as evidence of tree-shaking in README:68.** — 17,734 B of the 19,562 B "simple" figure is the core bundle; the six plugins contribute ~2.1 KB. The number describes a floor, not a saving. Republish it only alongside the core-only figure, and only after the new core is measured.
- **The `verify` script as currently constituted (format:check && lint && lint:filenames && typecheck && test).** — The composition is right but it is not run: lint reports 2051 violations and lint:filenames reports 65. Keep the script, but the new repo must start green and a CI workflow must run it — .github/workflows contains only deploy-docs.yml today.
- **bundle-size-comparison/ as a checked-in directory with its own node_modules, package-lock.json (99 KB), committed dist/ of 16 competitor bundles, and a package name of "formtailor-bundle-size-comparison".** — Stale identity (the library was renamed to Luq), committed build output, and a second dependency tree inside the repo. Keep the measurement method; do not keep the directory in this shape.

## Published symbols (83)

`@maroonedog/luq`, `main`, `module`, `types`, `exports`, `sideEffects`, `files`, `license`, `repository`, `homepage`, `bugs`, `keywords`, `.`, `./plugins/required`, `./plugins/optional`, `./plugins/nullable`, `./plugins/stringMin`, `./plugins/stringMax`, `./plugins/stringEmail`, `./plugins/stringPattern`, `./plugins/stringUrl`, `./plugins/stringDate`, `./plugins/stringDatetime`, `./plugins/stringTime`, `./plugins/stringIpv4`, `./plugins/stringIpv6`, `./plugins/stringHostname`, `./plugins/stringDuration`, `./plugins/stringBase64`, `./plugins/stringJsonPointer`, `./plugins/stringRelativeJsonPointer`, `./plugins/stringIri`, `./plugins/stringIriReference`, `./plugins/stringUriTemplate`, `./plugins/stringContentEncoding`, `./plugins/stringContentMediaType`, `./plugins/uuid`, `./plugins/numberMin`, `./plugins/numberMax`, `./plugins/numberPositive`, `./plugins/numberNegative`, `./plugins/numberInteger`, `./plugins/numberMultipleOf`, `./plugins/booleanTruthy`, `./plugins/booleanFalsy`, `./plugins/arrayMinLength`, `./plugins/arrayMaxLength`, `./plugins/arrayUnique`, `./plugins/arrayIncludes`, `./plugins/arrayContains`, `./plugins/object`, `./plugins/objectMinProperties`, `./plugins/objectMaxProperties`, `./plugins/objectAdditionalProperties`, `./plugins/objectPropertyNames`, `./plugins/objectPatternProperties`, `./plugins/objectDependentRequired`, `./plugins/objectDependentSchemas`, `./plugins/oneOf`, `./plugins/literal`, `./plugins/compareField`, `./plugins/requiredIf`, `./plugins/validateIf`, `./plugins/skip`, `./plugins/transform`, `./plugins/tupleBuilder`, `./plugins/readOnlyWriteOnly`, `./plugins/custom`, `./plugins/jsonSchema`, `./plugins/jsonSchemaFullFeature`, `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts`, `dist/plugins/<name>.js`, `dist/plugins/<name>.mjs`, `dist/plugins/<name>.d.ts`, `npm run build`, `npm run verify`, `npm run lint:filenames`, `npm run typecheck`, `npm run generate-docs`, `prepare`, `prepublishOnly`

