// ===========================================================================
// L10 src/standard-schema/emit-field-schema.ts
//
// 一つのフィールドの宣言列を、一つの JSON Schema オブジェクトにする。
//
// 型は宣言そのものからは分からない。分かるのは連鎖がどのスロットに
// いたかで、それは DeclaredCall.slot が持っている。`.string.required()` の
// 二つの呼び出しはどちらも slot が "string" なので、そこから `type` を決める。
// スロットが混ざったフィールド (union など) は型を一つに決められないので、
// 書けないものとして扱う。
// ===========================================================================
import type { DeclaredCall } from "../chain/declared-call.types";
import type { TypeName } from "../types";
import { PLUGIN_KEYWORDS } from "./plugin-keyword-map";
import {
  UnrepresentableRuleError,
  type UnrepresentablePolicy,
} from "./unrepresentable-rule-error";

/** 書き出した一つのフィールド。`required` は親が組み立てるので外に出す。 */
export interface EmittedField {
  readonly schema: Record<string, unknown>;
  readonly isRequired: boolean;
}

/** スロットから JSON Schema の型名へ。決められないものは undefined。 */
const TYPE_OF_SLOT: Readonly<Partial<Record<TypeName, string>>> = Object.freeze(
  {
    string: "string",
    number: "number",
    boolean: "boolean",
    array: "array",
    object: "object",
    // date は JSON の型ではない。`format: "date-time"` を持つ文字列として
    // 書き出すのが Draft-07 の慣習だが、Luq の date スロットは Date
    // インスタンスを判定しており、JSON の値ではない。混同を避けて書けない
    // ものにする。
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
 * `type` をどう書くか。`.nullable()` は Draft-07 では型の並びで表す
 * (`{"type": ["string", "null"]}`)。`{"nullable": true}` は OpenAPI 3.0 の
 * 綴りで、JSON Schema の語彙には無い。
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

/** 一つのフィールドの宣言列から、そのフィールドのスキーマを作る。 */
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
    if (keywords === null) continue;
    Object.assign(schema, keywords);
  }
  return {
    schema,
    // `.optional()` は後から書いても効く。宣言のどこかにあれば任意である。
    isRequired:
      calls.some((call) => call.pluginName === "required") &&
      !calls.some((call) => call.pluginName === "optional"),
  };
}
