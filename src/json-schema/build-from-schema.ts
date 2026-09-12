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
import type { DialectOptions } from "./assert-supported-dialect";
import { assertSupportedDialect } from "./assert-supported-dialect";
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
  schema: unknown,
  options: DialectOptions = {}
): readonly FieldEntry[] {
  if (!isDraft07Schema(schema)) throw new NotASchemaError(schema);
  // Before any keyword is read: what the document's keywords MEAN depends on
  // the dialect it declares, and Luq reads every one of them as Draft-07.
  assertSupportedDialect(schema, options);
  return flattenSchema(schema, readChildSchemas).map((declaration) => ({
    path: declaration.path,
    defaultOf: null,
    applyDefaultToNull: false,
    normalize: null,
    // No record of declared calls: what is assembled here comes from a
    // document, and nobody called a chain method. null rather than the empty
    // list is what lets a writer say "not known" instead of "none".
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
  config?: GlobalConfig,
  options?: DialectOptions
): FieldBuilderSurface {
  return createFieldBuilderSurface(
    bag,
    config,
    buildFieldEntries(bag, schema, options)
  );
}

/**
 * Converts a JSON Schema document into a validator.
 *
 * THE INPUT LIMIT IS DRAFT-07, and it is a limit on what may be handed in, not
 * only a statement of how much of Draft-07 is covered. A document declaring
 * 2019-09 or 2020-12 in its root `$schema` is REFUSED with an
 * `UnsupportedDialectError` rather than read as Draft-07, because the two
 * dialects disagree about what an unchanged keyword means: from 2019-09 on
 * `$ref` is an ordinary applicator whose siblings are applied, while Draft-07
 * §8.3 replaces the node, so `{"$ref": "#/$defs/name", "minLength": 5}` read as
 * Draft-07 loses the `minLength` and accepts a value the document forbids. A
 * document with NO `$schema` is read as Draft-07 and always has been. Pass
 * `{ assumeDraft07: true }` as the fourth argument to read a newer-dialect
 * document under Draft-07 rules deliberately, with that reading's consequences.
 *
 * `T` defaults to `Record<string, unknown>`, never `any`; under the default NO
 * declared path is checked. See the header of this file, which owns that
 * escape hatch.
 *
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
  config?: GlobalConfig,
  options?: DialectOptions
): Validator<T> {
  const planBacked: PlanBackedValidator = buildFromSchema(
    bag,
    schema,
    config,
    options
  ).build();
  return eraseSchemaValidator<Validator<T>>(planBacked);
}
