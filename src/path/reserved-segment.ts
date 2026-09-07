// ===========================================================================
// L1  src/path/reserved-segment.ts
// The prototype-pollution gate for the ONE path grammar, plus the error every
// path-shaped rejection throws.
//
// PathSyntaxError lives here, not in parse-field-path.ts, because this module
// is the first thing that throws it and parse-field-path.ts imports this one.
// Putting the class the other way round would make the two files mutually
// dependent for no gain.
// ===========================================================================

/**
 * `Object.prototype` 上に同名のものがあるキー。
 *
 * **これはもう拒否リストではない。** 以前はこの3つを宣言パスに書けなくして
 * いたが、その拒否は過剰だった。危険なのは書き込みだけで、しかも本当に危ない
 * のは "__proto__" ひとつである:
 *
 *   読み取り  create-value-reader.ts が hasOwnProperty.call で own プロパティ
 *             しか読まないので、プロトタイプは最初から辿らない
 *   書き込み  `target[key] = value` は "__proto__" のとき Object.prototype の
 *             **アクセサ** を呼び、own プロパティを作らずプロトタイプを差し替える。
 *             "constructor" と "prototype" はデータプロパティなので代入でも
 *             own プロパティになるだけで、汚染にはならない
 *
 * create-value-writer.ts が代入をやめて defineProperty に移したことで、
 * この経路が閉じた。したがって名前で拒否する必要が無くなり、
 * `{ "properties": { "__proto__": ... } }` のようなスキーマを検証できる
 * ようになった (JSON-Schema-Test-Suite の properties.json が要求している)。
 *
 * リスト自体は残す。テストが「この3つを書いても Object.prototype が汚れない」
 * ことを名指しで確認するのに使う (test/unit/path/create-value-writer.test.ts)。
 */
export const RESERVED_SEGMENTS: readonly string[] = Object.freeze([
  "__proto__",
  "constructor",
  "prototype",
]);

/** Thrown at BUILD time for every malformed or unsafe path. A declared rule
 *  must either execute or fail loudly; the legacy silent `return () => null`
 *  turned a typo into a rule that never ran. */
export class PathSyntaxError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`Invalid field path ${JSON.stringify(path)}: ${reason}`);
    this.name = "PathSyntaxError";
    this.path = path;
  }
}

export function isReservedSegment(key: string): boolean {
  return RESERVED_SEGMENTS.includes(key);
}

/**
 * The single definition of "this string may be used as one path segment".
 *
 * `source` is the whole path (or the origin, for a key that has not been
 * joined into a path yet) and appears in the message so a regression names the
 * offender.
 *
 * A key containing `.` is rejected rather than escaped: the grammar splits on
 * `.` and has no escape syntax, so such a key would silently mean something
 * else. Rejecting is the only honest option, and it is the reason this
 * function is exported — the JSON Schema converter must call it on raw
 * property names BEFORE joining them into a path, where the dot is still
 * visible as its own key.
 */
export function assertDeclarableKey(key: string, source: string): void {
  if (key === "") {
    throw new PathSyntaxError(source, "a path segment must not be empty");
  }
  if (key.includes(".")) {
    throw new PathSyntaxError(
      source,
      `the key ${JSON.stringify(key)} contains "." and cannot be expressed; ` +
        'the grammar splits on "." and defines no escape'
    );
  }
  if (key.includes("[") || key.includes("]")) {
    throw new PathSyntaxError(
      source,
      `the key ${JSON.stringify(key)} contains a bracket; "[*]" is the only ` +
        "bracket form and it must trail a key"
    );
  }
  // 予約セグメントの拒否はここから外した。理由は RESERVED_SEGMENTS の
  // コメントに書いてある。要約すると、危険なのは書き込みだけで、その書き込みは
  // create-value-writer.ts が defineProperty に移したので安全になった。
  // 名前で拒否する必要が無くなり、JSON Schema が "__proto__" というキーを
  // 持つオブジェクトを検証できるようになった。
}
