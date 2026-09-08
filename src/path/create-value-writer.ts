// ===========================================================================
// L1  src/path/create-value-writer.ts
// Copy-on-write. Used only when a field declared a transform or a default.
//
// The writer NEVER mutates its subject: it returns a new root in which only
// the objects along the written spine are fresh, and every untouched sibling
// keeps its identity. The legacy tree shipped four setters with three
// different auto-vivification rules, all of them mutating in place and one of
// them replacing a legitimate `0` / `""` / `false` intermediate with `{}`.
// ===========================================================================
import type { PathSegment } from "./path-segment.types";
import {
  collectKeySegments,
  isIndexableObject,
  readOwnProperty,
} from "./create-value-reader";
import { isArray } from "../types";

/** Returns the new root. It is NOT `void`: a copy-on-write write cannot report
 *  its result through the argument it refused to mutate. */
export type ValueWriter = (subject: unknown, value: unknown) => unknown;

export function createValueWriter(
  template: readonly PathSegment[]
): ValueWriter {
  const keys = collectKeySegments(template);
  if (keys.length === 0) return (_subject, value) => value;
  return (subject, value) => writeInto(subject, keys, 0, value);
}

function writeInto(
  container: unknown,
  keys: readonly string[],
  depth: number,
  value: unknown
): unknown {
  const key = keys[depth];
  if (key === undefined) return value;
  if (container === null || container === undefined) {
    return vivify(key, writeInto(undefined, keys, depth + 1, value));
  }
  if (!isIndexableObject(container)) return container;
  const child = readOwnProperty(container, key);
  const written = writeInto(child, keys, depth + 1, value);
  if (written === child) return container;
  return copyWith(container, key, written);
}

/**
 * Auto-vivification, restricted to the one case the legacy rule got wrong:
 * only a missing or null intermediate is created. A present primitive is left
 * exactly as it is (the `if (!isIndexableObject) return container` above), so
 * writing `a.b` into `{a: 0}` destroys nothing and returns the original root
 * by identity.
 *
 * The container created is always a plain object. A numeric segment does not
 * conjure an array — the declaration grammar cannot express `items[0]`, so a
 * numeric key here is a Record key.
 */
/**
 * キーを own プロパティとして置く。**代入演算子を使わない。**
 *
 * `copy[key] = value` は key が "__proto__" のとき Object.prototype の
 * アクセサ (setter) を呼び、own プロパティを作る代わりにプロトタイプを
 * 差し替えてしまう。defineProperty はアクセサを見ずに own プロパティを
 * 定義するので、"__proto__" という名前のプロパティを安全に持てる。
 *
 * "constructor" と "prototype" は Object.prototype 上でデータプロパティ
 * なので代入でも own プロパティになるが、キーごとに分岐すると分岐のほうを
 * 間違えるので一律にこちらを通す。
 *
 * これが「宣言パスに __proto__ を書けるようにする」の前提。書き込みが安全に
 * なったので、パス文法の側で拒否する必要が無くなった (reserved-segment.ts)。
 */
function putOwnProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown
): void {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

function vivify(key: string, written: unknown): Record<string, unknown> {
  const created: Record<string, unknown> = {};
  putOwnProperty(created, key, written);
  return created;
}

function copyWith(
  container: Record<string, unknown>,
  key: string,
  value: unknown
): unknown {
  if (isArray(container)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) return container;
    const copy: unknown[] = container.slice();
    copy[index] = value;
    return copy;
  }
  // スプレッドは own の列挙可能プロパティを CreateDataProperty で写すので、
  // ここでは setter は動かない。危ないのは下の代入だけ。
  const copy: Record<string, unknown> = { ...container };
  putOwnProperty(copy, key, value);
  return copy;
}
