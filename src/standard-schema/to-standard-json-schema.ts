// ===========================================================================
// L10 src/standard-schema/to-standard-json-schema.ts
//
// Shows a built Validator as a Standard JSON Schema v1.
//
// In the spec, StandardJSONSchemaV1 is a SIBLING of StandardSchemaV1 and both
// derive from StandardTypedV1. version / vendor / types belong to both, so
// putting validate and jsonSchema on one `~standard` satisfies both faces at
// once — what this returns is a StandardSchemaV1 as well.
//
// Two decisions.
//
// 1. input and output return the SAME schema. The spec asks for the input type
//    and the output type separately, and for a validator with a transform they
//    genuinely differ. A Luq declaration does not carry a transform's RESULT
//    type — a function's return value is unknowable without running it — so
//    inventing a second shape would be a lie. Both return the same thing, and
//    a field declaring a transform counts as unwritable.
//
// 2. An unwritable declaration throws by default. See
//    unrepresentable-rule-error.ts.
//
// Importing this module is also what asks the chain to keep a record of the
// declared calls, which it does not do on its own.
// ===========================================================================
import type { Validator } from "../builder/validator.types";
import { readDeclaredCalls } from "../builder/declared-calls-store";
import { assembleJsonSchema } from "./assemble-json-schema";
import { resolveJsonSchemaTarget } from "./json-schema-target";
import { DeclarationsUnavailableError } from "./declarations-unavailable-error";
import { readUnrepresentablePolicy } from "./unrepresentable-rule-error";
import { toStandardSchema, type StandardLuqSchema } from "./to-standard-schema";
import { installJsonSchemaDeclarationRecorder } from "./declaration-recorder";

// At module scope, not inside the export: this has to be in place before any
// build() runs, and a chain that already ran cannot be asked again.
installJsonSchemaDeclarationRecorder();

/** The spec's Options: target is required, libraryOptions is vendor-defined. */
export interface JsonSchemaOptions {
  readonly target: string;
  readonly libraryOptions?: Record<string, unknown> | undefined;
}

interface JsonSchemaConverter {
  readonly input: (options: JsonSchemaOptions) => Record<string, unknown>;
  readonly output: (options: JsonSchemaOptions) => Record<string, unknown>;
}

/** A `~standard` carrying both validate and jsonSchema. */
export type StandardJsonSchemaLuqSchema<
  T extends object,
  TParsed = T,
> = StandardLuqSchema<T, TParsed> & {
  readonly "~standard": StandardLuqSchema<T, TParsed>["~standard"] & {
    readonly jsonSchema: JsonSchemaConverter;
  };
};

export function toStandardJsonSchema<T extends object, TParsed = T>(
  validator: Validator<T, TParsed>
): StandardJsonSchemaLuqSchema<T, TParsed> {
  const declared = readDeclaredCalls(validator);
  const emit = (options: JsonSchemaOptions): Record<string, unknown> => {
    // Refuse an unsupported target before writing anything. Same order even
    // when there is nothing to write, or a wrong target passes as an empty
    // schema instead of an error.
    const schemaUri = resolveJsonSchemaTarget(options.target);
    if (declared === undefined) throw new DeclarationsUnavailableError();
    return {
      $schema: schemaUri,
      ...assembleJsonSchema(
        declared,
        readUnrepresentablePolicy(options.libraryOptions)
      ),
    };
  };
  const standard = toStandardSchema(validator);
  return {
    ...standard,
    "~standard": {
      ...standard["~standard"],
      jsonSchema: { input: emit, output: emit },
    },
  };
}
