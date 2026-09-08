// ===========================================================================
// L8  src/json-schema/declare-additional-properties.ts
// `additionalProperties` の2つの形と、その対象を決める `patternProperties`。
//
// declare-object-keywords.ts から切り出した。あちらが 200 行を超えたのが
// きっかけだが、境界としても妥当: §6.5.4 の「properties にも
// patternProperties にも該当しないキー」という定義は、この2つの形と
// patternProperties の3者だけで閉じている。
// ===========================================================================
import type { Rule } from "../plugin-kit/compiled-rule";
import { applyKeywordBinding } from "./apply-keyword-binding";
import type { ConverterChain } from "./apply-keyword-binding";
import type { Draft07SchemaObject } from "./draft07.types";
import { additionalPropertiesBinding } from "./keyword-map-object";
import type { StructuralContext } from "./structural-expansion.types";

const NO_RULES: readonly Rule[] = Object.freeze([]);

/**
 * `patternProperties` のキー、つまり正規表現の文字列。
 * additionalProperties が「該当しないキー」を選ぶのに要る。
 */
export function patternPropertyKeys(
  schema: Draft07SchemaObject
): readonly string[] {
  const patterns = schema.patternProperties;
  if (patterns === undefined || patterns === null) return Object.freeze([]);
  return Object.freeze(Object.keys(patterns));
}

/**
 * BOOLEAN 形。
 *
 * キーワード束縛は自分の値 (boolean) しか運べないので、パターンがあるときだけ
 * プラグインを直接呼ぶ。束縛のほうは残す: キーワード表と「そのメソッドが
 * 実在する」というコンパイル時のゲートはそちらが持っている。
 */
export function applyAdditionalPropertiesBoolean(
  chain: ConverterChain<"object">,
  schema: Draft07SchemaObject,
  allowed: boolean
): ConverterChain<"object"> {
  const patterns = patternPropertyKeys(schema);
  return patterns.length === 0
    ? applyKeywordBinding(chain, additionalPropertiesBinding, allowed)
    : chain.additionalProperties(allowed, undefined, patterns);
}

/** SCHEMA 形: 宣言にもパターンにも該当しない値が、そのスキーマに従う。 */
export function declareAdditionalPropertiesSchema(
  schema: Draft07SchemaObject,
  context: StructuralContext
): readonly Rule[] {
  const additional = schema.additionalProperties;
  if (additional === undefined || typeof additional === "boolean") {
    return NO_RULES;
  }
  const plugin = context.bag.objectAdditionalPropertiesSchema;
  return Object.freeze([
    plugin.build(
      context.ruleContextFor(plugin.name, "additionalProperties"),
      context.collectSubSchemaRules(additional),
      undefined,
      patternPropertyKeys(schema)
    ),
  ]);
}
