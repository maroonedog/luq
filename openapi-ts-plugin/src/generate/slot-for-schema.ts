// ===========================================================================
// openapi-ts-plugin/src/generate/slot-for-schema.ts
//
// スキーマの type → `b.` のあとに来るスロット名。
//
// 本体の src/json-schema は type をスロット選択に使うと keyword-map-core.ts に
// 書いているだけで、対応表を値として持っていない (実行時はチェーンが既に
// 型から決まっているため必要ない)。生成器はソースを書くので必要になる。
// ===========================================================================
import type { Draft07SchemaObject } from "../../../src/json-schema/draft07.types";

const SLOT_BY_TYPE: Readonly<Record<string, string>> = {
  string: "string",
  number: "number",
  integer: "number",
  boolean: "boolean",
  array: "array",
  object: "object",
};

/**
 * type が無いスキーマ、複数 type、null 単独はどのスロットにも寄せられないので
 * "any" に落とす。any スロットは全プラグインを受けるので、そこに生える規則
 * (required / literal / oneOf) はそのまま書ける。
 */
export function slotForSchema(schema: Draft07SchemaObject): string {
  const type = (schema as { type?: unknown }).type;
  if (typeof type !== "string") return "any";
  return SLOT_BY_TYPE[type] ?? "any";
}
