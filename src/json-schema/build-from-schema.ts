// ===========================================================================
// L8  src/json-schema/build-from-schema.ts — fromJsonSchema<T>().
//
// THE DEFAULT TYPE ARGUMENT IS `Record<string, unknown>`, NEVER `any`. A caller
// who knows the shape writes `fromJsonSchema<User>(bag, schema)` and gets the
// declared paths checked against `User`; a caller who does not gets the record,
// under which `FieldPath<Record<string, unknown>>` accepts any dotted string.
// That is an ESCAPE HATCH, not type safety: the default checks NO path, and
// `pick("anything")` type-checks and answers `unknown`. It is written here so
// nobody has to infer it from a `Validator<Record<string, unknown>>`.
//
// The plugin bag arrives as an ARGUMENT. Importing the forty-five plugin entry
// files from this module would make every one of them statically reachable from
// the JSON Schema layer and end per-plugin tree-shaking, which is the whole
// reason the two bundles are separate plugins (step 26 generates the bag).
//
// Every rule is built inside `collectRules`, which build() calls exactly once
// per declared path, so the resolved GlobalConfig the rules read is the one
// build() resolved and never a second, earlier answer.
// ===========================================================================
import type {
  FieldBuilderSurface,
  PlanBackedValidator,
} from "../builder/builder-surface.types";
import { createFieldBuilderSurface } from "../builder/create-field-builder";
import type { FieldEntry } from "../builder/field-entry.types";
import type { Validator } from "../builder/validator.types";
import type { ChainBuildContext } from "../chain/create-chain-node";
import { eraseSchemaValidator } from "../core/type-erasure";
import type { Rule } from "../plugin-kit/compiled-rule";
import type { GlobalConfig } from "../types/global-config";
import { createStructuralContext } from "./create-structural-context";
import { declarePresenceRules } from "./declare-presence";
import { createLocalScope } from "./ref-scope";
import type { Draft07Schema } from "./draft07.types";
import { isDraft07Schema } from "./draft07.types";
import { flattenSchema } from "./flatten-schema";
import type { SchemaFieldDeclaration } from "./flatten-schema";
import type { JsonSchemaBag } from "./json-schema-bag.types";
import { expandSchemaRules, readChildSchemas } from "./schema-to-declarations";

/** A value that is not a schema at all. Named, and refused at the boundary. */
export class NotASchemaError extends Error {
  readonly received: unknown;

  constructor(received: unknown) {
    super(
      "fromJsonSchema expects a JSON Schema document: an object, or the " +
        `boolean form of Draft-07 §4.4. Received ${typeof received}.`
    );
    this.name = "NotASchemaError";
    this.received = received;
    Object.setPrototypeOf(this, NotASchemaError.prototype);
  }
}

/** The rules ONE declared path carries: its presence policy and its schema. */
function collectDeclaredRules(
  declaration: SchemaFieldDeclaration,
  bag: JsonSchemaBag,
  root: Draft07Schema,
  chain: ChainBuildContext
): readonly Rule[] {
  const context = createStructuralContext(
    { bag, scope: createLocalScope(root), chain },
    declaration.schema,
    Object.freeze([])
  );
  return Object.freeze([
    ...declarePresenceRules({
      isRequired: declaration.isRequired,
      severity: chain.config.defaultSeverity,
    }),
    ...expandSchemaRules(declaration.schema, context),
  ]);
}

/** One pending `.v()` per declared path, with its callback still unrun. */
export function buildFieldEntries(
  bag: JsonSchemaBag,
  schema: unknown
): readonly FieldEntry[] {
  if (!isDraft07Schema(schema)) throw new NotASchemaError(schema);
  return flattenSchema(schema, readChildSchemas).map((declaration) => ({
    path: declaration.path,
    defaultOf: null,
    applyDefaultToNull: false,
    normalize: null,
    // 宣言は控えない。ここが組み立てるのは JSON Schema から起こした
    // ルールで、利用者が連鎖メソッドを呼んだわけではない。空配列ではなく
    // null にしておくと、書き出す側が「制約が無い」ではなく
    // 「宣言を持っていない」と言い切れる。
    collectRules: (chain: ChainBuildContext) => ({
      rules: collectDeclaredRules(declaration, bag, schema, chain),
      calls: null,
    }),
  }));
}

/** The erased front door: the declarations, with nothing compiled yet. */
export function buildFromSchema(
  bag: JsonSchemaBag,
  schema: unknown,
  config?: GlobalConfig
): FieldBuilderSurface {
  return createFieldBuilderSurface(bag, config, buildFieldEntries(bag, schema));
}

/**
 * The declared type is put back on by `eraseSchemaValidator`, the fourth
 * function in src/core/type-erasure.ts — the one file the code standard allows
 * to assert. Step 25 expressed this as an OVERLOAD PAIR instead, because
 * type-erasure.ts was not in its produces list; an overload is accepted by
 * TypeScript on lenient compatibility rules and so was never audited anywhere.
 * The call below is, in the file where every escape hatch is reviewed together.
 */
export function fromJsonSchema<T extends object = Record<string, unknown>>(
  bag: JsonSchemaBag,
  schema: unknown,
  config?: GlobalConfig
): Validator<T> {
  const planBacked: PlanBackedValidator = buildFromSchema(
    bag,
    schema,
    config
  ).build();
  return eraseSchemaValidator<Validator<T>>(planBacked);
}
