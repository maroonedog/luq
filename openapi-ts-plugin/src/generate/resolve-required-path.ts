// ===========================================================================
// openapi-ts-plugin/src/generate/resolve-required-path.ts
//
// ネストした `required` を `.required()` に落としてよいかを判定する。
//
// 実行時 (src/json-schema/declare-required-properties.ts) は `required` を
// 「子の presence」ではなく「オブジェクト側の規則」にしている。理由はそこの
// コメントに書かれているとおりで、子の presence 規則は **親ごと不在** のときも
// 発火してしまうが、Draft-07 はサブスキーマを存在する値にしか適用しないため。
//
//   { properties: { a: { properties: { b: {} }, required: ["b"] } } }
//   に対して {} は VALID。a が無いので a のサブスキーマは適用されない。
//   ここで "a.b" に .required() を書くと {} を拒否してしまい、実行時と食い違う。
//
// ただし **祖先のオブジェクトがすべて必須なら** 話が変わる。親が必ず存在する
// なら「子が undefined」は「親にそのキーが無い」としか読めないので、
// .required() は正しい。生成器はその場合だけ .required() を出す。
//
// 配列は鎖を切らない。配列自体が不在なら要素は1つも無く、要素の規則は走らない。
// したがって items[*].sku の判定に items の必須性は効かない。
// ===========================================================================
import type {
  Draft07Schema,
  Draft07SchemaObject,
} from "../../../src/json-schema/draft07.types";
import {
  isDraft07Schema,
  isSchemaObject,
} from "../../../src/json-schema/draft07.types";

/** "items[*].sku" -> ["items[*]", "sku"]。"[*]" は直前のキーに付いたまま。 */
export function splitDeclaredPath(path: string): readonly string[] {
  return path === "" ? [] : path.split(".");
}

function propertyOf(
  schema: Draft07SchemaObject,
  key: string
): Draft07SchemaObject | undefined {
  const properties = (schema as { properties?: unknown }).properties;
  if (properties === null || typeof properties !== "object") return undefined;
  const child = (properties as Record<string, unknown>)[key];
  if (!isDraft07Schema(child)) return undefined;
  return isSchemaObject(child) ? child : undefined;
}

function itemsOf(schema: Draft07SchemaObject): Draft07SchemaObject | undefined {
  const items = (schema as { items?: unknown }).items;
  if (!isDraft07Schema(items)) return undefined;
  return isSchemaObject(items) ? items : undefined;
}

function listsAsRequired(schema: Draft07SchemaObject, key: string): boolean {
  const required = (schema as { required?: unknown }).required;
  return Array.isArray(required) && required.includes(key);
}

/**
 * そのパスに `.required()` を出してよいか。
 *
 * 途中の祖先オブジェクトが1つでも必須でなければ false。false のときは
 * 呼び出し側が `.optional()` を出し、落としたことを skipped で報告する。
 */
export function isSafelyRequired(root: Draft07Schema, path: string): boolean {
  if (!isSchemaObject(root)) return false;
  const steps = splitDeclaredPath(path);
  if (steps.length === 0) return false;

  let current: Draft07SchemaObject = root;
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index] ?? "";
    const wildcards = (step.match(/\[\*\]/g) ?? []).length;
    const key = step.slice(0, step.length - wildcards * 3);

    if (!listsAsRequired(current, key)) return false;

    const child = propertyOf(current, key);
    if (child === undefined) return index === steps.length - 1;

    let descended: Draft07SchemaObject = child;
    for (let level = 0; level < wildcards; level += 1) {
      const element = itemsOf(descended);
      // 配列の要素スキーマが無ければ、これ以上たどれない。ここまでの祖先が
      // すべて必須だったので、最後の段なら required でよい。
      if (element === undefined) return index === steps.length - 1;
      descended = element;
    }
    current = descended;
  }
  return true;
}

/**
 * 直近の親スキーマがそのキーを required に挙げているか。
 * isSafelyRequired が false のとき、「そもそも required と書かれていない」のか
 * 「書かれているが祖先の都合で落とせない」のかを区別するために使う。
 * 後者だけを skipped として報告する。
 */
export function isListedByParent(root: Draft07Schema, path: string): boolean {
  if (!isSchemaObject(root)) return false;
  const steps = splitDeclaredPath(path);
  if (steps.length === 0) return false;

  let current: Draft07SchemaObject = root;
  for (let index = 0; index < steps.length - 1; index += 1) {
    const step = steps[index] ?? "";
    const wildcards = (step.match(/\[\*\]/g) ?? []).length;
    const key = step.slice(0, step.length - wildcards * 3);
    const child = propertyOf(current, key);
    if (child === undefined) return false;
    let descended: Draft07SchemaObject = child;
    for (let level = 0; level < wildcards; level += 1) {
      const element = itemsOf(descended);
      if (element === undefined) return false;
      descended = element;
    }
    current = descended;
  }

  const last = steps[steps.length - 1] ?? "";
  const wildcards = (last.match(/\[\*\]/g) ?? []).length;
  return listsAsRequired(current, last.slice(0, last.length - wildcards * 3));
}
