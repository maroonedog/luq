---
name: luq-code-standards
description: TypeScript code standards for the Luq repository — one responsibility per class, 200 lines per file, strict naming, no `as any`, and comments that stay inside their own file. Read this before creating, refactoring, or reviewing any TypeScript under src/, and before deciding how to split a file, carve out a responsibility, type something, or name it.
---

# Luq code standards

Applies to TypeScript under `src/`. Where existing code breaks a rule, bring the
part you touched into line — do not leave it because its neighbours are wrong.

**Write everything in English**: comments, commit messages, PR bodies, docs,
config notes, test names. The repository had both languages mixed file by file
and sometimes inside one file, which makes it unreadable to contributors and
unsearchable for everyone.

## 1. 200 lines per file

- **200 lines** including comments and blank lines (enforced by `eslint max-lines`).
- Over the limit does not mean "split it", it means "**this file has two or more
  responsibilities**". Cut on the responsibility boundary.
- Packing statements onto one line to get under the limit is a violation. Design
  so the formatted result fits.

### Where the cut usually goes
| Symptom | Extract to |
|---|---|
| A block of branches that only handles one type | A module for that type (`string-length-validator.ts`) |
| "prepare → run → format" living in one function | One pure function per step, one file each |
| Constant tables or error messages mixed in | `*-messages.ts` / `*-constants.ts` |
| Type declarations living beside logic | `*.types.ts` |

## 2. One responsibility per class

- One class per file (`max-classes-per-file: 1`).
- If describing the class needs an "and", split it.
- No class where no state is needed. Use pure functions and types — Luq composes
  functions, and a needless class breaks tree-shaking.
- A class name ending in Manager / Handler / Helper / Util / Processor / Service
  is a sign the responsibility was never put into words. Banned (see §3).

## 3. Name strictly, never abstractly

**Banned words** (alone or as a suffix):
`util` / `utils` / `helper` / `helpers` / `manager` / `handler` / `processor` /
`service` / `common` / `misc` / `stuff` / `data` / `info` / `item` / `temp` /
`tmp` / `obj` / `val` / `res` / `ret` / `foo`

**How to replace one**: put "what" and "does what" into the name.

| ✗ | ✓ |
|---|---|
| `FieldHelper` | `FieldPathResolver` |
| `validateData(d)` | `validateEmailFormat(email)` |
| `processItem(x)` | `compileFieldRuleToValidator(rule)` |
| `getInfo()` | `getPluginMetadata()` |
| `handleResult(r)` | `mergeIssuesIntoResult(issues, result)` |
| `utils/index.ts` | `field-path/parse-field-path.ts` |

**Rules**:
- Function = verb phrase. Start with `is` / `has` / `can` / `should` when it
  returns a boolean.
- Variable = a noun you can identify the contents from. `result` alone is not
  allowed; `validationResult` is.
- Type and interface = noun phrase. No `I` prefix.
- File name = kebab-case, matching the main exported symbol
  (`FieldPathResolver` → `field-path-resolver.ts`).
- Abbreviate only what is already standard (`json`, `url`, `id`, `uri`, `dsl`).
  Never invent one.

## 4. No `as any`

- No `as any`, `: any`, `any[]`, the `Function` type, or `@ts-ignore`.
- **Try these in order**:
  1. Write the real type, or take it as a generic
  2. `unknown` plus a type guard (`isValidationIssue(x): x is ValidationIssue`)
  3. A discriminated union (`{ kind: "string"; ... } | { kind: "number"; ... }`)
  4. A cast to the concrete type (`as StringFieldBuilder`, never `as any`)
- **If you must suppress**, put the reason on the line above. A suppression with
  no reason gets rejected in review.
  ```ts
  // Plugins are composed dynamically, so the type cannot be settled here.
  // The `use()` signature on the calling side is what keeps this sound.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ```
- Do not dodge a type puzzle with `any`. Wanting to is the signal that the type
  design is broken — fix the design.

## 5. A comment must stand on its own inside its file

This is the rule that gets broken most, and nothing catches it.

**A comment may explain what THIS file decides, and why.** It may not explain
this file by narrating what other files contain. The moment it does, an edit
somewhere else makes it a lie, and no test, lint rule, or reviewer will notice —
the comment is still self-consistent, just wrong.

**Banned in a comment:**

| ✗ | Why it rots |
|---|---|
| Restating another file's contents ("`run-field.ts` applies the default, then normalize, then presence") | That order changes there, not here |
| A measured number owned elsewhere ("core-only is 8,208 B", "45–54% of the garbage") | The measurement is re-taken and this copy is not |
| A count of things that live elsewhere ("the four callers", "all 77 plugins", "three pages say this") | Someone adds a fifth |
| Narrating another layer's design to justify this one | That layer gets refactored |
| A changelog of what this file used to do, or what was tried and reverted | Belongs in git history |

**Allowed:**

- A bare pointer: `// See declared-call.types.ts.` A pointer survives an edit to
  the target; a summary of the target does not.
- What this file's own code does, and the reason the decision went this way.
- A constraint this file must satisfy, stated as a rule rather than as a story
  about who else depends on it.
- A number this file itself owns, next to the code that produces it.

**Example.** A port declaration:

```ts
// ✗ — every sentence rots somewhere else
// L3 declares the PORT, and standard-schema/declaration-recorder.ts installs it
// when to-standard-json-schema.ts is loaded. Measured: core-only went 8,190 B
// to 8,208 B, so the 18 B is compression ratio, not volume — the object literal
// keys that disappeared also appear elsewhere in the bundle.

// ✓ — true regardless of what any other file does
// The chain records nothing by itself. Whoever wants the declared calls
// installs a recorder here first; with none installed the chain does not build
// the record and does not copy it.
```

Where the removed explanation is genuinely worth keeping, it belongs somewhere
that is maintained with the thing it describes: measurements next to the
measurement config, cross-layer design in `docs/design/`, history in git.

**Do not duplicate.** One topic, one owner. If two files would say the same
thing, one of them says it and the other points.

## 6. Everything else

- One file, one public concept. `index.ts` holds re-exports and no implementation.
- No import cycles.
- Do not break a public signature or an existing test. Say so first if you must.
- Before you finish:
  ```bash
  npm run lint && npm run format:check && npm test
  ```

## 7. The design, which does not change

Luq's core stays as it is. A refactor re-expresses the same design with more
precise types and smaller responsibilities.

- **Builder chain API**: `Builder().use(plugin).for<T>().v(field, b => ...).build()`
- **Per-plugin tree-shaking**: plugins are independent modules, side-effect free,
  statically reachable
- **CSP-safe**: never `eval` or `new Function`
- **Existing TypeScript types are the schema**: no redeclaration required
- **JSON Schema Draft-07 compatible**

## 8. Limits on type-level tests (measured)

A type-level test written the wrong way stops the compiler.

### Round-trip tests on `FieldPath<T>` need a bounded fixture

Checking "for every literal P that `FieldPath<T>` produces, `ValueAtPath<T,P>` is
not `never`" costs instantiations proportional to paths × depth.

| Subject | Instantiations | Time | Result |
|---|---|---|---|
| Model of width 6, depth 5 | — | 1.95s | passes |
| Model of width 8, depth 6 | 9,200,000 | 16.5s / 2.2GB | **fails with TS2589** |

**Never point this test at a realistically sized model.** Pin it to a bounded
fixture.

The generator itself is fast (718,933 instantiations / 0.64s on the width-8
depth-6 model), and so is real use (248,782 / 0.69s for a 13-field builder with
three levels of array wildcard). The limit is on the test, not on users.

### Chain length barely affects compile time

With 45 plugins over 100 fields: a 6-step chain costs 172,521 / 0.87s, a 25-step
chain 182,997 / 0.88s. "More plugins makes completion slow" does not hold when
measured. Measure again after any change that adds type parameters.

## 9. Mutation-test every safety mechanism

This design has twice produced a test that looked like it checked "this must
fail" and checked nothing. Both times it took actually breaking the code to find
out.

- After writing `@ts-expect-error`, confirm **the line is not reported as
  unused**. If it is, the thing that should fail is passing.
- After building a guard in the type system (exhaustive marker checks, keyword
  binding checks, union guard exhaustiveness), **break it on purpose and confirm
  the compile error appears**.
- Suspect any check that only declares. Some defects only surface once calling
  code is written — an optional marker argument that leaked its marker slipped
  past three declaration-only checks.
