// ===========================================================================
// L10 src/standard-schema/emit-field-schema.ts
//
// Turns one field's declared calls into one JSON Schema object.
//
// The type is not readable from a declaration on its own. What IS readable is
// which slot the chain stood in, which each call carries — every call in
// `.string.required()` stands in the string slot, and that decides `type`.
// A field whose calls span more than one slot has no single type, so it counts
// as unwritable.
// ===========================================================================
import type { DeclaredCall } from "../chain/declared-call.types";
import type { TypeName } from "../types";
import { PLUGIN_KEYWORDS } from "./plugin-keyword-map";
import {
  UnrepresentableRuleError,
  type UnrepresentablePolicy,
} from "./unrepresentable-rule-error";

/** One emitted field. `required` is separate: the parent assembles it. */
export interface EmittedField {
  readonly schema: Record<string, unknown>;
  readonly isRequired: boolean;
}

/** Slot to JSON Schema type name; undefined when it cannot be decided. */
const TYPE_OF_SLOT: Readonly<Partial<Record<TypeName, string>>> = Object.freeze(
  {
    string: "string",
    number: "number",
    boolean: "boolean",
    array: "array",
    object: "object",
    // date is not a JSON type. Draft-07 convention writes it as a string with
    // `format: "date-time"`, but the date slot judges Date instances, which
    // are not JSON values. Counted as unwritable rather than conflated.
  }
);

function typeOf(calls: readonly DeclaredCall[]): string | undefined {
  const slots = new Set(calls.map((call) => call.slot));
  slots.delete("any");
  if (slots.size !== 1) return undefined;
  const [slot] = [...slots];
  return slot === undefined ? undefined : TYPE_OF_SLOT[slot];
}

/**
 * How `type` is spelled. Draft-07 expresses `.nullable()` as a list of
 * types (`{"type": ["string", "null"]}`). `{"nullable": true}` is the
 * OpenAPI 3.0 spelling and is not in the JSON Schema vocabulary.
 */
function typeKeyword(
  calls: readonly DeclaredCall[],
  fieldPath: string,
  policy: UnrepresentablePolicy
): Record<string, unknown> {
  const isInteger = calls.some((call) => call.pluginName === "numberInteger");
  const isNullable = calls.some((call) => call.pluginName === "nullable");
  const base = isInteger ? "integer" : typeOf(calls);
  if (base === undefined) {
    if (policy === "throw") {
      throw new UnrepresentableRuleError(
        fieldPath,
        "the chain",
        "its declarations do not settle on one JSON type"
      );
    }
    return {};
  }
  return { type: isNullable ? [base, "null"] : base };
}

/** Makes one field's schema from that field's declared calls. */
export function emitFieldSchema(
  fieldPath: string,
  calls: readonly DeclaredCall[],
  policy: UnrepresentablePolicy
): EmittedField {
  if (calls.length === 0 && policy === "throw") {
    throw new UnrepresentableRuleError(
      fieldPath,
      "this field",
      "no declaration was recorded for it (it was not built through the " +
        "builder chain)"
    );
  }
  const schema: Record<string, unknown> = typeKeyword(calls, fieldPath, policy);
  for (const call of calls) {
    const toKeywords = PLUGIN_KEYWORDS[call.pluginName];
    if (toKeywords === undefined) {
      if (policy === "throw") {
        throw new UnrepresentableRuleError(
          fieldPath,
          call.pluginName,
          "no JSON Schema keyword expresses it"
        );
      }
      continue;
    }
    const keywords = toKeywords(call.args);
    // undefined is the table saying it cannot express THESE arguments, which
    // is the same answer as having no entry at all: refuse, rather than emit a
    // schema missing a constraint the validator enforces. null is different —
    // it means type or presence already carries the declaration.
    if (keywords === undefined) {
      if (policy === "throw") {
        throw new UnrepresentableRuleError(
          fieldPath,
          call.pluginName,
          "no JSON Schema keyword expresses the arguments it was given"
        );
      }
      continue;
    }
    if (keywords === null) continue;
    Object.assign(schema, keywords);
  }
  return {
    schema,
    // `.optional()` counts wherever it appears in the chain, not only first.
    isRequired:
      calls.some((call) => call.pluginName === "required") &&
      !calls.some((call) => call.pluginName === "optional"),
  };
}
