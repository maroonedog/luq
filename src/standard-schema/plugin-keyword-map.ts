// ===========================================================================
// L10 src/standard-schema/plugin-keyword-map.ts
//
// 「このプラグインが、この引数で呼ばれたら、この JSON Schema キーワード」。
// src/json-schema/keyword-map-*.ts の逆向きで、対応そのものはあちらが
// 一度決めたものをそのまま使っている (二つ目の対応表を作らない)。
//
// プラグイン名を**文字列で**書いているのは、プラグイン本体を import すると
// 書き出しを使う人が 20 個のプラグインを丸ごと抱き込むからで、それは
// 「使った分しか入らない」という約束と噛み合わない。名前の綴りずれは
// test/unit/standard-schema/plugin-keyword-map.test.ts が実物の
// `plugin.name` と突き合わせて落とす — 費用を払わずに漂流を止める側に
// 寄せている。
//
// ここに無いプラグインは書けない。利用者が自分で書いたプラグインは
// 必ずここに無いので、必ず書けない。それは仕組み上そうなるという話で、
// 隠さずに UnrepresentableRuleError として出る。
// ===========================================================================

/** 引数から作るキーワード片。null は「型や必須の側で扱う」の意味。 */
export type ToKeywords = (
  args: readonly unknown[]
) => Record<string, unknown> | null;

const numberAt = (args: readonly unknown[], index: number): number =>
  typeof args[index] === "number" ? args[index] : Number.NaN;

/**
 * `.min(n)` は第2引数で排他になる。読む側 (keyword-map-number.ts) が
 * `exclusiveMinimum` を `[v, true]` に写しているのと同じ境目である。
 */
const boundOf =
  (inclusive: string, exclusive: string): ToKeywords =>
  (args) => ({
    [args[1] === true ? exclusive : inclusive]: numberAt(args, 0),
  });

/** 引数を持たない書式。名前がそのまま `format` の値になる。 */
const format =
  (name: string): ToKeywords =>
  () => ({ format: name });

export const PLUGIN_KEYWORDS: Readonly<Record<string, ToKeywords>> =
  Object.freeze({
    // --- 文字列 -----------------------------------------------------------
    stringMin: (args) => ({ minLength: numberAt(args, 0) }),
    stringMax: (args) => ({ maxLength: numberAt(args, 0) }),
    stringExactLength: (args) => ({
      minLength: numberAt(args, 0),
      maxLength: numberAt(args, 0),
    }),
    // Draft-07 の `pattern` は ECMA-262 の SOURCE 文字列。フラグは綴れないが、
    // 落とすと意味が変わるので、フラグ付きは書けないものとして扱う
    // (emit-field-schema.ts が null 以外の欠落を検出する余地を残す)。
    stringPattern: (args) =>
      args[0] instanceof RegExp ? { pattern: args[0].source } : null,
    stringContentEncoding: (args) => ({ contentEncoding: args[0] }),
    stringContentMediaType: (args) => ({ contentMediaType: args[0] }),

    // --- 書式 (format-map.ts の名前をそのまま使う) -------------------------
    stringDatetime: format("date-time"),
    stringDate: format("date"),
    stringTime: format("time"),
    stringDuration: format("duration"),
    stringEmail: format("email"),
    stringIdnEmail: format("idn-email"),
    stringHostname: format("hostname"),
    stringIdnHostname: format("idn-hostname"),
    stringIpv4: format("ipv4"),
    stringIpv6: format("ipv6"),
    // `url` は JSON Schema に登録された書式名ではない。format-map.ts は
    // `uri` と `url` の両方をこのプラグインに寄せているが、書き出す側は
    // 一つ選ばねばならないので、登録されている `uri` を選ぶ。
    stringUrl: format("uri"),
    stringUriReference: format("uri-reference"),
    stringIri: format("iri"),
    stringIriReference: format("iri-reference"),
    stringUriTemplate: format("uri-template"),
    stringJsonPointer: format("json-pointer"),
    stringRelativeJsonPointer: format("relative-json-pointer"),
    stringRegex: format("regex"),
    uuid: format("uuid"),

    // --- 数値 -------------------------------------------------------------
    numberMin: boundOf("minimum", "exclusiveMinimum"),
    numberMax: boundOf("maximum", "exclusiveMaximum"),
    numberMultipleOf: (args) => ({ multipleOf: numberAt(args, 0) }),
    numberRange: (args) => ({
      minimum: numberAt(args, 0),
      maximum: numberAt(args, 1),
    }),
    numberPositive: () => ({ exclusiveMinimum: 0 }),
    numberNegative: () => ({ exclusiveMaximum: 0 }),

    // --- 配列 -------------------------------------------------------------
    arrayMinLength: (args) => ({ minItems: numberAt(args, 0) }),
    arrayMaxLength: (args) => ({ maxItems: numberAt(args, 0) }),
    arrayUnique: () => ({ uniqueItems: true }),

    // --- 値 ---------------------------------------------------------------
    literal: (args) => ({ const: args[0] }),
    oneOf: (args) => (Array.isArray(args[0]) ? { enum: args[0] } : null),

    // --- 型と必須の側で扱うもの (キーワードを足さない) ---------------------
    // numberInteger は `type: "integer"` になるので型の決定に混ぜる。
    numberInteger: () => null,
    required: () => null,
    optional: () => null,
    nullable: () => null,
    // 実行順を変えるだけで、値の集合を変えない。
    skip: () => null,
  });
